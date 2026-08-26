import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustStockDto, CreateTransferDto, CreateWarehouseDto, SetCountLineDto } from './dto/inventory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';

@UseGuards(JwtAuthGuard, BusinessAccessGuard)
@Controller('businesses/:businessId')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('warehouses')
  listWarehouses(@Param('businessId') businessId: string) {
    return this.inventory.listWarehouses(businessId);
  }

  @Post('warehouses')
  createWarehouse(@Param('businessId') businessId: string, @Body() dto: CreateWarehouseDto) {
    return this.inventory.createWarehouse(businessId, dto.name);
  }

  @Post('warehouses/:warehouseId/adjust')
  adjustStock(
    @Param('businessId') businessId: string,
    @Param('warehouseId') warehouseId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventory.adjustStock(businessId, warehouseId, dto.variantId, dto.delta);
  }

  @Get('warehouses/:warehouseId/active-count')
  getActiveCount(@Param('businessId') businessId: string, @Param('warehouseId') warehouseId: string) {
    return this.inventory.getActiveCount(businessId, warehouseId);
  }

  @Post('warehouses/:warehouseId/counts')
  startCount(@Param('businessId') businessId: string, @Param('warehouseId') warehouseId: string) {
    return this.inventory.startCount(businessId, warehouseId);
  }

  @Get('products/:productId/warehouse-stock')
  productWarehouseBreakdown(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return this.inventory.productWarehouseBreakdown(businessId, productId);
  }

  @Get('transfers')
  listTransfers(@Param('businessId') businessId: string) {
    return this.inventory.listTransfers(businessId);
  }

  @Post('transfers')
  createTransfer(@Param('businessId') businessId: string, @Body() dto: CreateTransferDto) {
    return this.inventory.createTransfer(businessId, dto.variantId, dto.fromWarehouseId, dto.toWarehouseId, dto.qty);
  }

  @Get('counts')
  listCounts(@Param('businessId') businessId: string) {
    return this.inventory.listCounts(businessId);
  }

  @Patch('counts/:countId/lines/:lineId')
  setCountLine(
    @Param('businessId') businessId: string,
    @Param('countId') countId: string,
    @Param('lineId') lineId: string,
    @Body() dto: SetCountLineDto,
  ) {
    return this.inventory.setCountLine(businessId, countId, lineId, dto.counted);
  }

  @Post('counts/:countId/submit')
  submitCount(@Param('businessId') businessId: string, @Param('countId') countId: string) {
    return this.inventory.submitCount(businessId, countId);
  }
}
