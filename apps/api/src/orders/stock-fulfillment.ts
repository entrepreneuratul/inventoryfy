import { PrismaService } from '../prisma/prisma.service';

/** A line item after bundles are expanded into their components — what
 * actually needs to move in/out of a warehouse for one order. */
export interface FlatLine {
  variantId: string;
  qty: number;
}

/**
 * Expands order items into the variants that actually need stock moved:
 * a bundle line becomes one flat line per component (qty × the bundle's
 * qty), a simple product line passes through unchanged. Same-variant
 * lines are merged so each variant appears once.
 */
export async function expandToFlatLines(
  prisma: PrismaService,
  items: { variantId: string; qty: number }[],
): Promise<FlatLine[]> {
  const byVariant = new Map<string, number>();

  for (const item of items) {
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: item.variantId },
      include: {
        product: {
          include: {
            bundleComponents: {
              include: { componentProduct: { include: { variants: { orderBy: { createdAt: 'asc' } } } } },
            },
          },
        },
      },
    });

    if (variant.product.isBundle) {
      for (const component of variant.product.bundleComponents) {
        const componentVariant = component.componentProduct.variants[0];
        if (!componentVariant) continue; // shouldn't happen — every product has ≥1 variant
        const qty = component.qty * item.qty;
        byVariant.set(componentVariant.id, (byVariant.get(componentVariant.id) ?? 0) + qty);
      }
    } else {
      byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.qty);
    }
  }

  return [...byVariant.entries()].map(([variantId, qty]) => ({ variantId, qty }));
}

/**
 * How many units of a bundle Product can actually be sold right now,
 * based on current component stock — the same "first variant per
 * component product" convention expandToFlatLines uses above, so what
 * this reports as sellable always matches what a real sale would do.
 *
 * A bundle's own ProductVariant.stock is never meaningful on its own: a
 * bundle sale decrements its components (see expandToFlatLines), never
 * the bundle's own denormalized row, so that field is always stale/zero
 * for a bundle. This is the real number — introduced for Phase 10's
 * Integrations catalog/webhook, which need to report a bundle's (e.g. a
 * Ritkalp "Kit"'s) actual availability to an external storefront, not
 * its meaningless raw stock column.
 */
export async function computeBundleAvailableStock(prisma: PrismaService, bundleProductId: string): Promise<number> {
  const product = await prisma.product.findUnique({
    where: { id: bundleProductId },
    include: {
      bundleComponents: {
        include: { componentProduct: { include: { variants: { orderBy: { createdAt: 'asc' }, take: 1 } } } },
      },
    },
  });
  if (!product || !product.isBundle || product.bundleComponents.length === 0) return 0;

  let minAvailable = Infinity;
  for (const component of product.bundleComponents) {
    const componentVariant = component.componentProduct.variants[0];
    if (!componentVariant) return 0; // a component with no sellable variant at all — nothing can be built
    minAvailable = Math.min(minAvailable, Math.floor(componentVariant.stock / component.qty));
  }
  return minAvailable === Infinity ? 0 : minAvailable;
}
