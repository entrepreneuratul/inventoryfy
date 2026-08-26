import { EventEmitter } from 'node:events';
import { Global, Injectable, Module } from '@nestjs/common';

export interface StockChangedEvent {
  businessId: string;
  variantId: string;
}

/**
 * A tiny in-process pub/sub, not a real message queue — just enough to let
 * stock-mutating services (InventoryService, OrdersService, ReturnsService,
 * PurchaseOrdersService) and IntegrationsService (Phase 10, which dispatches
 * outbound webhooks on stock change) depend on one shared, dependency-free
 * provider instead of on each other directly. Without this, wiring
 * "Warehouses needs to notify Integrations" the naive way would create a
 * module cycle (Warehouses -> Integrations -> Orders -> Warehouses).
 *
 * Callers publish only *after* their own `$transaction(...)` has resolved
 * successfully — never from inside `InventoryService.applyDelta` itself,
 * since that runs mid-transaction and the caller's transaction may still
 * roll back afterwards (see OrdersService.create's backorder fallback).
 */
@Injectable()
export class StockChangeEmitter extends EventEmitter {
  publish(event: StockChangedEvent): void {
    this.emit('changed', event);
  }

  publishMany(businessId: string, variantIds: Iterable<string>): void {
    for (const variantId of new Set(variantIds)) {
      this.publish({ businessId, variantId });
    }
  }

  onChanged(listener: (event: StockChangedEvent) => void): void {
    this.on('changed', listener);
  }
}

@Global()
@Module({
  providers: [StockChangeEmitter],
  exports: [StockChangeEmitter],
})
export class CommonModule {}
