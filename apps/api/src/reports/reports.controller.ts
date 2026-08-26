import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ScheduleReportDto } from './dto/schedule-report.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { MembershipRole, MembershipStatus } from '../../generated/prisma/enums';

@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard, BusinessAccessGuard)
  @Get('businesses/:businessId/reports')
  forBusiness(@Param('businessId') businessId: string) {
    return this.reports.compute([businessId]);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MembershipRole.OWNER)
  @Get('reports/summary')
  async ownerSummary(@CurrentUser() user: RequestUser) {
    const businessIds = await this.ownedBusinessIds(user.id);
    return this.reports.compute(businessIds);
  }

  @UseGuards(JwtAuthGuard, BusinessAccessGuard)
  @Get('businesses/:businessId/reports/schedule')
  listScheduled(@Param('businessId') businessId: string) {
    return this.reports.listScheduled(businessId);
  }

  @UseGuards(JwtAuthGuard, BusinessAccessGuard)
  @Post('businesses/:businessId/reports/schedule')
  schedule(@Param('businessId') businessId: string, @Body() dto: ScheduleReportDto) {
    return this.reports.schedule(businessId, dto.reportType, dto.frequency, dto.email);
  }

  private async ownedBusinessIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
      select: { businessId: true },
    });
    return memberships.map((m) => m.businessId);
  }
}
