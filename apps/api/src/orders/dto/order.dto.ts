import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { OrderChannel, OrderPaymentStatus } from '../../../generated/prisma/enums';

class OrderItemDto {
  @IsString()
  variantId!: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateOrderDto {
  @IsEnum(OrderChannel)
  channel!: OrderChannel;

  @IsString()
  @MinLength(1)
  customer!: string;

  @IsString()
  warehouseId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class SetPaymentStatusDto {
  @IsEnum(OrderPaymentStatus)
  paymentStatus!: OrderPaymentStatus;
}
