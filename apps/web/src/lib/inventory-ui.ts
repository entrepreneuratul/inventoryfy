import type { BatchStatus, CycleCountStatus, SerialStatus } from '@inventoryfy/shared-types';

export function batchStatusBadge(status: BatchStatus): { cls: string; label: string } {
  switch (status) {
    case 'EXPIRED':
      return { cls: 'tag tag-accent', label: 'Expired' };
    case 'EXPIRING_SOON':
      return { cls: 'tag tag-outline', label: 'Expiring soon' };
    default:
      return { cls: 'tag tag-neutral', label: 'Fresh' };
  }
}

export function serialStatusBadge(status: SerialStatus): { cls: string; label: string } {
  switch (status) {
    case 'SOLD':
      return { cls: 'tag tag-outline', label: 'Sold' };
    case 'RETURNED':
      return { cls: 'tag tag-accent', label: 'Returned' };
    default:
      return { cls: 'tag tag-neutral', label: 'In stock' };
  }
}

export function countStatusBadge(status: CycleCountStatus): { cls: string; label: string } {
  return status === 'IN_PROGRESS'
    ? { cls: 'tag tag-outline', label: 'In progress' }
    : { cls: 'tag tag-neutral', label: 'Completed' };
}
