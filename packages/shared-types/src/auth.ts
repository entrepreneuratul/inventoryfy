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
