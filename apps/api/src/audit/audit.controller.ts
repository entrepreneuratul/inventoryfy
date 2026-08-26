import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { MembershipRole, MembershipStatus } from '../../generated/prisma/enums';

@Controller()
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard, BusinessAccessGuard)
  @Get('businesses/:businessId/audit')
  forBusiness(@Param('businessId') businessId: string) {
    return this.audit.list([businessId]);
  }

  /** Owner-only, cross-business — same shape as /financials/summary. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MembershipRole.OWNER)
  @Get('audit/summary')
  async ownerSummary(@CurrentUser() user: RequestUser) {
    const businessIds = await this.ownedBusinessIds(user.id);
    return this.audit.list(businessIds);
  }

  private async ownedBusinessIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
      select: { businessId: true },
    });
    return memberships.map((m) => m.businessId);
  }
}
