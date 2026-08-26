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
  stock: number; // sum across variants
  status: StockStatus;
  isBundle: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  lowStockThreshold: number;
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
