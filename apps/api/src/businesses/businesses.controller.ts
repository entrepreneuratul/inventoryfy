import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { BusinessSummary } from '@inventoryfy/shared-types';
import { BusinessesService } from './businesses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  /** Tenant-isolated detail lookup — proves BusinessAccessGuard end to end. */
  @UseGuards(JwtAuthGuard, BusinessAccessGuard)
  @Get(':businessId')
  findOne(@Param('businessId') businessId: string): Promise<BusinessSummary> {
    return this.businesses.findOne(businessId);
  }
}
