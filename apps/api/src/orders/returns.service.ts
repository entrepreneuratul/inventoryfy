import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateReturnRequest, DecideReturnRequest, ReturnDetail, ReturnRow } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../warehouses/inventory.service';
import { OrderStatus, ReturnStatus } from '../../generated/prisma/enums';
import { expandToFlatLines } from './stock-fulfillment';
import { StockChangeEmitter } from '../common/stock-change-emitter';

const FIRST_RETURN_NUMBER = 401;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly stockEvents: StockChangeEmitter,
  ) {}

  async list(businessId: string): Promise<ReturnRow[]> {
    const returns = await this.prisma.return.findMany({
      where: { businessId },
      include: { orderItem: { include: { order: true, variant: { include: { product: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return returns.map(toRow);
  }

  async get(businessId: string, returnId: string): Promise<ReturnDetail> {
    const ret = await this.findOwned(businessId, returnId);
    return toDetail(ret);
  }

  async create(businessId: string, dto: CreateReturnRequest): Promise<ReturnDetail> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { order: true, returns: true },
    });
    if (!orderItem || orderItem.order.businessId !== businessId) throw new NotFoundException('Order item not found');
    if (orderItem.order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only items from a delivered order can be returned');
    }
    if (orderItem.returns.length > 0) throw new BadRequestException('A return has already been requested for this item');

    const number = await this.nextNumber(businessId);
    const ret = await this.prisma.return.create({
      data: { businessId, number, orderItemId: dto.orderItemId, reason: dto.reason },
      include: { orderItem: { include: { order: true, variant: { include: { product: true } } } } },
    });
    return toDetail(ret);
  }

  async approve(businessId: string, returnId: string): Promise<ReturnDetail> {
    const ret = await this.findOwned(businessId, returnId);
    if (ret.status !== ReturnStatus.REQUESTED) throw new BadRequestException('Only a requested return can be approved');
    return toDetail(await this.updateStatus(returnId, ReturnStatus.APPROVED));
  }

  async markReceived(businessId: string, returnId: string): Promise<ReturnDetail> {
    const ret = await this.findOwned(businessId, returnId);
    if (ret.status !== ReturnStatus.APPROVED) throw new BadRequestException('Only an approved return can be marked received');
    return toDetail(await this.updateStatus(returnId, ReturnStatus.RECEIVED));
  }

  async decide(businessId: string, returnId: string, dto: DecideReturnRequest): Promise<ReturnDetail> {
    const ret = await this.findOwned(businessId, returnId);
    if (ret.status !== ReturnStatus.RECEIVED) throw new BadRequestException('Only a received return can be decided');
    if (dto.restock && !dto.warehouseId) throw new BadRequestException('warehouseId is required to restock');
    if (dto.warehouseId) await this.assertWarehouseOwned(businessId, dto.warehouseId);

    let restockedVariantIds: string[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.restock) {
        const flatLines = await expandToFlatLines(this.prisma, [{ variantId: ret.orderItem.variantId, qty: ret.orderItem.qty }]);
        for (const line of flatLines) {
          await this.inventory.applyDelta(tx, businessId, dto.warehouseId!, line.variantId, line.qty);
        }
        restockedVariantIds = flatLines.map((l) => l.variantId);
      }
      return tx.return.update({
        where: { id: returnId },
        data: { status: ReturnStatus.REFUNDED, restock: dto.restock, warehouseId: dto.restock ? dto.warehouseId : null, decidedAt: new Date() },
        include: { orderItem: { include: { order: true, variant: { include: { product: true } } } } },
      });
    });
    this.stockEvents.publishMany(businessId, restockedVariantIds);
    return toDetail(updated);
  }

  private async updateStatus(returnId: string, status: ReturnStatus) {
    return this.prisma.return.update({
      where: { id: returnId },
      data: { status },
      include: { orderItem: { include: { order: true, variant: { include: { product: true } } } } },
    });
  }

  private async nextNumber(businessId: string): Promise<number> {
    const last = await this.prisma.return.findFirst({ where: { businessId }, orderBy: { number: 'desc' } });
    return (last?.number ?? FIRST_RETURN_NUMBER - 1) + 1;
  }

  private async findOwned(businessId: string, returnId: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id: returnId },
      include: { orderItem: { include: { order: true, variant: { include: { product: true } } } } },
    });
    if (!ret || ret.businessId !== businessId) throw new NotFoundException('Return not found');
    return ret;
  }

  private async assertWarehouseOwned(businessId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.businessId !== businessId) throw new NotFoundException('Warehouse not found');
  }
}

type ReturnWithDetail = {
  id: string;
  number: number;
  reason: string;
  status: ReturnStatus;
  restock: boolean | null;
  orderItem: { order: { id: string; number: number }; variant: { product: { name: string } } };
};

function toRow(ret: ReturnWithDetail): ReturnRow {
  return {
    id: ret.id,
    displayId: `RMA-${ret.number}`,
    orderDisplayId: `ORD-${ret.orderItem.order.number}`,
    product: ret.orderItem.variant.product.name,
    reason: ret.reason,
    status: ret.status,
  };
}

function toDetail(ret: ReturnWithDetail): ReturnDetail {
  return {
    id: ret.id,
    displayId: `RMA-${ret.number}`,
    orderDisplayId: `ORD-${ret.orderItem.order.number}`,
    orderId: ret.orderItem.order.id,
    product: ret.orderItem.variant.product.name,
    reason: ret.reason,
    status: ret.status,
    needsDecision: ret.status === ReturnStatus.RECEIVED,
    restock: ret.restock,
    restockLabel: ret.restock === null ? null : ret.restock ? 'Restocked to sellable inventory' : 'Scrapped — not restocked',
  };
}
