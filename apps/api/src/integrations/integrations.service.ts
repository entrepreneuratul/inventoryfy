import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import type {
  CreateIntegrationConnectionResult,
  ExternalCatalogItem,
  IntegrationConnectionRow,
  IntegrationEventRow,
  InventoryUpdatedWebhookPayload,
  ReceiveExternalOrderResult,
} from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { computeBundleAvailableStock } from '../orders/stock-fulfillment';
import { StockChangeEmitter } from '../common/stock-change-emitter';
import {
  IntegrationConnectionStatus,
  IntegrationDirection,
  IntegrationEventStatus,
  IntegrationEventType,
  OrderChannel,
} from '../../generated/prisma/enums';
import type { IntegrationConnection, Prisma } from '../../generated/prisma/client';
import { CreateIntegrationConnectionDto, ReceiveExternalOrderDto } from './dto/integration.dto';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// Delay before each outbound webhook attempt (first is immediate). Kept
// short — this is a local demo, not a queue-backed retry system; real
// infrastructure would push this onto a durable retry queue instead.
const RETRY_DELAYS_MS = [0, 300, 1200];

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly stockEvents: StockChangeEmitter,
  ) {}

  /** Subscribes once at boot to every stock change anywhere in the app —
   * a sale on another channel, a PO receipt, a return, a manual count —
   * and fans it out to every ACTIVE connection on that business. This is
   * what actually keeps multiple storefronts converged on one truth. */
  onModuleInit(): void {
    this.stockEvents.onChanged(({ businessId, variantId }) => {
      this.dispatchStockChanged(businessId, variantId).catch((err) => {
        this.logger.warn(`Stock-changed dispatch failed: ${err instanceof Error ? err.message : err}`);
      });
    });
  }

  // ─── Admin (authenticated) ─────────────────────────────────────────

  async list(businessId: string): Promise<IntegrationConnectionRow[]> {
    const connections = await this.prisma.integrationConnection.findMany({
      where: { businessId },
      include: { warehouse: true },
      orderBy: { createdAt: 'desc' },
    });
    return connections.map(toRow);
  }

  async create(businessId: string, dto: CreateIntegrationConnectionDto): Promise<CreateIntegrationConnectionResult> {
    await this.assertWarehouseOwned(businessId, dto.defaultWarehouseId);

    const apiKey = `sk_live_${randomBytes(24).toString('base64url')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    const apiKeyLastFour = apiKey.slice(-4);
    const webhookSecret = randomBytes(24).toString('hex');

    const connection = await this.prisma.integrationConnection.create({
      data: {
        businessId,
        name: dto.name,
        webhookUrl: dto.webhookUrl,
        defaultWarehouseId: dto.defaultWarehouseId,
        apiKeyHash,
        apiKeyLastFour,
        webhookSecret,
      },
      include: { warehouse: true },
    });

    return { connection: toRow(connection), apiKey, webhookSecret };
  }

  async toggleStatus(businessId: string, id: string): Promise<IntegrationConnectionRow> {
    const connection = await this.findOwned(businessId, id);
    const next =
      connection.status === IntegrationConnectionStatus.ACTIVE
        ? IntegrationConnectionStatus.PAUSED
        : IntegrationConnectionStatus.ACTIVE;
    const updated = await this.prisma.integrationConnection.update({
      where: { id },
      data: { status: next },
      include: { warehouse: true },
    });
    return toRow(updated);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findOwned(businessId, id);
    await this.prisma.integrationConnection.delete({ where: { id } });
  }

  async events(businessId: string): Promise<IntegrationEventRow[]> {
    const events = await this.prisma.integrationEventLog.findMany({
      where: { businessId },
      include: { connection: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return events.map((e) => ({
      id: e.id,
      connectionName: e.connection.name,
      direction: e.direction,
      eventType: e.eventType,
      status: e.status,
      errorMessage: e.errorMessage,
      attempts: e.attempts,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  // ─── Public (API-key authenticated — called by external storefronts) ─

  async catalog(connection: IntegrationConnection): Promise<ExternalCatalogItem[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { businessId: connection.businessId },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // A bundle's own ProductVariant.stock is never meaningful (see
    // computeBundleAvailableStock's doc comment) — compute the real,
    // component-derived number for each bundle product represented here.
    const bundleProductIds = [...new Set(variants.filter((v) => v.product.isBundle).map((v) => v.productId))];
    const bundleStock = new Map(
      await Promise.all(bundleProductIds.map(async (id) => [id, await computeBundleAvailableStock(this.prisma, id)] as const)),
    );

    return variants.map((v) => ({
      sku: v.sku,
      name: v.label && v.label !== 'Default' ? `${v.product.name} — ${v.label}` : v.product.name,
      price: Number(v.price),
      availableStock: v.product.isBundle ? (bundleStock.get(v.productId) ?? 0) : v.stock,
      isBundle: v.product.isBundle,
      category: v.product.category?.name ?? null,
    }));
  }

  async receiveOrder(connection: IntegrationConnection, dto: ReceiveExternalOrderDto): Promise<ReceiveExternalOrderResult> {
    // Idempotency: a redelivered webhook for an externalOrderId we've
    // already turned into a real order is a no-op, not a duplicate sale.
    const existing = await this.prisma.order.findUnique({
      where: { sourceConnectionId_externalOrderId: { sourceConnectionId: connection.id, externalOrderId: dto.externalOrderId } },
    });
    if (existing) {
      return { orderId: existing.id, displayId: `ORD-${existing.number}`, status: existing.status, accepted: true };
    }

    const items: { variantId: string; qty: number; unitPrice: number }[] = [];
    for (const line of dto.items) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { businessId_sku: { businessId: connection.businessId, sku: line.sku } },
      });
      if (!variant) {
        await this.logEvent(connection, IntegrationDirection.INBOUND, IntegrationEventType.ORDER_RECEIVED, IntegrationEventStatus.FAILED, dto, `Unknown SKU: ${line.sku}`);
        throw new BadRequestException(`Unknown SKU: ${line.sku}`);
      }
      items.push({ variantId: variant.id, qty: line.quantity, unitPrice: Number(variant.price) });
    }

    // Inventoryfy is authoritative on price too — the storefront sends
    // quantities, not prices, same as it would to any real inventory
    // platform it's a channel of.
    const order = await this.orders.create(
      connection.businessId,
      { channel: OrderChannel.WEBSITE, customer: dto.customerName ?? connection.name, warehouseId: connection.defaultWarehouseId, items },
      { connectionId: connection.id, externalOrderId: dto.externalOrderId },
    );

    await this.logEvent(connection, IntegrationDirection.INBOUND, IntegrationEventType.ORDER_RECEIVED, IntegrationEventStatus.SUCCESS, dto, null);

    return { orderId: order.id, displayId: order.displayId, status: order.status, accepted: true };
  }

  /** Lets a storefront cancel an order *it created* (e.g. releasing
   * stock for an abandoned/failed checkout) without a real Inventoryfy
   * login — reuses OrdersService.cancel(), so restocking follows the
   * exact same rules as cancelling from the app itself (only a
   * PROCESSING/SHIPPED order actually restores stock; a BACKORDERED one
   * had nothing decremented to restore). Scoped to the calling
   * connection: orderId belonging to a *different* connection (or not
   * an integration order at all) 404s, same as if it didn't exist —
   * never leaks whether some other connection's order id is valid. */
  async cancelOrder(connection: IntegrationConnection, orderId: string): Promise<ReceiveExternalOrderResult> {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing || existing.sourceConnectionId !== connection.id) {
      await this.logEvent(connection, IntegrationDirection.INBOUND, IntegrationEventType.ORDER_CANCELLED, IntegrationEventStatus.FAILED, { orderId }, 'No order found for this connection');
      throw new NotFoundException('No order found for this connection');
    }

    const cancelled = await this.orders.cancel(connection.businessId, existing.id);
    await this.logEvent(connection, IntegrationDirection.INBOUND, IntegrationEventType.ORDER_CANCELLED, IntegrationEventStatus.SUCCESS, { orderId }, null);

    return { orderId: cancelled.id, displayId: cancelled.displayId, status: cancelled.status, accepted: true };
  }

  // ─── Outbound dispatch ─────────────────────────────────────────────

  private async dispatchStockChanged(businessId: string, variantId: string): Promise<void> {
    const connections = await this.prisma.integrationConnection.findMany({
      where: { businessId, status: IntegrationConnectionStatus.ACTIVE },
    });
    if (connections.length === 0) return;

    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
    if (!variant) return;

    // Normally only a real (non-bundle) variant is ever published here —
    // but ProductsService.setBundleComponents also publishes the
    // bundle's own variant directly (its derived availability just
    // changed), so this needs the same computed-not-raw-column handling
    // catalog() already has.
    const ownAvailableStock = variant.product.isBundle
      ? await computeBundleAvailableStock(this.prisma, variant.productId)
      : variant.stock;

    const payloads: InventoryUpdatedWebhookPayload[] = [
      {
        eventType: 'inventory.updated',
        sku: variant.sku,
        productName: variant.product.name,
        availableStock: ownAvailableStock,
        price: Number(variant.price),
        timestamp: new Date().toISOString(),
      },
    ];

    // Cascade to any bundle that includes this variant's product as a
    // component — a shared component (Ritkalp's कलश, used across three
    // Kits) going low needs to be visible on every bundle that uses it,
    // not just on its own SKU. Only cascades if this is the variant a
    // bundle sale would actually consume (expandToFlatLines always uses
    // a component product's first variant) — a change to some other
    // variant of the same product doesn't affect any bundle's math.
    const firstVariant = await this.prisma.productVariant.findFirst({
      where: { productId: variant.productId },
      orderBy: { createdAt: 'asc' },
    });
    if (firstVariant?.id === variant.id) {
      const affectedBundleLinks = await this.prisma.bundleComponent.findMany({
        where: { componentProductId: variant.productId },
        include: {
          bundleProduct: { include: { variants: { orderBy: { createdAt: 'asc' }, take: 1 } } },
        },
      });
      for (const link of affectedBundleLinks) {
        const bundleVariant = link.bundleProduct.variants[0];
        if (!bundleVariant) continue;
        payloads.push({
          eventType: 'inventory.updated',
          sku: bundleVariant.sku,
          productName: link.bundleProduct.name,
          availableStock: await computeBundleAvailableStock(this.prisma, link.bundleProductId),
          price: Number(bundleVariant.price),
          timestamp: new Date().toISOString(),
        });
      }
    }

    await Promise.all(connections.flatMap((connection) => payloads.map((payload) => this.deliverWebhook(connection, payload))));
  }

  private async deliverWebhook(connection: IntegrationConnection, payload: InventoryUpdatedWebhookPayload): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', connection.webhookSecret).update(body).digest('hex');
    let lastError: string | null = null;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (RETRY_DELAYS_MS[attempt] > 0) await sleep(RETRY_DELAYS_MS[attempt]);
      try {
        const res = await fetch(connection.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Inventoryfy-Signature': signature },
          body,
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) throw new Error(`Storefront responded ${res.status}`);
        await this.logEvent(connection, IntegrationDirection.OUTBOUND, IntegrationEventType.INVENTORY_UPDATED, IntegrationEventStatus.SUCCESS, payload, null, attempt + 1);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    await this.logEvent(connection, IntegrationDirection.OUTBOUND, IntegrationEventType.INVENTORY_UPDATED, IntegrationEventStatus.FAILED, payload, lastError, RETRY_DELAYS_MS.length);
  }

  private async logEvent(
    connection: { id: string; businessId: string },
    direction: IntegrationDirection,
    eventType: IntegrationEventType,
    status: IntegrationEventStatus,
    payload: unknown,
    errorMessage: string | null,
    attempts = 1,
  ): Promise<void> {
    await this.prisma.integrationEventLog.create({
      data: {
        businessId: connection.businessId,
        connectionId: connection.id,
        direction,
        eventType,
        status,
        payload: payload as Prisma.InputJsonValue,
        errorMessage,
        attempts,
      },
    });
  }

  private async findOwned(businessId: string, id: string): Promise<IntegrationConnection> {
    const connection = await this.prisma.integrationConnection.findUnique({ where: { id } });
    if (!connection || connection.businessId !== businessId) throw new NotFoundException('Connection not found');
    return connection;
  }

  private async assertWarehouseOwned(businessId: string, warehouseId: string): Promise<void> {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.businessId !== businessId) throw new NotFoundException('Warehouse not found');
  }
}

function toRow(connection: IntegrationConnection & { warehouse: { name: string } }): IntegrationConnectionRow {
  return {
    id: connection.id,
    name: connection.name,
    status: connection.status,
    apiKeyMasked: `sk_live_...${connection.apiKeyLastFour}`,
    webhookUrl: connection.webhookUrl,
    defaultWarehouseId: connection.defaultWarehouseId,
    defaultWarehouseName: connection.warehouse.name,
    createdAt: connection.createdAt.toISOString(),
  };
}
