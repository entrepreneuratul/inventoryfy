import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class AdjustStockDto {
  @IsString()
  variantId!: string;

  @IsInt()
  delta!: number;
}

export class CreateTransferDto {
  @IsString()
  variantId!: string;

  @IsString()
  fromWarehouseId!: string;

  @IsString()
  toWarehouseId!: string;

  @IsInt()
  qty!: number;
}

export class SetCountLineDto {
  @IsInt()
  counted!: number;
}

export class CreateBatchDto {
  @IsString()
  variantId!: string;

  @IsString()
  @MinLength(1)
  lotCode!: string;

  @IsInt()
  qty!: number;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class CreateSerialDto {
  @IsString()
  variantId!: string;

  @IsString()
  @MinLength(1)
  serial!: string;

  @IsOptional()
  @IsString()
  warrantyUntil?: string;
}
