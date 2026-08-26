import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto, CreateVariantDto, SetBundleComponentsDto, UpdateProductDto, UpdateVariantDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';

@UseGuards(JwtAuthGuard, BusinessAccessGuard)
@Controller('businesses/:businessId/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Param('businessId') businessId: string, @Query('search') search?: string) {
    return this.products.list(businessId, search);
  }

  @Get('variant-options')
  variantOptions(@Param('businessId') businessId: string) {
    return this.products.variantOptions(businessId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="catalog.csv"')
  export(@Param('businessId') businessId: string) {
    return this.products.exportCsv(businessId);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@Param('businessId') businessId: string, @UploadedFile() file: Express.Multer.File) {
    return this.products.importCsv(businessId, file.buffer);
  }

  @Get(':productId')
  get(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return this.products.get(businessId, productId);
  }

  @Post()
  create(@Param('businessId') businessId: string, @Body() dto: CreateProductDto) {
    return this.products.create(businessId, dto);
  }

  @Patch(':productId')
  update(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(businessId, productId, dto);
  }

  @Delete(':productId')
  remove(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return this.products.remove(businessId, productId);
  }

  @Post(':productId/variants')
  addVariant(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.products.addVariant(businessId, productId, dto);
  }

  @Patch(':productId/variants/:variantId')
  updateVariant(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.products.updateVariant(businessId, productId, variantId, dto);
  }

  @Delete(':productId/variants/:variantId')
  removeVariant(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.products.removeVariant(businessId, productId, variantId);
  }

  @Put(':productId/bundle-components')
  setBundleComponents(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Body() dto: SetBundleComponentsDto,
  ) {
    return this.products.setBundleComponents(businessId, productId, dto);
  }
}
