export type OrderChannel = 'WEBSITE' | 'AMAZON' | 'FLIPKART';
export type OrderStatus = 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'BACKORDERED';

export interface OrderRow {
  id: string;
  displayId: string;
  channel: OrderChannel;
  customer: string;
  totalFmt: string;
  status: OrderStatus;
  note: string | null;
  date: string;
  showReturn: boolean;
}

export interface OrderItemRow {
  id: string;
  variantId: string;
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  hasOpenReturn: boolean;
}

export interface OrderDetail {
  id: string;
  displayId: string;
  channel: OrderChannel;
  customer: string;
  status: OrderStatus;
  note: string | null;
  date: string;
  warehouseId: string;
  warehouseName: string;
  items: OrderItemRow[];
  total: number;
  totalFmt: string;
}

export interface CreateOrderRequest {
  channel: OrderChannel;
  customer: string;
  warehouseId: string;
  items: { variantId: string; qty: number; unitPrice: number }[];
}

// ─── Returns / RMA ──────────────────────────────────────────────────────

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'REFUNDED';

export interface ReturnRow {
  id: string;
  displayId: string;
  orderDisplayId: string;
  product: string;
  reason: string;
  status: ReturnStatus;
}

export interface ReturnDetail {
  id: string;
  displayId: string;
  orderDisplayId: string;
  orderId: string;
  product: string;
  reason: string;
  status: ReturnStatus;
  needsDecision: boolean;
  restock: boolean | null;
  restockLabel: string | null;
}

export interface CreateReturnRequest {
  orderItemId: string;
  reason: string;
}

export interface DecideReturnRequest {
  restock: boolean;
  /** Required when restock=true — which warehouse gets the stock back. */
  warehouseId?: string;
}
