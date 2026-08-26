import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TeamRole } from '../../../generated/prisma/enums';

export class UpdateThresholdDto {
  @IsInt()
  @Min(0)
  threshold!: number;
}

export class UpdateAlertChannelDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(TeamRole, { each: true })
  recipientRoles?: TeamRole[];
}
