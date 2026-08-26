import { MembershipRole, TeamRole } from '../../generated/prisma/enums';

/** What a signed JWT carries. Re-validated against the DB on every request
 * (see JwtStrategy) so a suspended membership takes effect immediately
 * rather than waiting for token expiry. */
export interface JwtPayload {
  sub: string; // userId
  role: MembershipRole;
  businessId: string | null; // set for STAFF, null for OWNER
}

/** What ends up on `req.user` after the JWT strategy validates + re-checks DB.
 * `teamRole` is looked up fresh from the membership on every request (like
 * suspension), not carried in the JWT — so changing someone's team role
 * takes effect immediately, without a new login. */
export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: MembershipRole;
  teamRole: TeamRole;
  businessId: string | null;
}
