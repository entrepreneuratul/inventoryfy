import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { FinancialsService } from './financials.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CapabilityGuard } from '../auth/guards/capability.guard';
import { RequireCapability } from '../auth/decorators/require-capability.decorator';
import type { RequestUser } from '../auth/types';
import { MembershipRole, MembershipStatus } from '../../generated/prisma/enums';
import type { ValuationMethod } from '@inventoryfy/shared-types';

@Controller()
export class FinancialsController {
  constructor(
    private readonly financials: FinancialsService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard, BusinessAccessGuard)
  @Get('businesses/:businessId/products/:productId/valuation')
  valuation(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Query('method') method: ValuationMethod = 'WEIGHTED',
  ) {
    return this.financials.valuation(businessId, productId, method);
  }

  @UseGuards(JwtAuthGuard, BusinessAccessGuard)
  @Get('businesses/:businessId/products/:productId/landed-cost')
  landedCost(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return this.financials.landedCost(businessId, productId);
  }

  @UseGuards(JwtAuthGuard, BusinessAccessGuard, CapabilityGuard)
  @RequireCapability('VIEW_FINANCIALS')
  @Get('businesses/:businessId/financials')
  forBusiness(@Param('businessId') businessId: string) {
    return this.financials.forBusiness(businessId);
  }

  @UseGuards(JwtAuthGuard, BusinessAccessGuard, CapabilityGuard)
  @RequireCapability('VIEW_FINANCIALS')
  @Get('businesses/:businessId/financials/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="financials.csv"')
  exportBusiness(@Param('businessId') businessId: string) {
    return this.financials.exportCsv([businessId]);
  }

  /** Owner-only, cross-business aggregate — not :businessId-scoped since it
   * spans every business the caller owns (same authorization model as
   * /auth/me and GET /businesses, not BusinessAccessGuard). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MembershipRole.OWNER)
  @Get('financials/summary')
  async ownerSummary(@CurrentUser() user: RequestUser) {
    const businessIds = await this.ownedBusinessIds(user.id);
    return this.financials.forBusinesses(businessIds);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MembershipRole.OWNER)
  @Get('financials/summary/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="financials.csv"')
  async exportSummary(@CurrentUser() user: RequestUser) {
    const businessIds = await this.ownedBusinessIds(user.id);
    return this.financials.exportCsv(businessIds);
  }

  private async ownedBusinessIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
      select: { businessId: true },
    });
    return memberships.map((m) => m.businessId);
  }
}
