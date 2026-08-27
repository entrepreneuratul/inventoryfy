import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class OnboardTenantDto {
  @IsString()
  @MinLength(1)
  businessName!: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsString()
  @MinLength(1)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;
}

export class AssignOwnerDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;
}
