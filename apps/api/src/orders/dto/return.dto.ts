import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateReturnDto {
  @IsString()
  orderItemId!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}

export class DecideReturnDto {
  @IsBoolean()
  restock!: boolean;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}
