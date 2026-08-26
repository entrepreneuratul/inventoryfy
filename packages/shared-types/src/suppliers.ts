export type PriceTrend = 'UP' | 'DOWN' | 'STABLE';

export interface SupplierCard {
  id: string;
  name: string;
  category: string | null;
  onTimePercent: number;
  trend: PriceTrend;
  productsCount: number;
}

export interface SupplierPoRow {
  id: string;
  displayId: string;
  totalFmt: string;
  status: PoStatus;
  billStatus: BillStatus;
}

export interface SupplierDetail {
  id: string;
  name: string;
  category: string | null;
  onTimePercent: number;
  trend: PriceTrend;
  productsCount: number;
  pos: SupplierPoRow[];
}

export interface CreateSupplierRequest {
  name: string;
  category?: string | null;
  leadTimeDays?: number;
}

export interface LinkedSupplierRow {
  id: string; // SupplierProduct id
  supplierId: string;
  name: string;
  costPrice: number;
  leadTimeDays: number;
  preferred: boolean;
}

export interface LinkSupplierRequest {
  supplierId: string;
  costPrice: number;
  preferred?: boolean;
}

// ─── Purchase orders ────────────────────────────────────────────────────

export type PoStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CLOSED';
export type BillStatus = 'NONE' | 'UNPAID' | 'PARTIAL' | 'PAID';

export interface PoCard {
  id: string;
  displayId: string;
  supplierName: string;
  totalFmt: string;
}

export interface PoColumn {
  status: PoStatus;
  label: string;
  count: number;
  items: PoCard[];
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  expectedDate?: string | null;
  items: { variantId: string; qty: number; unitCost: number }[];
}

export interface PurchaseOrderItemRow {
  id: string;
  variantId: string;
  name: string;
  sku: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
  receivedQty: number;
}

export interface PurchaseOrderDetail {
  id: string;
  displayId: string;
  status: PoStatus;
  billStatus: BillStatus;
  supplierId: string;
  supplierName: string;
  expectedDate: string | null;
  items: PurchaseOrderItemRow[];
  total: number;
  totalFmt: string;
  needsApproval: boolean;
}

export interface ReceivePoRequest {
  warehouseId: string;
  lines: { itemId: string; receivedQty: number }[];
}

export interface ReorderSuggestion {
  productId: string;
  variantId: string;
  name: string;
  stock: number;
  threshold: number;
  preferredSupplierId: string | null;
  preferredSupplierName: string | null;
}
