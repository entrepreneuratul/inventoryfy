import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Capability } from '@inventoryfy/shared-types';
import { CAPABILITY_MATRIX } from '../capability-matrix';
import { CAPABILITY_KEY } from '../decorators/require-capability.decorator';
import { RequestUser } from '../types';

/** Checks the current session's teamRole against CAPABILITY_MATRIX for the
 * route's @RequireCapability(...). Applied to a representative set of
 * high-value routes (team management, PO approval, financials, catalog
 * writes) rather than exhaustively on every endpoint — see README. */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user: RequestUser = context.switchToHttp().getRequest().user;
    if (!CAPABILITY_MATRIX[required].includes(user.teamRole)) {
      throw new ForbiddenException(`Your role doesn't include: ${required.toLowerCase().replace(/_/g, ' ')}`);
    }
    return true;
  }
}
