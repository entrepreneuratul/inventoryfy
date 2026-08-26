import { Injectable } from '@nestjs/common';
import type { ActivityItem, BusinessCard, LowStockAlertRow, OwnerDashboard, SingleDashboard } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialsService } from '../financials/financials.service';
import { BillStatus, OrderPaymentStatus, OrderStatus, PoStatus, ReturnStatus } from '../../generated/prisma/enums';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financials: FinancialsService,
  ) {}

  async ownerDashboard(businessIds: string[]): Promise<OwnerDashboard> {
    const financials = await this.financials.forBusinesses(businessIds);
    const totalRow = financials.pnlRows.find((r) => r.isTotal) ?? financials.pnlRows[0];

    const businesses: BusinessCard[] = [];
    let totalCash = 0;
    let totalPendingBills = 0;

    for (const businessId of businessIds) {
      const business = await this.prisma.business.findUnique({ where: { id: businessId } });
      if (!business) continue;

      const row = financials.pnlRows.find((r) => r.businessId === businessId);
      const alerts = await this.lowStockAlerts([businessId]);
      const pendingBills = await this.prisma.purchaseOrder.count({
        where: { businessId, billStatus: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] } },
      });
      const cash = await this.cashPosition(businessId);

      businesses.push({
        businessId,
        name: business.name,
        type: business.type,
        profitFmt: row?.profitFmt ?? '$0.00',
        revenueFmt: row?.revenueFmt ?? '$0.00',
        lowStockCount: alerts.length,
        pendingBillsCount: pendingBills,
      });
      totalCash += cash;
      totalPendingBills += pendingBills;
    }

    return {
      view: 'OWNER',
      totalProfitFmt: totalRow?.profitFmt ?? '$0.00',
      totalRevenueFmt: totalRow?.revenueFmt ?? '$0.00',
      totalExpensesFmt: totalRow?.expensesFmt ?? '$0.00',
      totalCashFmt: fmt(totalCash),
      pendingBillsCount: totalPendingBills,
      businesses,
      lowStockAlerts: await this.lowStockAlerts(businessIds),
    };
  }

  async singleDashboard(businessId: string): Promise<SingleDashboard> {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaysOrders = await this.prisma.order.findMany({
      where: { businessId, createdAt: { gte: startOfToday }, status: { not: OrderStatus.CANCELLED } },
      include: { items: true },
    });
    const todaySales = todaysOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.qty * Number(it.unitPrice), 0), 0);

    const pendingPos = await this.prisma.purchaseOrder.count({ where: { businessId, status: { not: PoStatus.CLOSED } } });
    const pendingBills = await this.prisma.purchaseOrder.count({
      where: { businessId, billStatus: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] } },
    });
    const cash = await this.cashPosition(businessId);

    return {
      view: 'SINGLE',
      businessName: business.name,
      businessType: business.type,
      todaySalesFmt: fmt(todaySales),
      cashPositionFmt: fmt(cash),
      pendingPos,
      pendingBills,
      lowStockAlerts: await this.lowStockAlerts([businessId]),
      activity: await this.recentActivity(businessId),
    };
  }

  private async lowStockAlerts(businessIds: string[]): Promise<LowStockAlertRow[]> {
    const products = await this.prisma.product.findMany({
      where: { businessId: { in: businessIds } },
      include: { variants: true, business: true },
    });
    return products
      .map((p) => {
        const stock = p.variants.reduce((s, v) => s + v.stock, 0);
        if (stock > p.lowStockThreshold) return null;
        const row: LowStockAlertRow = {
          productId: p.id,
          name: p.name,
          businessName: p.business.name,
          stock,
          threshold: p.lowStockThreshold,
          status: stock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        };
        return row;
      })
      .filter((r): r is LowStockAlertRow => r !== null);
  }

  /** A simple proxy for cash on hand: revenue actually collected (paid,
   * delivered orders, net of refunds) minus what's actually been paid out
   * to suppliers. Not a real ledger — there's no bank-account model here —
   * just the two cash-affecting flows this app tracks. */
  private async cashPosition(businessId: string): Promise<number> {
    const paidDeliveredOrders = await this.prisma.order.findMany({
      where: { businessId, status: OrderStatus.DELIVERED, paymentStatus: OrderPaymentStatus.PAID },
      include: { items: { include: { returns: true } } },
    });
    let collected = 0;
    for (const order of paidDeliveredOrders) {
      for (const item of order.items) {
        if (item.returns.some((r) => r.status === ReturnStatus.REFUNDED)) continue;
        collected += item.qty * Number(item.unitPrice);
      }
    }

    const paidPos = await this.prisma.purchaseOrder.findMany({
      where: { businessId, billStatus: BillStatus.PAID },
      include: { items: true },
    });
    const paidOut = paidPos.reduce((sum, po) => sum + po.items.reduce((s, it) => s + it.qty * Number(it.unitCost), 0), 0);

    return collected - paidOut;
  }

  private async recentActivity(businessId: string): Promise<ActivityItem[]> {
    const [orders, receivedPos, returns] = await Promise.all([
      this.prisma.order.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.purchaseOrder.findMany({
        where: { businessId, receivedAt: { not: null } },
        orderBy: { receivedAt: 'desc' },
        take: 5,
        include: { supplier: true },
      }),
      this.prisma.return.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);

    const items: (ActivityItem & { at: Date })[] = [
      ...orders.map((o) => ({ icon: 'order' as const, text: `New order ORD-${o.number} (${o.channel.toLowerCase()})`, at: o.createdAt, time: '' })),
      ...receivedPos.map((po) => ({ icon: 'po' as const, text: `PO-${po.number} received from ${po.supplier.name}`, at: po.receivedAt!, time: '' })),
      ...returns.map((r) => ({ icon: 'return' as const, text: `Return RMA-${r.number} requested`, at: r.createdAt, time: '' })),
    ];

    return items
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 5)
      .map(({ icon, text, at }) => ({ icon, text, time: relativeTime(at) }));
  }
}

function fmt(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
