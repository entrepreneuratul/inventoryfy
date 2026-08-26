import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MembershipRole, MembershipStatus } from '../../../generated/prisma/enums';
import { RequestUser } from '../types';

/**
 * Guards any route with a `:businessId` param. Staff must be scoped to
 * exactly that business; owners must hold an active OWNER membership on it.
 * This is the check every future domain module (catalog, orders, POs, ...)
 * should sit behind for its business-scoped routes.
 */
@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;
    const businessId: string | undefined = request.params?.businessId;

    if (!businessId) {
      throw new ForbiddenException('Route is missing a businessId param');
    }

    if (user.role === MembershipRole.STAFF) {
      if (user.businessId !== businessId) {
        throw new ForbiddenException('No access to this business');
      }
      return true;
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: user.id, businessId } },
    });
    if (!membership || membership.role !== MembershipRole.OWNER || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('No access to this business');
    }
    return true;
  }
}
