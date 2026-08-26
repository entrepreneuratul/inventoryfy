import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto, ReceivePoDto, UpdateBillStatusDto } from './dto/supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';

@UseGuards(JwtAuthGuard, BusinessAccessGuard)
@Controller('businesses/:businessId')
export class PurchaseOrdersController {
  constructor(private readonly pos: PurchaseOrdersService) {}

  @Get('purchase-orders')
  listColumns(@Param('businessId') businessId: string) {
    return this.pos.listColumns(businessId);
  }

  @Post('purchase-orders')
  create(@Param('businessId') businessId: string, @Body() dto: CreatePurchaseOrderDto) {
    return this.pos.create(businessId, dto);
  }

  @Get('reorder-suggestions')
  reorderSuggestions(@Param('businessId') businessId: string) {
    return this.pos.reorderSuggestions(businessId);
  }

  @Get('purchase-orders/:poId')
  get(@Param('businessId') businessId: string, @Param('poId') poId: string) {
    return this.pos.get(businessId, poId);
  }

  @Post('purchase-orders/:poId/approve')
  approve(@Param('businessId') businessId: string, @Param('poId') poId: string) {
    return this.pos.approve(businessId, poId);
  }

  @Post('purchase-orders/:poId/receive')
  receive(@Param('businessId') businessId: string, @Param('poId') poId: string, @Body() dto: ReceivePoDto) {
    return this.pos.receive(businessId, poId, dto);
  }

  @Post('purchase-orders/:poId/close')
  close(@Param('businessId') businessId: string, @Param('poId') poId: string) {
    return this.pos.close(businessId, poId);
  }

  @Post('purchase-orders/:poId/bill-status')
  updateBillStatus(
    @Param('businessId') businessId: string,
    @Param('poId') poId: string,
    @Body() dto: UpdateBillStatusDto,
  ) {
    return this.pos.updateBillStatus(businessId, poId, dto.billStatus);
  }
}
