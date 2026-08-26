import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { BillStatus } from '../../../generated/prisma/enums';

export class CreateSupplierDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;
}

export class LinkSupplierDto {
  @IsString()
  supplierId!: string;

  @IsNumber()
  @Min(0)
  costPrice!: number;

  @IsOptional()
  @IsBoolean()
  preferred?: boolean;
}

class PoItemDto {
  @IsString()
  variantId!: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsISO8601()
  expectedDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoItemDto)
  items!: PoItemDto[];
}

class ReceiveLineDto {
  @IsString()
  itemId!: string;

  @IsInt()
  @Min(0)
  receivedQty!: number;
}

export class ReceivePoDto {
  @IsString()
  warehouseId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}

export class UpdateBillStatusDto {
  @IsEnum(BillStatus)
  billStatus!: BillStatus;
}
