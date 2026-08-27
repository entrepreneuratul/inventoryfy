// Platform-operator onboarding — a Super Owner (User.isSuperOwner) can
// create a new tenant Business and grant it an initial OWNER, without
// needing to already be a member of it, and can grant/reassign an
// owner on an existing tenant. Nothing here is reachable by a regular
// OWNER or STAFF login — see the API's SuperOwnerGuard.

export interface TenantRow {
  id: string;
  name: string;
  type: string | null;
  currency: string;
  createdAt: string;
  /** How many ACTIVE OWNER memberships this business currently has —
   * onboarding always leaves exactly 1; assigning an owner on top of
   * that makes it a co-owner, not a replacement (see AssignOwnerResult's
   * `promoted` for the one case that isn't additive: promoting an
   * existing STAFF membership in place). */
  ownerCount: number;
}

export interface OnboardTenantRequest {
  businessName: string;
  businessType?: string;
  /** Defaults to INR server-side if omitted — see PlatformService. */
  currency?: string;
  timezone?: string;
  ownerName: string;
  ownerEmail: string;
}

export interface OnboardTenantResult {
  business: TenantRow;
  ownerEmail: string;
  /** Plaintext, one-time-reveal — null if this email already belonged
   * to an existing user (same convention as InviteResult in team.ts). */
  temporaryPassword: string | null;
}

export interface AssignOwnerRequest {
  name: string;
  email: string;
}

export interface AssignOwnerResult {
  businessId: string;
  ownerEmail: string;
  temporaryPassword: string | null;
  /** True if this email already had some membership on this business
   * (most likely STAFF) that got promoted to OWNER in place, rather
   * than a brand-new grant. */
  promoted: boolean;
}
