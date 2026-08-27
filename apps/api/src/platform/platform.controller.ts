import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperOwnerGuard } from '../auth/guards/super-owner.guard';
import { PlatformService } from './platform.service';
import { OnboardTenantDto, AssignOwnerDto } from './dto/platform.dto';

/**
 * Platform-operator-only surface: onboarding a new tenant business and
 * granting/reassigning its owner. Gated on User.isSuperOwner, not any
 * business membership — see SuperOwnerGuard's own comment for why this
 * can't just be another RolesGuard('OWNER') check. Deliberately not
 * nested under /businesses/:businessId like every other business-scoped
 * controller (TeamController, etc.) — a Super Owner calling this isn't
 * necessarily a member of the target business at all.
 */
@UseGuards(JwtAuthGuard, SuperOwnerGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('tenants')
  listTenants() {
    return this.platform.listTenants();
  }

  @Post('tenants')
  onboardTenant(@Body() dto: OnboardTenantDto) {
    return this.platform.onboardTenant(dto);
  }

  @Post('tenants/:businessId/owners')
  assignOwner(@Param('businessId') businessId: string, @Body() dto: AssignOwnerDto) {
    return this.platform.assignOwner(businessId, dto);
  }
}
