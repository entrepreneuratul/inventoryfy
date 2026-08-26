import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUrl, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateIntegrationConnectionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // Local demo storefronts run on http://localhost:<port>, so plain HTTP
  // and non-standard ports have to be allowed — this is a local prototype,
  // not a production posting target.
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  webhookUrl!: string;

  @IsString()
  defaultWarehouseId!: string;
}

class ExternalOrderItemDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReceiveExternalOrderDto {
  @IsString()
  @MinLength(1)
  externalOrderId!: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExternalOrderItemDto)
  items!: ExternalOrderItemDto[];
}

export class CancelExternalOrderDto {
  @IsString()
  @MinLength(1)
  orderId!: string;
}
