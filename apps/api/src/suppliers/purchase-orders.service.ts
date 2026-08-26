import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePurchaseOrderRequest,
  PoColumn,
  PurchaseOrderDetail,
  ReceivePoRequest,
  ReorderSuggestion,
} from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../warehouses/inventory.service';
import { BillStatus, PoStatus } from '../../generated/prisma/enums';
import { fmtMoney } from './po-format';

const PO_COLUMNS: { status: PoStatus; label: string }[] = [
  { status: PoStatus.DRAFT, label: 'Draft' },
  { status: PoStatus.SENT, label: 'Sent' },
  { status: PoStatus.PARTIAL, label: 'Partially received' },
  { status: PoStatus.RECEIVED, label: 'Received' },
  { status: PoStatus.CLOSED, label: 'Closed' },
];

const FIRST_PO_NUMBER = 1001;

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async listColumns(businessId: string): Promise<PoColumn[]> {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { businessId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
    });

    return PO_COLUMNS.map(({ status, label }) => {
      const items = pos
        .filter((po) => po.status === status)
        .map((po) => ({
          id: po.id,
          displayId: `PO-${po.number}`,
          supplierName: po.supplier.name,
          totalFmt: fmtMoney(po.items.reduce((sum, it) => sum + it.qty * Number(it.unitCost), 0)),
        }));
      return { status, label, count: items.length, items };
    });
  }

  async get(businessId: string, poId: string): Promise<PurchaseOrderDetail> {
    const po = await this.findOwned(businessId, poId);
    return toDetail(po);
  }

  async create(businessId: string, dto: CreatePurchaseOrderRequest): Promise<PurchaseOrderDetail> {
    if (dto.items.length === 0) throw new BadRequestException('A purchase order needs at least one item');

    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || supplier.businessId !== businessId) throw new NotFoundException('Supplier not found');

    for (const item of dto.items) {
      const variant = await this.prisma.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant || variant.businessId !== businessId) throw new NotFoundException('Variant not found');
    }

    const po = await this.prisma.$transaction(async (tx) => {
      const last = await tx.purchaseOrder.findFirst({ where: { businessId }, orderBy: { number: 'desc' } });
      const number = (last?.number ?? FIRST_PO_NUMBER - 1) + 1;

      return tx.purchaseOrder.create({
        data: {
          businessId,
          number,
          supplierId: dto.supplierId,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          items: {
            create: dto.items.map((it) => ({ variantId: it.variantId, qty: it.qty, unitCost: it.unitCost })),
          },
        },
        include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
      });
    });

    return toDetail(po);
  }

  async approve(businessId: string, poId: string): Promise<PurchaseOrderDetail> {
    const po = await this.findOwned(businessId, poId);
    if (po.status !== PoStatus.DRAFT) throw new BadRequestException('Only a draft PO can be approved');

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: PoStatus.SENT, sentAt: new Date() },
      include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
    });
    return toDetail(updated);
  }

  async receive(businessId: string, poId: string, dto: ReceivePoRequest): Promise<PurchaseOrderDetail> {
    const po = await this.findOwned(businessId, poId);
    if (po.status !== PoStatus.SENT && po.status !== PoStatus.PARTIAL) {
      throw new BadRequestException('Only a sent or partially received PO can receive stock');
    }
    await this.assertWarehouseOwned(businessId, dto.warehouseId);

    const itemsById = new Map(po.items.map((it) => [it.id, it]));
    for (const line of dto.lines) {
      const item = itemsById.get(line.itemId);
      if (!item) throw new NotFoundException(`Item ${line.itemId} not found on this PO`);
      if (item.receivedQty + line.receivedQty > item.qty) {
        throw new BadRequestException(`Cannot receive more than ordered for ${item.variantId}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        if (line.receivedQty <= 0) continue;
        const item = itemsById.get(line.itemId)!;
        await this.inventory.applyDelta(tx, businessId, dto.warehouseId, item.variantId, line.receivedQty);
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: { increment: line.receivedQty } },
        });
      }

      const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: poId } });
      const fullyReceived = refreshedItems.every((it) => it.receivedQty >= it.qty);
      const anyReceived = refreshedItems.some((it) => it.receivedQty > 0);

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: fullyReceived ? PoStatus.RECEIVED : anyReceived ? PoStatus.PARTIAL : po.status,
          receivedAt: fullyReceived ? new Date() : undefined,
        },
      });
    });

    const refreshed = await this.findOwned(businessId, poId);
    return toDetail(refreshed);
  }

  async close(businessId: string, poId: string): Promise<PurchaseOrderDetail> {
    const po = await this.findOwned(businessId, poId);
    if (po.status !== PoStatus.RECEIVED) throw new BadRequestException('Only a fully received PO can be closed');

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: PoStatus.CLOSED },
      include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
    });
    return toDetail(updated);
  }

  async updateBillStatus(businessId: string, poId: string, billStatus: BillStatus): Promise<PurchaseOrderDetail> {
    await this.findOwned(businessId, poId);
    const updated = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      // Dates the "Supplier payment" row in the Financials transaction log.
      data: { billStatus, paidAt: billStatus === BillStatus.PAID ? new Date() : null },
      include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
    });
    return toDetail(updated);
  }

  async reorderSuggestions(businessId: string): Promise<ReorderSuggestion[]> {
    const products = await this.prisma.product.findMany({
      where: { businessId },
      include: {
        variants: { orderBy: { createdAt: 'asc' } },
        supplierLinks: { where: { preferred: true }, include: { supplier: true }, take: 1 },
      },
    });

    return products
      .map((p) => {
        const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
        if (stock > p.lowStockThreshold) return null;
        const firstVariant = p.variants[0];
        if (!firstVariant) return null;
        const preferred = p.supplierLinks[0];
        const suggestion: ReorderSuggestion = {
          productId: p.id,
          variantId: firstVariant.id,
          name: p.name,
          stock,
          threshold: p.lowStockThreshold,
          preferredSupplierId: preferred?.supplierId ?? null,
          preferredSupplierName: preferred?.supplier.name ?? null,
        };
        return suggestion;
      })
      .filter((s): s is ReorderSuggestion => s !== null)
      .slice(0, 5);
  }

  private async findOwned(businessId: string, poId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
    });
    if (!po || po.businessId !== businessId) throw new NotFoundException('Purchase order not found');
    return po;
  }

  private async assertWarehouseOwned(businessId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.businessId !== businessId) throw new NotFoundException('Warehouse not found');
  }
}

type PoWithDetail = {
  id: string;
  number: number;
  status: PoStatus;
  billStatus: BillStatus;
  supplierId: string;
  supplier: { name: string };
  expectedDate: Date | null;
  items: {
    id: string;
    variantId: string;
    qty: number;
    unitCost: unknown;
    receivedQty: number;
    variant: { sku: string; product: { name: string } };
  }[];
};

function toDetail(po: PoWithDetail): PurchaseOrderDetail {
  const items = po.items.map((it) => ({
    id: it.id,
    variantId: it.variantId,
    name: it.variant.product.name,
    sku: it.variant.sku,
    qty: it.qty,
    unitCost: Number(it.unitCost),
    lineTotal: it.qty * Number(it.unitCost),
    receivedQty: it.receivedQty,
  }));
  const total = items.reduce((sum, it) => sum + it.lineTotal, 0);
  return {
    id: po.id,
    displayId: `PO-${po.number}`,
    status: po.status,
    billStatus: po.billStatus,
    supplierId: po.supplierId,
    supplierName: po.supplier.name,
    expectedDate: po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : null,
    items,
    total,
    totalFmt: fmtMoney(total),
    needsApproval: po.status === PoStatus.DRAFT,
  };
}
