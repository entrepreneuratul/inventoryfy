import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser } from '../types';

/**
 * Gate for platform-operator-only endpoints (see PlatformController) —
 * onboarding a brand-new tenant Business and granting/reassigning its
 * owner. Deliberately separate from RolesGuard/CapabilityGuard, both of
 * which check something scoped to a single business's own Membership:
 * Super Owner is a flag on the User row itself (User.isSuperOwner),
 * independent of any Membership, since these actions by definition can
 * happen before any Membership on the target business exists at all.
 *
 * Must run after JwtAuthGuard — it only reads req.user, which
 * JwtStrategy re-checks fresh from the DB on every request (so revoking
 * isSuperOwner takes effect immediately, same as suspending a
 * membership already does).
 */
@Injectable()
export class SuperOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: RequestUser = context.switchToHttp().getRequest().user;
    if (!user.isSuperOwner) {
      throw new ForbiddenException('Requires Super Owner access');
    }
    return true;
  }
}
