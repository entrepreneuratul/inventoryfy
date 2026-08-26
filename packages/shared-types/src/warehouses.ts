export interface WarehouseSummary {
  id: string;
  name: string;
  skuCount: number;
  totalUnits: number;
}

export interface CreateWarehouseRequest {
  name: string;
}

export interface VariantOption {
  id: string; // variantId
  sku: string;
  label: string;
  productName: string;
}

export interface AdjustStockRequest {
  variantId: string;
  delta: number;
}

export interface WarehouseStockRow {
  warehouseId: string;
  warehouseName: string;
  qty: number;
}

export interface ProductWarehouseBreakdown {
  warehouses: WarehouseStockRow[];
  unallocated: number;
}

export type TransferStatus = 'COMPLETED';

export interface TransferRow {
  id: string;
  productName: string;
  variantLabel: string;
  sku: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  qty: number;
  status: TransferStatus;
  createdAt: string;
}

export interface CreateTransferRequest {
  variantId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qty: number;
}

export type CycleCountStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface CycleCountLineRow {
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  expected: number;
  counted: number | null;
  variance: number | null;
}

export interface CycleCountDetail {
  id: string;
  warehouseId: string;
  warehouseName: string;
  status: CycleCountStatus;
  lines: CycleCountLineRow[];
}

export interface CycleCountSummary {
  id: string;
  warehouseName: string;
  itemsCounted: number;
  totalVariance: number;
  status: CycleCountStatus;
}

export type BatchStatus = 'FRESH' | 'EXPIRING_SOON' | 'EXPIRED';

export interface BatchRow {
  id: string;
  lotCode: string;
  productName: string;
  sku: string;
  qty: number;
  expiryDate: string | null;
  status: BatchStatus;
}

export interface CreateBatchRequest {
  variantId: string;
  lotCode: string;
  qty: number;
  expiryDate?: string | null;
}

export type SerialStatus = 'IN_STOCK' | 'SOLD' | 'RETURNED';

export interface SerialRow {
  id: string;
  serial: string;
  productName: string;
  sku: string;
  status: SerialStatus;
  warrantyUntil: string | null;
}

export interface CreateSerialRequest {
  variantId: string;
  serial: string;
  warrantyUntil?: string | null;
}
