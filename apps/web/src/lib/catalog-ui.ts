import type { StockStatus } from '@inventoryfy/shared-types';

export function statusBadge(status: StockStatus): { cls: string; label: string } {
  switch (status) {
    case 'OUT_OF_STOCK':
      return { cls: 'tag tag-accent', label: 'Out of stock' };
    case 'LOW_STOCK':
      return { cls: 'tag tag-outline', label: 'Low stock' };
    default:
      return { cls: 'tag tag-neutral', label: 'In stock' };
  }
}
