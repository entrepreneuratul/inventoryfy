import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { MembershipRole, MembershipStatus } from '../../generated/prisma/enums';

@Controller()
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard, BusinessAccessGuard)
  @Get('businesses/:businessId/dashboard')
  single(@Param('businessId') businessId: string) {
    return this.dashboard.singleDashboard(businessId);
  }

  /** Owner-only, cross-business — same shape as /financials/summary. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MembershipRole.OWNER)
  @Get('dashboard/summary')
  async ownerSummary(@CurrentUser() user: RequestUser) {
    const businessIds = await this.ownedBusinessIds(user.id);
    return this.dashboard.ownerDashboard(businessIds);
  }

  private async ownedBusinessIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
      select: { businessId: true },
    });
    return memberships.map((m) => m.businessId);
  }
}
