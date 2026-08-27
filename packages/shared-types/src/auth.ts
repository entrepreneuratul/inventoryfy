import type { TeamRole } from './team';

export type MembershipRole = 'OWNER' | 'STAFF';

export interface BusinessSummary {
  id: string;
  name: string;
  type: string | null;
  currency: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /** Platform-operator flag — see PlatformModule on the API. Gates a
   * separate "Tenants" area of the app (onboarding a new business,
   * assigning its owner), unrelated to `role`/`teamRole` above, which
   * are both scoped to a single business's own Membership. Almost
   * always false. */
  isSuperOwner: boolean;
}

export interface MeResponse {
  user: AuthUser;
  role: MembershipRole;
  /** The finer-grained capability role within the current session's
   * business. OWNER logins are always 'OWNER'; STAFF logins carry
   * whatever team role their membership was invited with. */
  teamRole: TeamRole;
  /** OWNER: every business they hold an active OWNER membership on.
   *  STAFF: the single business they authenticated into. */
  businesses: BusinessSummary[];
}

export interface LoginResponse extends MeResponse {
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  role: MembershipRole;
  businessId?: string;
}
