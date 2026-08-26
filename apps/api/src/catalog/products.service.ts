import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import type {
  CreateProductRequest,
  CreateVariantRequest,
  ProductDetail,
  ProductSummary,
  SetBundleComponentsRequest,
  StockStatus,
  UpdateProductRequest,
  UpdateVariantRequest,
  VariantOption,
} from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { computeBundleAvailableStock } from '../orders/stock-fulfillment';
import type { Prisma } from '../../generated/prisma/client';

const PRODUCT_WITH_VARIANTS = {
  include: {
    category: true,
    variants: { orderBy: { createdAt: 'asc' as const } },
  },
} satisfies Prisma.ProductDefaultArgs;

type ProductWithVariants = Prisma.ProductGetPayload<typeof PRODUCT_WITH_VARIANTS>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Flat "Product — Variant (SKU)" options for pickers (transfers, adjustments, batches, serials). */
  async variantOptions(businessId: string): Promise<VariantOption[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { businessId },
      include: { product: true },
      orderBy: [{ product: { name: 'asc' } }, { label: 'asc' }],
    });
    return variants.map((v) => ({ id: v.id, sku: v.sku, label: v.label, productName: v.product.name }));
  }

  async list(businessId: string, search?: string): Promise<ProductSummary[]> {
    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      ...PRODUCT_WITH_VARIANTS,
      orderBy: { name: 'asc' },
    });
    const bundleStock = await this.computeBundleStockMap(products);
    return products.map((p) => toSummary(p, bundleStock.get(p.id)));
  }

  async get(businessId: string, productId: string): Promise<ProductDetail> {
    const product = await this.findOwned(businessId, productId);
    const bundleComponents = await this.prisma.bundleComponent.findMany({
      where: { bundleProductId: productId },
      include: { componentProduct: true },
    });
    const bundleStock = product.isBundle ? await computeBundleAvailableStock(this.prisma, product.id) : undefined;
    return {
      ...toSummary(product, bundleStock),
      description: product.description,
      lowStockThreshold: product.lowStockThreshold,
      taxRatePercent: product.taxRatePercent,
      variants: product.variants.map(toVariantDto),
      bundleComponents: bundleComponents.map((bc) => ({
        id: bc.id,
        componentProductId: bc.componentProductId,
        name: bc.componentProduct.name,
        qty: bc.qty,
      })),
    };
  }

  async create(businessId: string, dto: CreateProductRequest): Promise<ProductDetail> {
    if (dto.categoryId) await this.assertCategoryOwned(businessId, dto.categoryId);
    await this.assertSkuAvailable(businessId, dto.sku);

    const product = await this.prisma.product.create({
      data: {
        businessId,
        name: dto.name,
        categoryId: dto.categoryId ?? null,
        description: dto.description ?? null,
        isBundle: dto.isBundle ?? false,
        lowStockThreshold: dto.lowStockThreshold ?? 10,
        variants: {
          create: [{ businessId, label: 'Default', sku: dto.sku, price: dto.price, stock: dto.stock ?? 0 }],
        },
      },
      ...PRODUCT_WITH_VARIANTS,
    });
    return this.get(businessId, product.id);
  }

  async update(businessId: string, productId: string, dto: UpdateProductRequest): Promise<ProductDetail> {
    await this.findOwned(businessId, productId);
    if (dto.categoryId) await this.assertCategoryOwned(businessId, dto.categoryId);

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        description: dto.description,
        lowStockThreshold: dto.lowStockThreshold,
        taxRatePercent: dto.taxRatePercent,
      },
    });
    return this.get(businessId, productId);
  }

  async remove(businessId: string, productId: string): Promise<void> {
    await this.findOwned(businessId, productId);
    await this.prisma.product.delete({ where: { id: productId } });
  }

  async addVariant(businessId: string, productId: string, dto: CreateVariantRequest) {
    await this.findOwned(businessId, productId);
    await this.assertSkuAvailable(businessId, dto.sku);
    await this.prisma.productVariant.create({
      data: { businessId, productId, label: dto.label, sku: dto.sku, price: dto.price, stock: dto.stock ?? 0 },
    });
    return this.get(businessId, productId);
  }

  async updateVariant(businessId: string, productId: string, variantId: string, dto: UpdateVariantRequest) {
    await this.findOwned(businessId, productId);
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) throw new NotFoundException('Variant not found');
    if (dto.sku && dto.sku !== variant.sku) await this.assertSkuAvailable(businessId, dto.sku);

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { label: dto.label, sku: dto.sku, price: dto.price, stock: dto.stock },
    });
    return this.get(businessId, productId);
  }

  async removeVariant(businessId: string, productId: string, variantId: string) {
    const product = await this.findOwned(businessId, productId);
    if (product.variants.length <= 1) {
      throw new BadRequestException('A product must have at least one variant');
    }
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) throw new NotFoundException('Variant not found');
    await this.prisma.productVariant.delete({ where: { id: variantId } });
    return this.get(businessId, productId);
  }

  async setBundleComponents(businessId: string, productId: string, dto: SetBundleComponentsRequest) {
    const product = await this.findOwned(businessId, productId);
    if (!product.isBundle) throw new BadRequestException('Product is not a bundle');
    if (dto.components.some((c) => c.componentProductId === productId)) {
      throw new BadRequestException('A bundle cannot contain itself');
    }
    for (const c of dto.components) {
      await this.findOwned(businessId, c.componentProductId);
    }

    await this.prisma.$transaction([
      this.prisma.bundleComponent.deleteMany({ where: { bundleProductId: productId } }),
      ...dto.components.map((c) =>
        this.prisma.bundleComponent.create({
          data: { bundleProductId: productId, componentProductId: c.componentProductId, qty: c.qty },
        }),
      ),
    ]);
    return this.get(businessId, productId);
  }

  async exportCsv(businessId: string): Promise<string> {
    const products = await this.list(businessId);
    const rows = products.map((p) => ({
      name: p.name,
      sku: p.sku,
      category: p.category ?? '',
      stock: p.stock,
      variants: p.variantCount,
      status: p.status,
    }));
    return stringify(rows, { header: true, columns: ['name', 'sku', 'category', 'stock', 'variants', 'status'] });
  }

  async importCsv(businessId: string, buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    let records: Record<string, string>[];
    try {
      records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch {
      throw new BadRequestException('Could not parse CSV file');
    }

    const errors: string[] = [];
    let imported = 0;
    for (const [i, row] of records.entries()) {
      const line = i + 2; // account for header row
      const name = row.name?.trim();
      const sku = row.sku?.trim();
      const price = Number(row.price ?? 0);
      const stock = Number(row.stock ?? 0);

      if (!name || !sku) {
        errors.push(`Line ${line}: missing name or sku`);
        continue;
      }
      if (Number.isNaN(price) || Number.isNaN(stock)) {
        errors.push(`Line ${line}: price/stock must be numbers`);
        continue;
      }

      const existingVariant = await this.prisma.productVariant.findUnique({
        where: { businessId_sku: { businessId, sku } },
      });
      if (existingVariant) {
        await this.prisma.productVariant.update({ where: { id: existingVariant.id }, data: { price, stock } });
      } else {
        let categoryId: string | undefined;
        if (row.category?.trim()) {
          const category = await this.prisma.category.upsert({
            where: { businessId_name: { businessId, name: row.category.trim() } },
            update: {},
            create: { businessId, name: row.category.trim() },
          });
          categoryId = category.id;
        }
        await this.prisma.product.create({
          data: {
            businessId,
            name,
            categoryId,
            variants: { create: [{ businessId, label: 'Default', sku, price, stock }] },
          },
        });
      }
      imported++;
    }

    return { imported, errors };
  }

  /** Batch-computes real component-derived availability for every bundle
   * product in the given set — a bundle's own ProductVariant.stock is
   * never meaningful (see computeBundleAvailableStock's doc comment), so
   * list()/get() must substitute this instead of the raw column. */
  private async computeBundleStockMap(products: { id: string; isBundle: boolean }[]): Promise<Map<string, number>> {
    const bundleIds = products.filter((p) => p.isBundle).map((p) => p.id);
    const entries = await Promise.all(
      bundleIds.map(async (id) => [id, await computeBundleAvailableStock(this.prisma, id)] as const),
    );
    return new Map(entries);
  }

  private async findOwned(businessId: string, productId: string): Promise<ProductWithVariants> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, ...PRODUCT_WITH_VARIANTS });
    if (!product || product.businessId !== businessId) throw new NotFoundException('Product not found');
    return product;
  }

  private async assertCategoryOwned(businessId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.businessId !== businessId) throw new NotFoundException('Category not found');
  }

  private async assertSkuAvailable(businessId: string, sku: string) {
    const existing = await this.prisma.productVariant.findUnique({ where: { businessId_sku: { businessId, sku } } });
    if (existing) throw new ConflictException(`SKU "${sku}" is already in use`);
  }
}

function stockStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= threshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/** `bundleStock`, when given, overrides the raw variant-sum for a bundle
 * product with its real component-derived availability (see
 * computeBundleAvailableStock's doc comment) — callers compute it via
 * ProductsService.computeBundleStockMap or computeBundleAvailableStock
 * directly since it needs a Prisma lookup this function can't do itself. */
function toSummary(product: ProductWithVariants, bundleStock?: number): ProductSummary {
  const stock = product.isBundle ? (bundleStock ?? 0) : product.variants.reduce((sum, v) => sum + v.stock, 0);
  return {
    id: product.id,
    name: product.name,
    sku: product.variants[0]?.sku ?? '',
    category: product.category?.name ?? null,
    variantCount: product.variants.length,
    stock,
    status: stockStatus(stock, product.lowStockThreshold),
    isBundle: product.isBundle,
  };
}

function toVariantDto(variant: ProductWithVariants['variants'][number]) {
  return {
    id: variant.id,
    label: variant.label,
    sku: variant.sku,
    price: Number(variant.price),
    stock: variant.stock,
  };
}
