import type { MembershipStatus } from '@inventoryfy/shared-types';

export function membershipStatusBadge(status: MembershipStatus): { cls: string; label: string } {
  switch (status) {
    case 'INVITED':
      return { cls: 'tag tag-outline', label: 'Invited' };
    case 'SUSPENDED':
      return { cls: 'tag tag-accent', label: 'Suspended' };
    default:
      return { cls: 'tag tag-neutral', label: 'Active' };
  }
}

export function roleBadgeClass(teamRole: string): string {
  if (teamRole === 'OWNER') return 'tag tag-accent';
  if (teamRole === 'BUSINESS_ADMIN') return 'tag tag-outline';
  return 'tag tag-neutral';
}
