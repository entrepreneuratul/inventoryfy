import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateSupplierRequest,
  LinkedSupplierRow,
  LinkSupplierRequest,
  PriceTrend,
  SupplierCard,
  SupplierDetail,
} from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { PoStatus } from '../../generated/prisma/enums';
import { fmtMoney } from './po-format';

const TREND_THRESHOLD = 0.02; // 2% move between the last two POs counts as a trend

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<SupplierCard[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { businessId },
      include: { linkedProducts: true, purchaseOrders: { include: { items: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      onTimePercent: onTimePercent(s.purchaseOrders),
      trend: priceTrend(s.purchaseOrders),
      productsCount: s.linkedProducts.length,
    }));
  }

  async create(businessId: string, dto: CreateSupplierRequest): Promise<SupplierCard> {
    const supplier = await this.prisma.supplier.create({
      data: { businessId, name: dto.name, category: dto.category ?? null, leadTimeDays: dto.leadTimeDays ?? 7 },
    });
    return { id: supplier.id, name: supplier.name, category: supplier.category, onTimePercent: 100, trend: 'STABLE', productsCount: 0 };
  }

  async get(businessId: string, supplierId: string): Promise<SupplierDetail> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        linkedProducts: true,
        purchaseOrders: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!supplier || supplier.businessId !== businessId) throw new NotFoundException('Supplier not found');

    return {
      id: supplier.id,
      name: supplier.name,
      category: supplier.category,
      onTimePercent: onTimePercent(supplier.purchaseOrders),
      trend: priceTrend([...supplier.purchaseOrders].reverse()),
      productsCount: supplier.linkedProducts.length,
      pos: supplier.purchaseOrders.map((po) => ({
        id: po.id,
        displayId: `PO-${po.number}`,
        totalFmt: fmtMoney(po.items.reduce((sum, it) => sum + it.qty * Number(it.unitCost), 0)),
        status: po.status,
        billStatus: po.billStatus,
      })),
    };
  }

  // ─── Product ↔ supplier links ───────────────────────────────────────

  async listLinkedSuppliers(businessId: string, productId: string): Promise<LinkedSupplierRow[]> {
    const links = await this.prisma.supplierProduct.findMany({
      where: { businessId, productId },
      include: { supplier: true },
      orderBy: { preferred: 'desc' },
    });
    return links.map((l) => ({
      id: l.id,
      supplierId: l.supplierId,
      name: l.supplier.name,
      costPrice: Number(l.costPrice),
      leadTimeDays: l.supplier.leadTimeDays,
      preferred: l.preferred,
    }));
  }

  async linkSupplier(businessId: string, productId: string, dto: LinkSupplierRequest): Promise<LinkedSupplierRow> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.businessId !== businessId) throw new NotFoundException('Product not found');
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || supplier.businessId !== businessId) throw new NotFoundException('Supplier not found');

    const existing = await this.prisma.supplierProduct.findUnique({
      where: { supplierId_productId: { supplierId: dto.supplierId, productId } },
    });
    if (existing) throw new ConflictException('This supplier is already linked to this product');

    if (dto.preferred) {
      await this.prisma.supplierProduct.updateMany({ where: { productId }, data: { preferred: false } });
    }

    const link = await this.prisma.supplierProduct.create({
      data: { businessId, supplierId: dto.supplierId, productId, costPrice: dto.costPrice, preferred: dto.preferred ?? false },
      include: { supplier: true },
    });
    return {
      id: link.id,
      supplierId: link.supplierId,
      name: link.supplier.name,
      costPrice: Number(link.costPrice),
      leadTimeDays: link.supplier.leadTimeDays,
      preferred: link.preferred,
    };
  }
}

type PoWithItems = { status: PoStatus; expectedDate: Date | null; receivedAt: Date | null; items: { qty: number; unitCost: unknown }[]; createdAt: Date };

function onTimePercent(pos: PoWithItems[]): number {
  const completed = pos.filter((po) => (po.status === PoStatus.RECEIVED || po.status === PoStatus.CLOSED) && po.expectedDate && po.receivedAt);
  if (completed.length === 0) return 100;
  const onTime = completed.filter((po) => dateOnly(po.receivedAt!) <= dateOnly(po.expectedDate!)).length;
  return Math.round((onTime / completed.length) * 100);
}

/** Expects POs ordered oldest → newest; compares the last two by average unit cost. */
function priceTrend(posOldestFirst: PoWithItems[]): PriceTrend {
  const withItems = posOldestFirst.filter((po) => po.items.length > 0);
  if (withItems.length < 2) return 'STABLE';
  const avg = (po: PoWithItems) => po.items.reduce((s, it) => s + Number(it.unitCost), 0) / po.items.length;
  const prev = avg(withItems[withItems.length - 2]);
  const last = avg(withItems[withItems.length - 1]);
  if (prev === 0) return 'STABLE';
  const change = (last - prev) / prev;
  if (change > TREND_THRESHOLD) return 'UP';
  if (change < -TREND_THRESHOLD) return 'DOWN';
  return 'STABLE';
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
