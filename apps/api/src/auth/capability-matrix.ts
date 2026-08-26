import type { Capability, TeamRole } from '@inventoryfy/shared-types';

/**
 * Backend-local copy of @inventoryfy/shared-types' CAPABILITY_MATRIX.
 * Duplicated rather than imported at runtime: shared-types has no build
 * step (it's consumed as raw TS source, fine for Next.js's bundler, but
 * Nest's build doesn't bundle node_modules — only `import type` from that
 * package is safe here, never a real value import). This is the
 * enforcement source of truth; keep it in sync with the shared-types
 * copy the frontend renders the read-only matrix table from.
 */
export const CAPABILITY_MATRIX: Record<Capability, TeamRole[]> = {
  VIEW_DASHBOARD: ['OWNER', 'BUSINESS_ADMIN', 'INVENTORY_MANAGER', 'SALES_STAFF', 'ACCOUNTANT'],
  EDIT_INVENTORY: ['OWNER', 'BUSINESS_ADMIN', 'INVENTORY_MANAGER'],
  MANAGE_SUPPLIERS_POS: ['OWNER', 'BUSINESS_ADMIN', 'INVENTORY_MANAGER'],
  APPROVE_POS: ['OWNER', 'BUSINESS_ADMIN'],
  VIEW_FINANCIALS: ['OWNER', 'BUSINESS_ADMIN', 'ACCOUNTANT'],
  MANAGE_TEAM: ['OWNER'],
};
