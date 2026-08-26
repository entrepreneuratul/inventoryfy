import { MembershipRole } from '../../generated/prisma/enums';

/** What a signed JWT carries. Re-validated against the DB on every request
 * (see JwtStrategy) so a suspended membership takes effect immediately
 * rather than waiting for token expiry. */
export interface JwtPayload {
  sub: string; // userId
  role: MembershipRole;
  businessId: string | null; // set for STAFF, null for OWNER
}

/** What ends up on `req.user` after the JWT strategy validates + re-checks DB. */
export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: MembershipRole;
  businessId: string | null;
}
