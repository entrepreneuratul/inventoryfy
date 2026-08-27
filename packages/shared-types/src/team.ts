export type TeamRole = 'OWNER' | 'BUSINESS_ADMIN' | 'INVENTORY_MANAGER' | 'SALES_STAFF' | 'ACCOUNTANT';

export const INVITABLE_ROLES: TeamRole[] = ['BUSINESS_ADMIN', 'INVENTORY_MANAGER', 'SALES_STAFF', 'ACCOUNTANT'];

export type Capability =
  | 'VIEW_DASHBOARD'
  | 'EDIT_INVENTORY'
  | 'MANAGE_SUPPLIERS_POS'
  | 'APPROVE_POS'
  | 'VIEW_FINANCIALS'
  | 'MANAGE_TEAM'
  | 'MANAGE_INTEGRATIONS';

/** What each team role can access — mirrors the mockup's capability
 * matrix exactly (MANAGE_INTEGRATIONS added in Phase 10, following the
 * same OWNER/BUSINESS_ADMIN-only shape as MANAGE_TEAM, since a connection
 * carries an API key and a callback URL to an external system). OWNER
 * always has every capability. */
export const CAPABILITY_MATRIX: Record<Capability, TeamRole[]> = {
  VIEW_DASHBOARD: ['OWNER', 'BUSINESS_ADMIN', 'INVENTORY_MANAGER', 'SALES_STAFF', 'ACCOUNTANT'],
  EDIT_INVENTORY: ['OWNER', 'BUSINESS_ADMIN', 'INVENTORY_MANAGER'],
  MANAGE_SUPPLIERS_POS: ['OWNER', 'BUSINESS_ADMIN', 'INVENTORY_MANAGER'],
  APPROVE_POS: ['OWNER', 'BUSINESS_ADMIN'],
  VIEW_FINANCIALS: ['OWNER', 'BUSINESS_ADMIN', 'ACCOUNTANT'],
  MANAGE_TEAM: ['OWNER'],
  MANAGE_INTEGRATIONS: ['OWNER', 'BUSINESS_ADMIN'],
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  VIEW_DASHBOARD: 'View dashboard',
  EDIT_INVENTORY: 'Edit inventory',
  MANAGE_SUPPLIERS_POS: 'Manage suppliers & POs',
  APPROVE_POS: 'Approve purchase orders',
  VIEW_FINANCIALS: 'View financials',
  MANAGE_TEAM: 'Manage team',
  MANAGE_INTEGRATIONS: 'Manage integrations',
};

export const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: 'Owner',
  BUSINESS_ADMIN: 'Business Admin',
  INVENTORY_MANAGER: 'Inventory Manager',
  SALES_STAFF: 'Sales Staff',
  ACCOUNTANT: 'Accountant',
};

export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

export interface TeamMemberRow {
  membershipId: string;
  name: string;
  email: string;
  teamRole: TeamRole;
  businessName: string;
  status: MembershipStatus;
}

export interface InviteTeamMemberRequest {
  name: string;
  email: string;
  teamRole: TeamRole;
}

export interface InviteResult {
  membershipId: string;
  email: string;
  /** Shown once, for a brand-new account — there's no email infrastructure
   * to deliver it, so the inviter has to relay it themselves. Null when
   * the email already belonged to an existing user (their password is
   * unchanged; this membership just grants them access to this business). */
  temporaryPassword: string | null;
}

/** Owner-only: generates a fresh random password for a team member —
 * including the owner's own membership row, which appears in this same
 * roster. Same one-time-reveal convention as InviteResult — there's no
 * email infrastructure, so the owner relays it themselves. Unlike
 * InviteResult, always a real string: a reset always changes the
 * password, there's no "already existed" case to be null for. */
export interface ResetPasswordResult {
  email: string;
  temporaryPassword: string;
}
