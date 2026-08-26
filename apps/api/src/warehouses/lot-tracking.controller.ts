import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LotTrackingService } from './lot-tracking.service';
import { CreateBatchDto, CreateSerialDto } from './dto/inventory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';

@UseGuards(JwtAuthGuard, BusinessAccessGuard)
@Controller('businesses/:businessId')
export class LotTrackingController {
  constructor(private readonly lotTracking: LotTrackingService) {}

  @Get('batches')
  listBatches(@Param('businessId') businessId: string, @Query('productId') productId?: string) {
    return this.lotTracking.listBatches(businessId, productId);
  }

  @Post('batches')
  createBatch(@Param('businessId') businessId: string, @Body() dto: CreateBatchDto) {
    return this.lotTracking.createBatch(businessId, dto.variantId, dto.lotCode, dto.qty, dto.expiryDate);
  }

  @Get('serials')
  listSerials(@Param('businessId') businessId: string, @Query('productId') productId?: string) {
    return this.lotTracking.listSerials(businessId, productId);
  }

  @Post('serials')
  createSerial(@Param('businessId') businessId: string, @Body() dto: CreateSerialDto) {
    return this.lotTracking.createSerial(businessId, dto.variantId, dto.serial, dto.warrantyUntil);
  }
}
