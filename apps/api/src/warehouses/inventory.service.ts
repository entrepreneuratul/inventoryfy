import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CycleCountDetail,
  CycleCountSummary,
  ProductWarehouseBreakdown,
  TransferRow,
  WarehouseSummary,
} from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CycleCountStatus } from '../../generated/prisma/enums';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Warehouses ─────────────────────────────────────────────────────

  async listWarehouses(businessId: string): Promise<WarehouseSummary[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { businessId },
      include: { stockLevels: true },
      orderBy: { name: 'asc' },
    });
    return warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      skuCount: w.stockLevels.filter((s) => s.qty > 0).length,
      totalUnits: w.stockLevels.reduce((sum, s) => sum + s.qty, 0),
    }));
  }

  async createWarehouse(businessId: string, name: string): Promise<WarehouseSummary> {
    const warehouse = await this.prisma.warehouse.create({ data: { businessId, name } });
    return { id: warehouse.id, name: warehouse.name, skuCount: 0, totalUnits: 0 };
  }

  async adjustStock(businessId: string, warehouseId: string, variantId: string, delta: number): Promise<void> {
    await this.assertWarehouseOwned(businessId, warehouseId);
    await this.assertVariantOwned(businessId, variantId);
    await this.prisma.$transaction((tx) => this.applyDelta(tx, businessId, warehouseId, variantId, delta));
  }

  async productWarehouseBreakdown(businessId: string, productId: string): Promise<ProductWarehouseBreakdown> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
    if (!product || product.businessId !== businessId) throw new NotFoundException('Product not found');

    const variantIds = product.variants.map((v) => v.id);
    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

    const stockLevels = await this.prisma.warehouseStock.findMany({
      where: { variantId: { in: variantIds } },
      include: { warehouse: true },
    });

    const byWarehouse = new Map<string, { warehouseName: string; qty: number }>();
    for (const level of stockLevels) {
      const entry = byWarehouse.get(level.warehouseId) ?? { warehouseName: level.warehouse.name, qty: 0 };
      entry.qty += level.qty;
      byWarehouse.set(level.warehouseId, entry);
    }

    const allocated = [...byWarehouse.values()].reduce((sum, w) => sum + w.qty, 0);

    return {
      warehouses: [...byWarehouse.entries()].map(([warehouseId, w]) => ({
        warehouseId,
        warehouseName: w.warehouseName,
        qty: w.qty,
      })),
      unallocated: totalStock - allocated,
    };
  }

  // ─── Transfers ──────────────────────────────────────────────────────

  async listTransfers(businessId: string): Promise<TransferRow[]> {
    const transfers = await this.prisma.transfer.findMany({
      where: { businessId },
      include: { variant: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
      orderBy: { createdAt: 'desc' },
    });
    return transfers.map((t) => ({
      id: t.id,
      productName: t.variant.product.name,
      variantLabel: t.variant.label,
      sku: t.variant.sku,
      fromWarehouseName: t.fromWarehouse.name,
      toWarehouseName: t.toWarehouse.name,
      qty: t.qty,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async createTransfer(
    businessId: string,
    variantId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    qty: number,
  ): Promise<TransferRow> {
    if (fromWarehouseId === toWarehouseId) throw new BadRequestException('Source and destination must differ');
    if (qty <= 0) throw new BadRequestException('Quantity must be positive');
    await this.assertWarehouseOwned(businessId, fromWarehouseId);
    await this.assertWarehouseOwned(businessId, toWarehouseId);
    await this.assertVariantOwned(businessId, variantId);

    const transfer = await this.prisma.$transaction(async (tx) => {
      await this.applyDelta(tx, businessId, fromWarehouseId, variantId, -qty);
      await this.applyDelta(tx, businessId, toWarehouseId, variantId, qty);
      return tx.transfer.create({
        data: { businessId, variantId, fromWarehouseId, toWarehouseId, qty },
        include: { variant: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
      });
    });

    return {
      id: transfer.id,
      productName: transfer.variant.product.name,
      variantLabel: transfer.variant.label,
      sku: transfer.variant.sku,
      fromWarehouseName: transfer.fromWarehouse.name,
      toWarehouseName: transfer.toWarehouse.name,
      qty: transfer.qty,
      status: transfer.status,
      createdAt: transfer.createdAt.toISOString(),
    };
  }

  // ─── Cycle counts ───────────────────────────────────────────────────

  async listCounts(businessId: string): Promise<CycleCountSummary[]> {
    const counts = await this.prisma.cycleCount.findMany({
      where: { businessId },
      include: { warehouse: true, lines: true },
      orderBy: { createdAt: 'desc' },
    });
    return counts.map(toSummary);
  }

  async getActiveCount(businessId: string, warehouseId: string): Promise<CycleCountDetail | null> {
    const count = await this.prisma.cycleCount.findFirst({
      where: { businessId, warehouseId, status: CycleCountStatus.IN_PROGRESS },
      include: { warehouse: true, lines: { include: { variant: { include: { product: true } } } } },
    });
    return count ? toDetail(count) : null;
  }

  async startCount(businessId: string, warehouseId: string): Promise<CycleCountDetail> {
    await this.assertWarehouseOwned(businessId, warehouseId);
    const existing = await this.prisma.cycleCount.findFirst({
      where: { businessId, warehouseId, status: CycleCountStatus.IN_PROGRESS },
    });
    if (existing) throw new ConflictException('A count is already in progress for this warehouse');

    const levels = await this.prisma.warehouseStock.findMany({ where: { warehouseId, qty: { gt: 0 } } });

    const count = await this.prisma.cycleCount.create({
      data: {
        businessId,
        warehouseId,
        lines: { create: levels.map((l) => ({ variantId: l.variantId, expected: l.qty, counted: l.qty })) },
      },
      include: { warehouse: true, lines: { include: { variant: { include: { product: true } } } } },
    });
    return toDetail(count);
  }

  async setCountLine(businessId: string, countId: string, lineId: string, counted: number): Promise<CycleCountDetail> {
    const count = await this.assertCountOwned(businessId, countId);
    if (count.status !== CycleCountStatus.IN_PROGRESS) throw new BadRequestException('Count is already submitted');
    const line = await this.prisma.cycleCountLine.findUnique({ where: { id: lineId } });
    if (!line || line.cycleCountId !== countId) throw new NotFoundException('Count line not found');

    await this.prisma.cycleCountLine.update({ where: { id: lineId }, data: { counted } });
    const refreshed = await this.prisma.cycleCount.findUniqueOrThrow({
      where: { id: countId },
      include: { warehouse: true, lines: { include: { variant: { include: { product: true } } } } },
    });
    return toDetail(refreshed);
  }

  async submitCount(businessId: string, countId: string): Promise<CycleCountDetail> {
    const count = await this.assertCountOwned(businessId, countId);
    if (count.status !== CycleCountStatus.IN_PROGRESS) throw new BadRequestException('Count is already submitted');

    const lines = await this.prisma.cycleCountLine.findMany({ where: { cycleCountId: countId } });
    await this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const counted = line.counted ?? line.expected;
        const variance = counted - line.expected;
        if (variance !== 0) {
          await this.applyDelta(tx, businessId, count.warehouseId, line.variantId, variance);
        }
      }
      await tx.cycleCount.update({ where: { id: countId }, data: { status: CycleCountStatus.COMPLETED, completedAt: new Date() } });
    });

    const refreshed = await this.prisma.cycleCount.findUniqueOrThrow({
      where: { id: countId },
      include: { warehouse: true, lines: { include: { variant: { include: { product: true } } } } },
    });
    return toDetail(refreshed);
  }

  // ─── Internals (public within the same transaction — reused by
  //     PurchaseOrdersService when receiving stock) ────────────────────

  /** Applies a signed quantity change to a variant at a warehouse, keeping
   * ProductVariant.stock (the denormalized total) in sync in the same tx.
   * Public so other services can fold a stock change into their own
   * transaction (e.g. receiving a PO line item). */
  async applyDelta(
    tx: Prisma.TransactionClient,
    businessId: string,
    warehouseId: string,
    variantId: string,
    delta: number,
  ): Promise<void> {
    const existing = await tx.warehouseStock.findUnique({ where: { warehouseId_variantId: { warehouseId, variantId } } });
    const newQty = (existing?.qty ?? 0) + delta;
    if (newQty < 0) {
      throw new BadRequestException('Not enough stock at that warehouse for this change');
    }

    if (existing) {
      await tx.warehouseStock.update({ where: { id: existing.id }, data: { qty: newQty } });
    } else {
      await tx.warehouseStock.create({ data: { businessId, warehouseId, variantId, qty: newQty } });
    }

    await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: delta } } });
  }

  private async assertWarehouseOwned(businessId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.businessId !== businessId) throw new NotFoundException('Warehouse not found');
  }

  private async assertVariantOwned(businessId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.businessId !== businessId) throw new NotFoundException('Variant not found');
  }

  private async assertCountOwned(businessId: string, countId: string) {
    const count = await this.prisma.cycleCount.findUnique({ where: { id: countId } });
    if (!count || count.businessId !== businessId) throw new NotFoundException('Count not found');
    return count;
  }
}

function toSummary(count: {
  id: string;
  status: CycleCountStatus;
  warehouse: { name: string };
  lines: { expected: number; counted: number | null }[];
}): CycleCountSummary {
  return {
    id: count.id,
    warehouseName: count.warehouse.name,
    itemsCounted: count.lines.length,
    totalVariance: count.lines.reduce((sum, l) => sum + ((l.counted ?? l.expected) - l.expected), 0),
    status: count.status,
  };
}

function toDetail(count: {
  id: string;
  warehouseId: string;
  status: CycleCountStatus;
  warehouse: { name: string };
  lines: { id: string; variantId: string; expected: number; counted: number | null; variant: { sku: string; product: { name: string } } }[];
}): CycleCountDetail {
  return {
    id: count.id,
    warehouseId: count.warehouseId,
    warehouseName: count.warehouse.name,
    status: count.status,
    lines: count.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      productName: l.variant.product.name,
      sku: l.variant.sku,
      expected: l.expected,
      counted: l.counted,
      variance: l.counted === null ? null : l.counted - l.expected,
    })),
  };
}
