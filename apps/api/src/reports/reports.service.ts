import { Injectable } from '@nestjs/common';
import type {
  DeadStockRow,
  ReportFrequency,
  ReportsData,
  ReportType,
  TurnoverRow,
  VelocityRow,
} from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialsService } from '../financials/financials.service';
import { OrderStatus, ReturnStatus } from '../../generated/prisma/enums';

const VELOCITY_WINDOW_DAYS = 30;
const TREND_THRESHOLD = 0.1; // 10% move between periods counts as a trend

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financials: FinancialsService,
  ) {}

  async compute(businessIds: string[]): Promise<ReportsData> {
    const velocities = await this.productVelocities(businessIds);
    const bestSellers: VelocityRow[] = [...velocities]
      .sort((a, b) => b.units - a.units)
      .slice(0, 5)
      .map((v) => ({ productId: v.productId, name: v.name, businessName: v.businessName, velocityLabel: `${v.units} units/mo` }));

    const deadStock: DeadStockRow[] = [...velocities]
      .filter((v) => v.stock > 0)
      .sort((a, b) => a.units - b.units)
      .slice(0, 5)
      .map((v) => ({ productId: v.productId, name: v.name, businessName: v.businessName, velocityLabel: `${v.units} units/mo`, stock: v.stock }));

    const turnover: TurnoverRow[] = [];
    for (const businessId of businessIds) {
      const business = await this.prisma.business.findUnique({ where: { id: businessId } });
      if (!business) continue;
      turnover.push({ businessId, name: business.name, ...(await this.turnoverForBusiness(businessId)) });
    }

    return { bestSellers, deadStock, turnover };
  }

  async schedule(businessId: string, reportType: ReportType, frequency: ReportFrequency, email: string) {
    return this.prisma.scheduledReport.create({ data: { businessId, reportType, frequency, email } });
  }

  async listScheduled(businessId: string) {
    return this.prisma.scheduledReport.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
  }

  private async productVelocities(
    businessIds: string[],
  ): Promise<{ productId: string; name: string; businessName: string; units: number; stock: number }[]> {
    const products = await this.prisma.product.findMany({
      where: { businessId: { in: businessIds } },
      include: { business: true, variants: true },
    });

    const since = new Date(Date.now() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { businessId: { in: businessIds }, status: OrderStatus.DELIVERED, deliveredAt: { gte: since } },
      },
      include: { returns: true, variant: true },
    });

    const soldByProduct = new Map<string, number>();
    for (const item of items) {
      if (item.returns.some((r) => r.status === ReturnStatus.REFUNDED)) continue;
      soldByProduct.set(item.variant.productId, (soldByProduct.get(item.variant.productId) ?? 0) + item.qty);
    }

    return products.map((p) => ({
      productId: p.id,
      name: p.name,
      businessName: p.business.name,
      units: soldByProduct.get(p.id) ?? 0,
      stock: p.variants.reduce((s, v) => s + v.stock, 0),
    }));
  }

  private async turnoverForBusiness(businessId: string): Promise<{ ratioLabel: string; trend: 'UP' | 'DOWN' | 'STABLE' }> {
    const inventoryValue = await this.inventoryValuation(businessId);
    if (inventoryValue <= 0) return { ratioLabel: 'N/A', trend: 'STABLE' };

    const now = Date.now();
    const period = VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const currentRevenue = await this.periodRevenue(businessId, new Date(now - period), new Date(now));
    const previousRevenue = await this.periodRevenue(businessId, new Date(now - 2 * period), new Date(now - period));

    const currentRatio = currentRevenue / inventoryValue;
    const previousRatio = previousRevenue / inventoryValue;

    let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
    if (previousRatio > 0) {
      const change = (currentRatio - previousRatio) / previousRatio;
      if (change > TREND_THRESHOLD) trend = 'UP';
      else if (change < -TREND_THRESHOLD) trend = 'DOWN';
    }

    return { ratioLabel: `${Math.round(currentRatio * 10) / 10}x`, trend };
  }

  private async inventoryValuation(businessId: string): Promise<number> {
    const products = await this.prisma.product.findMany({ where: { businessId }, select: { id: true } });
    let total = 0;
    for (const p of products) {
      const result = await this.financials.valuation(businessId, p.id, 'WEIGHTED');
      total += result.amount;
    }
    return total;
  }

  private async periodRevenue(businessId: string, from: Date, to: Date): Promise<number> {
    const orders = await this.prisma.order.findMany({
      where: { businessId, status: OrderStatus.DELIVERED, deliveredAt: { gte: from, lt: to } },
      include: { items: { include: { returns: true } } },
    });
    let revenue = 0;
    for (const order of orders) {
      for (const item of order.items) {
        if (item.returns.some((r) => r.status === ReturnStatus.REFUNDED)) continue;
        revenue += item.qty * Number(item.unitPrice);
      }
    }
    return revenue;
  }
}
