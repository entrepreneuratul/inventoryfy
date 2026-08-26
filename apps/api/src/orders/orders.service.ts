import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateOrderRequest, OrderDetail, OrderRow } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../warehouses/inventory.service';
import { OrderStatus, OrderChannel, OrderPaymentStatus } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { expandToFlatLines } from './stock-fulfillment';
import { StockChangeEmitter } from '../common/stock-change-emitter';

const FIRST_ORDER_NUMBER = 5001;
const RESTOCKS_STOCK: OrderStatus[] = [OrderStatus.PROCESSING, OrderStatus.SHIPPED];

/** Set only when an order is created by IntegrationsService on behalf of an
 * external storefront (Phase 10) — not part of the public CreateOrderRequest
 * DTO, since a manually-created order in the app never has one. */
export interface OrderSource {
  connectionId: string;
  externalOrderId: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly stockEvents: StockChangeEmitter,
  ) {}

  async list(businessId: string): Promise<OrderRow[]> {
    const orders = await this.prisma.order.findMany({
      where: { businessId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toRow);
  }

  async get(businessId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.findOwned(businessId, orderId);
    return this.toDetail(order);
  }

  async create(businessId: string, dto: CreateOrderRequest, source?: OrderSource): Promise<OrderDetail> {
    if (dto.items.length === 0) throw new BadRequestException('An order needs at least one item');

    await this.assertWarehouseOwned(businessId, dto.warehouseId);
    for (const item of dto.items) {
      await this.assertVariantOwned(businessId, item.variantId);
    }

    const flatLines = await expandToFlatLines(this.prisma, dto.items);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        for (const line of flatLines) {
          await this.inventory.applyDelta(tx, businessId, dto.warehouseId, line.variantId, -line.qty);
        }
        const number = await this.nextNumber(tx, businessId);
        return tx.order.create({
          data: {
            businessId,
            number,
            channel: dto.channel,
            customer: dto.customer,
            warehouseId: dto.warehouseId,
            status: OrderStatus.PROCESSING,
            sourceConnectionId: source?.connectionId,
            externalOrderId: source?.externalOrderId,
            items: { create: dto.items.map((it) => ({ variantId: it.variantId, qty: it.qty, unitPrice: it.unitPrice })) },
          },
          include: { warehouse: true, items: { include: { variant: { include: { product: true } }, returns: true } } },
        });
      });
      this.stockEvents.publishMany(businessId, flatLines.map((l) => l.variantId));
      return this.toDetail(order);
    } catch (err) {
      if (!(err instanceof BadRequestException)) throw err;
      // Not enough stock somewhere in the flattened lines — back-order it
      // instead, with nothing decremented (the failed transaction already
      // rolled back any partial decrements). Nothing changed, so no stock
      // event is published here.
      const order = await this.prisma.$transaction(async (tx) => {
        const number = await this.nextNumber(tx, businessId);
        return tx.order.create({
          data: {
            businessId,
            number,
            channel: dto.channel,
            customer: dto.customer,
            warehouseId: dto.warehouseId,
            status: OrderStatus.BACKORDERED,
            note: 'Insufficient stock at fulfillment time',
            sourceConnectionId: source?.connectionId,
            externalOrderId: source?.externalOrderId,
            items: { create: dto.items.map((it) => ({ variantId: it.variantId, qty: it.qty, unitPrice: it.unitPrice })) },
          },
          include: { warehouse: true, items: { include: { variant: { include: { product: true } }, returns: true } } },
        });
      });
      return this.toDetail(order);
    }
  }

  async ship(businessId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.findOwned(businessId, orderId);
    if (order.status !== OrderStatus.PROCESSING) throw new BadRequestException('Only a processing order can be shipped');
    return this.toDetail(await this.updateStatus(orderId, OrderStatus.SHIPPED, { shippedAt: new Date() }));
  }

  async deliver(businessId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.findOwned(businessId, orderId);
    if (order.status !== OrderStatus.SHIPPED) throw new BadRequestException('Only a shipped order can be delivered');
    return this.toDetail(await this.updateStatus(orderId, OrderStatus.DELIVERED, { deliveredAt: new Date() }));
  }

  async cancel(businessId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.findOwned(businessId, orderId);
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('This order can no longer be cancelled');
    }

    const shouldRestore = RESTOCKS_STOCK.includes(order.status);
    let restoredVariantIds: string[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      if (shouldRestore) {
        const flatLines = await expandToFlatLines(this.prisma, order.items.map((it) => ({ variantId: it.variantId, qty: it.qty })));
        for (const line of flatLines) {
          await this.inventory.applyDelta(tx, businessId, order.warehouseId, line.variantId, line.qty);
        }
        restoredVariantIds = flatLines.map((l) => l.variantId);
      }
      return tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
        include: { warehouse: true, items: { include: { variant: { include: { product: true } }, returns: true } } },
      });
    });
    this.stockEvents.publishMany(businessId, restoredVariantIds);
    return this.toDetail(updated);
  }

  async setPaymentStatus(businessId: string, orderId: string, paymentStatus: OrderPaymentStatus): Promise<OrderDetail> {
    await this.findOwned(businessId, orderId);
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus },
      include: { warehouse: true, items: { include: { variant: { include: { product: true } }, returns: true } } },
    });
    return this.toDetail(updated);
  }

  private async updateStatus(orderId: string, status: OrderStatus, extra: Record<string, Date> = {}) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status, ...extra },
      include: { warehouse: true, items: { include: { variant: { include: { product: true } }, returns: true } } },
    });
  }

  private async nextNumber(tx: Prisma.TransactionClient, businessId: string): Promise<number> {
    const last = await tx.order.findFirst({ where: { businessId }, orderBy: { number: 'desc' } });
    return (last?.number ?? FIRST_ORDER_NUMBER - 1) + 1;
  }

  private async findOwned(businessId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { warehouse: true, items: { include: { variant: { include: { product: true } }, returns: true } } },
    });
    if (!order || order.businessId !== businessId) throw new NotFoundException('Order not found');
    return order;
  }

  private async assertWarehouseOwned(businessId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.businessId !== businessId) throw new NotFoundException('Warehouse not found');
  }

  private async assertVariantOwned(businessId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.businessId !== businessId) throw new NotFoundException('Variant not found');
  }

  private toDetail(order: OrderWithDetail): OrderDetail {
    const items = order.items.map((it) => ({
      id: it.id,
      variantId: it.variantId,
      productId: it.variant.product.id,
      name: it.variant.product.name,
      sku: it.variant.sku,
      qty: it.qty,
      unitPrice: Number(it.unitPrice),
      lineTotal: it.qty * Number(it.unitPrice),
      hasOpenReturn: it.returns.length > 0,
    }));
    const total = items.reduce((sum, it) => sum + it.lineTotal, 0);
    return {
      id: order.id,
      displayId: `ORD-${order.number}`,
      channel: order.channel,
      customer: order.customer,
      status: order.status,
      paymentStatus: order.paymentStatus,
      note: order.note,
      date: order.createdAt.toISOString().slice(0, 10),
      warehouseId: order.warehouseId,
      warehouseName: order.warehouse.name,
      items,
      total,
      totalFmt: `$${total.toFixed(2)}`,
    };
  }
}

type OrderWithDetail = {
  id: string;
  number: number;
  channel: OrderChannel;
  customer: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  note: string | null;
  createdAt: Date;
  warehouseId: string;
  warehouse: { name: string };
  items: {
    id: string;
    variantId: string;
    qty: number;
    unitPrice: unknown;
    variant: { sku: string; product: { id: string; name: string } };
    returns: unknown[];
  }[];
};

function toRow(order: { id: string; number: number; channel: OrderChannel; customer: string; status: OrderStatus; paymentStatus: OrderPaymentStatus; note: string | null; createdAt: Date; items: { qty: number; unitPrice: unknown }[] }): OrderRow {
  const total = order.items.reduce((sum, it) => sum + it.qty * Number(it.unitPrice), 0);
  return {
    id: order.id,
    displayId: `ORD-${order.number}`,
    channel: order.channel,
    customer: order.customer,
    totalFmt: `$${total.toFixed(2)}`,
    status: order.status,
    paymentStatus: order.paymentStatus,
    note: order.note,
    date: order.createdAt.toISOString().slice(0, 10),
    showReturn: order.status === OrderStatus.DELIVERED,
  };
}
