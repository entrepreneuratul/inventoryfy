import type { OrderChannel, OrderStatus, ReturnStatus } from '@inventoryfy/shared-types';

export function orderStatusBadge(status: OrderStatus): { cls: string; label: string } {
  switch (status) {
    case 'PROCESSING':
      return { cls: 'tag tag-outline', label: 'Processing' };
    case 'SHIPPED':
      return { cls: 'tag tag-outline', label: 'Shipped' };
    case 'DELIVERED':
      return { cls: 'tag tag-accent', label: 'Delivered' };
    case 'CANCELLED':
      return { cls: 'tag tag-neutral', label: 'Cancelled' };
    default:
      return { cls: 'tag tag-outline', label: 'Backordered' };
  }
}

export function returnStatusBadge(status: ReturnStatus): { cls: string; label: string } {
  switch (status) {
    case 'REQUESTED':
      return { cls: 'tag tag-neutral', label: 'Requested' };
    case 'APPROVED':
      return { cls: 'tag tag-outline', label: 'Approved' };
    case 'RECEIVED':
      return { cls: 'tag tag-outline', label: 'Received' };
    default:
      return { cls: 'tag tag-accent', label: 'Refunded' };
  }
}

export function channelLabel(channel: OrderChannel): string {
  switch (channel) {
    case 'AMAZON':
      return 'Amazon';
    case 'FLIPKART':
      return 'Flipkart';
    default:
      return 'Website';
  }
}
