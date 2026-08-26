// Phase 10: Integrations — an independently-run external storefront syncs
// stock with Inventoryfy over a generic API-key + webhook contract, the
// same shape as connecting a channel to a third-party inventory platform
// like Zoho Inventory. Inventoryfy stays the single source of truth.

export type IntegrationConnectionStatus = 'ACTIVE' | 'PAUSED';

export interface IntegrationConnectionRow {
  id: string;
  name: string;
  status: IntegrationConnectionStatus;
  /** Masked for display, e.g. "sk_live_...ab12" — the full key is never
   * shown again after creation. */
  apiKeyMasked: string;
  webhookUrl: string;
  defaultWarehouseId: string;
  defaultWarehouseName: string;
  createdAt: string;
}

export interface CreateIntegrationConnectionRequest {
  name: string;
  webhookUrl: string;
  defaultWarehouseId: string;
}

export interface CreateIntegrationConnectionResult {
  connection: IntegrationConnectionRow;
  /** The plaintext API key — shown exactly once. Inventoryfy only ever
   * stores its hash, so relay this to the storefront now or it's gone. */
  apiKey: string;
  /** The plaintext webhook signing secret, same one-time-reveal rule. */
  webhookSecret: string;
}

export type IntegrationDirection = 'INBOUND' | 'OUTBOUND';
export type IntegrationEventType = 'ORDER_RECEIVED' | 'ORDER_CANCELLED' | 'INVENTORY_UPDATED';
export type IntegrationEventStatus = 'SUCCESS' | 'FAILED';

export interface IntegrationEventRow {
  id: string;
  connectionName: string;
  direction: IntegrationDirection;
  eventType: IntegrationEventType;
  status: IntegrationEventStatus;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
}

// ─── The public contract an external storefront actually calls ───────────
// (Authorization: Bearer <apiKey>, against /integrations/v1/*)

export interface ExternalCatalogItem {
  sku: string;
  name: string;
  price: number;
  availableStock: number;
}

export interface ExternalOrderItem {
  sku: string;
  quantity: number;
}

export interface ReceiveExternalOrderRequest {
  /** The storefront's own order id — Inventoryfy uses this for
   * idempotency, so a retried delivery never double-decrements stock. */
  externalOrderId: string;
  customerName?: string;
  items: ExternalOrderItem[];
}

export interface ReceiveExternalOrderResult {
  orderId: string;
  displayId: string;
  status: string;
  accepted: boolean;
}

/** Lets a storefront cancel an order *it created* — e.g. releasing stock
 * for an abandoned/failed checkout — without needing a real Inventoryfy
 * login. `orderId` is Inventoryfy's own order id, the same one returned
 * in `ReceiveExternalOrderResult.orderId` when the order was created —
 * the storefront already has it, no need to also persist its own
 * externalOrderId just to cancel later. Scoped to the calling
 * connection: an orderId belonging to a *different* connection 404s,
 * same as if it didn't exist. */
export interface CancelExternalOrderRequest {
  orderId: string;
}

/** The body Inventoryfy POSTs to a connection's webhookUrl whenever stock
 * for one of its variants changes, from any source. Signed with
 * `X-Inventoryfy-Signature: <hex hmac-sha256 of the JSON body, using the
 * connection's webhookSecret>` so the storefront can verify authenticity. */
export interface InventoryUpdatedWebhookPayload {
  eventType: 'inventory.updated';
  sku: string;
  productName: string;
  availableStock: number;
  /** Inventoryfy is canonical on price too (not just stock) — included
   * here so a connected storefront's mirrored price never goes stale
   * after the first sync. Fired on any price OR stock change to this
   * SKU, despite the event name (kept as "inventory.updated" rather
   * than introducing a second event type, since a storefront reacts to
   * both the same way: update its local mirror). */
  price: number;
  timestamp: string;
}
