import { Injectable, NotFoundException } from '@nestjs/common';
import type { BusinessFinancials, GstRow, LandedCost, PnlRow, TransactionRow, ValuationMethod, ValuationResult } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, BillStatus, OrderPaymentStatus } from '../../generated/prisma/enums';

const FREIGHT_PCT = 0.08;
const DUTY_PCT = 0.05;

interface CostLayer {
  qty: number;
  unitCost: number;
  receivedAt: Date;
}

function fmt(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

@Injectable()
export class FinancialsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Per-product valuation & landed cost ───────────────────────────

  async valuation(businessId: string, productId: string, method: ValuationMethod): Promise<ValuationResult> {
    const product = await this.findOwnedProduct(businessId, productId);
    const currentStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    const { layers, fallbackUnitCost } = await this.getCostLayers(businessId, productId);

    const totalReceivedQty = layers.reduce((s, l) => s + l.qty, 0);
    const totalReceivedCost = layers.reduce((s, l) => s + l.qty * l.unitCost, 0);

    let amount = 0;
    let coveredQty = 0;

    if (method === 'WEIGHTED') {
      const avgCost = totalReceivedQty > 0 ? totalReceivedCost / totalReceivedQty : (fallbackUnitCost ?? 0);
      amount = currentStock * avgCost;
      coveredQty = currentStock; // weighted-average has no "uncovered" concept
    } else {
      // FIFO: units sold are the oldest first, so what remains is the
      // newest layers. LIFO: units sold are the newest first, so what
      // remains is the oldest layers.
      const ordered = method === 'FIFO' ? [...layers].reverse() : [...layers];
      let remaining = currentStock;
      for (const layer of ordered) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, layer.qty);
        amount += take * layer.unitCost;
        coveredQty += take;
        remaining -= take;
      }
    }

    const uncovered = currentStock - coveredQty;
    let note: string | null = null;
    if (uncovered > 0) {
      if (fallbackUnitCost !== null) {
        amount += uncovered * fallbackUnitCost;
        note = `${uncovered} unit${uncovered === 1 ? '' : 's'} have no purchase-order cost history — valued at ${fmt(fallbackUnitCost)} each from the linked supplier's quote.`;
      } else {
        note = `${uncovered} unit${uncovered === 1 ? '' : 's'} have no purchase-order cost history and no linked supplier — valued at $0.`;
      }
    }

    return { method, amount, amountFmt: fmt(amount), note };
  }

  async landedCost(businessId: string, productId: string): Promise<LandedCost> {
    await this.findOwnedProduct(businessId, productId);
    const { layers, fallbackUnitCost } = await this.getCostLayers(businessId, productId);
    const totalQty = layers.reduce((s, l) => s + l.qty, 0);
    const totalCost = layers.reduce((s, l) => s + l.qty * l.unitCost, 0);
    const base = totalQty > 0 ? totalCost / totalQty : (fallbackUnitCost ?? 0);
    const freight = base * FREIGHT_PCT;
    const duty = base * DUTY_PCT;
    return {
      baseFmt: fmt(base),
      freightFmt: fmt(freight),
      dutyFmt: fmt(duty),
      totalFmt: fmt(base + freight + duty),
    };
  }

  private async getCostLayers(businessId: string, productId: string): Promise<{ layers: CostLayer[]; fallbackUnitCost: number | null }> {
    const variants = await this.prisma.productVariant.findMany({ where: { productId }, select: { id: true } });
    const variantIds = variants.map((v) => v.id);

    const poItems = await this.prisma.purchaseOrderItem.findMany({
      where: { variantId: { in: variantIds }, receivedQty: { gt: 0 } },
      include: { purchaseOrder: true },
    });

    const layers: CostLayer[] = poItems
      .map((it) => ({
        qty: it.receivedQty,
        unitCost: Number(it.unitCost),
        receivedAt: it.purchaseOrder.receivedAt ?? it.purchaseOrder.createdAt,
      }))
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

    const preferredLink = await this.prisma.supplierProduct.findFirst({
      where: { businessId, productId, preferred: true },
    });
    const anyLink = preferredLink ?? (await this.prisma.supplierProduct.findFirst({ where: { businessId, productId } }));
    const fallbackUnitCost = anyLink ? Number(anyLink.costPrice) : null;

    return { layers, fallbackUnitCost };
  }

  private async findOwnedProduct(businessId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
    if (!product || product.businessId !== businessId) throw new NotFoundException('Product not found');
    return product;
  }

  // ─── Business-level financials (P&L, AP, AR, GST, transaction log) ─

  /** Single business — used both directly and as a building block for the
   * owner's cross-business aggregate. */
  async forBusiness(businessId: string): Promise<BusinessFinancials> {
    return this.forBusinesses([businessId]);
  }

  /** Aggregates the same computation across several businesses (the
   * owner-aggregate "Owner View"). A single-element array degenerates to
   * the single-business case, so both endpoints share this one path. */
  async forBusinesses(businessIds: string[]): Promise<BusinessFinancials> {
    const pnlRows: PnlRow[] = [];
    const gstByRate = new Map<number, { taxable: number; gst: number }>();
    const transactions: TransactionRow[] = [];
    let apTotal = 0;
    let arTotal = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const businessId of businessIds) {
      const business = await this.prisma.business.findUnique({ where: { id: businessId } });
      if (!business) continue;

      const deliveredOrders = await this.prisma.order.findMany({
        where: { businessId, status: OrderStatus.DELIVERED },
        include: { items: { include: { variant: { include: { product: true } }, returns: true } } },
      });

      let revenue = 0;
      let cogs = 0;
      const unitCostCache = new Map<string, number>();

      for (const order of deliveredOrders) {
        let orderNet = 0;
        for (const item of order.items) {
          const isRefunded = item.returns.some((r) => r.status === 'REFUNDED');
          if (isRefunded) continue; // net-of-returns: reversed sales don't count as revenue

          const lineTotal = item.qty * Number(item.unitPrice);
          revenue += lineTotal;
          orderNet += lineTotal;

          const productId = item.variant.product.id;
          if (!unitCostCache.has(productId)) {
            const { layers, fallbackUnitCost } = await this.getCostLayers(businessId, productId);
            const totalQty = layers.reduce((s, l) => s + l.qty, 0);
            const totalCost = layers.reduce((s, l) => s + l.qty * l.unitCost, 0);
            unitCostCache.set(productId, totalQty > 0 ? totalCost / totalQty : (fallbackUnitCost ?? 0));
          }
          cogs += item.qty * unitCostCache.get(productId)!;

          const rate = item.variant.product.taxRatePercent;
          const bucket = gstByRate.get(rate) ?? { taxable: 0, gst: 0 };
          bucket.taxable += lineTotal;
          bucket.gst += lineTotal * (rate / 100);
          gstByRate.set(rate, bucket);
        }
        if (orderNet > 0) {
          transactions.push({
            date: (order.deliveredAt ?? order.createdAt).toISOString().slice(0, 10),
            businessName: business.name,
            type: 'Sale',
            note: `Order ORD-${order.number}`,
            amountFmt: fmt(orderNet),
            isNegative: false,
          });
        }
      }

      const refundedReturns = await this.prisma.return.findMany({
        where: { businessId, status: 'REFUNDED' },
        include: { orderItem: { include: { order: true } } },
      });
      for (const ret of refundedReturns) {
        const amount = ret.orderItem.qty * Number(ret.orderItem.unitPrice);
        transactions.push({
          date: (ret.decidedAt ?? ret.createdAt).toISOString().slice(0, 10),
          businessName: business.name,
          type: 'Refund',
          note: `Order ORD-${ret.orderItem.order.number} — RMA-${ret.number}`,
          amountFmt: fmt(-amount),
          isNegative: true,
        });
      }

      const openPos = await this.prisma.purchaseOrder.findMany({
        where: { businessId, billStatus: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] } },
        include: { items: true },
      });
      apTotal += openPos.reduce((sum, po) => sum + po.items.reduce((s, it) => s + it.qty * Number(it.unitCost), 0), 0);

      const paidPos = await this.prisma.purchaseOrder.findMany({
        where: { businessId, billStatus: BillStatus.PAID },
        include: { items: true, supplier: true },
      });
      for (const po of paidPos) {
        const total = po.items.reduce((s, it) => s + it.qty * Number(it.unitCost), 0);
        transactions.push({
          date: (po.paidAt ?? po.updatedAt).toISOString().slice(0, 10),
          businessName: business.name,
          type: 'Supplier payment',
          note: po.supplier.name,
          amountFmt: fmt(-total),
          isNegative: true,
        });
      }

      const unpaidOrders = await this.prisma.order.findMany({
        where: { businessId, paymentStatus: OrderPaymentStatus.UNPAID, status: { not: OrderStatus.CANCELLED } },
        include: { items: true },
      });
      arTotal += unpaidOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.qty * Number(it.unitPrice), 0), 0);

      const profit = revenue - cogs;
      pnlRows.push({
        businessId,
        name: business.name,
        revenueFmt: fmt(revenue),
        expensesFmt: fmt(cogs),
        profitFmt: fmt(profit),
        isTotal: false,
      });
      totalRevenue += revenue;
      totalExpenses += cogs;
    }

    if (businessIds.length > 1) {
      pnlRows.push({
        businessId: '',
        name: 'Total',
        revenueFmt: fmt(totalRevenue),
        expensesFmt: fmt(totalExpenses),
        profitFmt: fmt(totalRevenue - totalExpenses),
        isTotal: true,
      });
    }

    const gstRows: GstRow[] = [...gstByRate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, { taxable, gst }]) => ({ rate, taxableFmt: fmt(taxable), gstFmt: fmt(gst) }));

    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      apTotalFmt: fmt(apTotal),
      arTotalFmt: fmt(arTotal),
      pnlRows,
      gstRows,
      transactions: transactions.slice(0, 50),
    };
  }

  async exportCsv(businessIds: string[]): Promise<string> {
    const data = await this.forBusinesses(businessIds);
    const lines = ['Date,Business,Type,Note,Amount'];
    for (const t of data.transactions) {
      lines.push([t.date, t.businessName, t.type, `"${t.note.replace(/"/g, '""')}"`, t.amountFmt].join(','));
    }
    return lines.join('\n');
  }
}
