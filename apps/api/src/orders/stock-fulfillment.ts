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
