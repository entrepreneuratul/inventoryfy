import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, LinkSupplierDto } from './dto/supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';

@UseGuards(JwtAuthGuard, BusinessAccessGuard)
@Controller('businesses/:businessId')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get('suppliers')
  list(@Param('businessId') businessId: string) {
    return this.suppliers.list(businessId);
  }

  @Post('suppliers')
  create(@Param('businessId') businessId: string, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(businessId, dto);
  }

  @Get('suppliers/:supplierId')
  get(@Param('businessId') businessId: string, @Param('supplierId') supplierId: string) {
    return this.suppliers.get(businessId, supplierId);
  }

  @Get('products/:productId/suppliers')
  listLinked(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return this.suppliers.listLinkedSuppliers(businessId, productId);
  }

  @Post('products/:productId/suppliers')
  link(@Param('businessId') businessId: string, @Param('productId') productId: string, @Body() dto: LinkSupplierDto) {
    return this.suppliers.linkSupplier(businessId, productId, dto);
  }
}
