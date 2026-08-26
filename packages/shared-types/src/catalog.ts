export interface Category {
  id: string;
  name: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  sku: string;
  price: number;
  stock: number;
}

export interface BundleComponentRow {
  id: string;
  componentProductId: string;
  name: string;
  qty: number;
}

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export interface ProductSummary {
  id: string;
  name: string;
  sku: string; // the first/default variant's SKU
  category: string | null;
  variantCount: number;
  stock: number; // sum across variants; for a bundle, real component-derived availability instead
  status: StockStatus;
  isBundle: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  lowStockThreshold: number;
  /// GST/sales-tax rate applied to this product's line items (Phase 7).
  taxRatePercent: number;
  variants: ProductVariant[];
  bundleComponents: BundleComponentRow[];
}

export interface CreateProductRequest {
  name: string;
  categoryId?: string | null;
  description?: string | null;
  isBundle?: boolean;
  lowStockThreshold?: number;
  sku: string;
  price: number;
  stock?: number;
}

export interface UpdateProductRequest {
  name?: string;
  categoryId?: string | null;
  description?: string | null;
  lowStockThreshold?: number;
  taxRatePercent?: number;
}

export interface CreateVariantRequest {
  label: string;
  sku: string;
  price: number;
  stock?: number;
}

export interface UpdateVariantRequest {
  label?: string;
  sku?: string;
  price?: number;
  stock?: number;
}

export interface SetBundleComponentsRequest {
  components: { componentProductId: string; qty: number }[];
}
