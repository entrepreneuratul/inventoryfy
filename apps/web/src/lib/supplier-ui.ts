import type { BillStatus, PoStatus, PriceTrend } from '@inventoryfy/shared-types';

export function poStatusBadge(status: PoStatus): { cls: string; label: string } {
  switch (status) {
    case 'DRAFT':
      return { cls: 'tag tag-neutral', label: 'Draft' };
    case 'SENT':
      return { cls: 'tag tag-outline', label: 'Sent' };
    case 'PARTIAL':
      return { cls: 'tag tag-outline', label: 'Partially received' };
    case 'RECEIVED':
      return { cls: 'tag tag-accent', label: 'Received' };
    default:
      return { cls: 'tag tag-neutral', label: 'Closed' };
  }
}

export function billLabel(status: BillStatus): { label: string; style: React.CSSProperties } {
  switch (status) {
    case 'PAID':
      return { label: 'Paid', style: { fontSize: 11 } };
    case 'PARTIAL':
      return { label: 'Partial', style: { fontSize: 11, color: 'var(--color-accent-700)', fontWeight: 700 } };
    case 'UNPAID':
      return { label: 'Unpaid', style: { fontSize: 11, color: 'var(--color-accent-700)', fontWeight: 800 } };
    default:
      return { label: '—', style: { fontSize: 11, opacity: 0.5 } };
  }
}

export function trendMeta(trend: PriceTrend): { label: string } {
  switch (trend) {
    case 'UP':
      return { label: 'Rising' };
    case 'DOWN':
      return { label: 'Falling' };
    default:
      return { label: 'Stable' };
  }
}
