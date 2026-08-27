import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperOwnerGuard } from '../auth/guards/super-owner.guard';
import { OnboardingService } from './onboarding.service';
import { SubmitOnboardingLeadDto } from './dto/platform.dto';

/**
 * Split from PlatformController on purpose: that whole controller is
 * Super-Owner-only at the class level, but submitting a lead has to be
 * reachable by an anonymous visitor on the public landing page — there
 * is no user yet at that point, let alone a Super Owner.
 */
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post('leads')
  submitLead(@Body() dto: SubmitOnboardingLeadDto) {
    return this.onboarding.submitLead(dto);
  }

  @UseGuards(JwtAuthGuard, SuperOwnerGuard)
  @Get('leads')
  listLeads() {
    return this.onboarding.listLeads();
  }
}
