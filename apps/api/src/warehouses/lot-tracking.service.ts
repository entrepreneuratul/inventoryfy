import { Injectable, NotFoundException } from '@nestjs/common';
import type { BatchRow, BatchStatus, SerialRow } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';

const EXPIRING_SOON_DAYS = 30;

@Injectable()
export class LotTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Batches ────────────────────────────────────────────────────────

  async listBatches(businessId: string, productId?: string): Promise<BatchRow[]> {
    const batches = await this.prisma.batch.findMany({
      where: { businessId, ...(productId ? { variant: { productId } } : {}) },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return batches.map(toBatchRow);
  }

  async createBatch(businessId: string, variantId: string, lotCode: string, qty: number, expiryDate?: string) {
    await this.assertVariantOwned(businessId, variantId);
    const batch = await this.prisma.batch.create({
      data: { businessId, variantId, lotCode, qty, expiryDate: expiryDate ? new Date(expiryDate) : null },
      include: { variant: { include: { product: true } } },
    });
    return toBatchRow(batch);
  }

  // ─── Serial numbers ─────────────────────────────────────────────────

  async listSerials(businessId: string, productId?: string): Promise<SerialRow[]> {
    const serials = await this.prisma.serialNumber.findMany({
      where: { businessId, ...(productId ? { variant: { productId } } : {}) },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return serials.map(toSerialRow);
  }

  async createSerial(businessId: string, variantId: string, serial: string, warrantyUntil?: string) {
    await this.assertVariantOwned(businessId, variantId);
    const record = await this.prisma.serialNumber.create({
      data: { businessId, variantId, serial, warrantyUntil: warrantyUntil ? new Date(warrantyUntil) : null },
      include: { variant: { include: { product: true } } },
    });
    return toSerialRow(record);
  }

  private async assertVariantOwned(businessId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.businessId !== businessId) throw new NotFoundException('Variant not found');
  }
}

function batchStatus(expiryDate: Date | null): BatchStatus {
  if (!expiryDate) return 'FRESH';
  const daysUntil = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysUntil < 0) return 'EXPIRED';
  if (daysUntil <= EXPIRING_SOON_DAYS) return 'EXPIRING_SOON';
  return 'FRESH';
}

function toBatchRow(batch: {
  id: string;
  lotCode: string;
  qty: number;
  expiryDate: Date | null;
  variant: { sku: string; product: { name: string } };
}): BatchRow {
  return {
    id: batch.id,
    lotCode: batch.lotCode,
    productName: batch.variant.product.name,
    sku: batch.variant.sku,
    qty: batch.qty,
    expiryDate: batch.expiryDate ? batch.expiryDate.toISOString().slice(0, 10) : null,
    status: batchStatus(batch.expiryDate),
  };
}

function toSerialRow(record: {
  id: string;
  serial: string;
  status: SerialRow['status'];
  warrantyUntil: Date | null;
  variant: { sku: string; product: { name: string } };
}): SerialRow {
  return {
    id: record.id,
    serial: record.serial,
    productName: record.variant.product.name,
    sku: record.variant.sku,
    status: record.status,
    warrantyUntil: record.warrantyUntil ? record.warrantyUntil.toISOString().slice(0, 10) : null,
  };
}
