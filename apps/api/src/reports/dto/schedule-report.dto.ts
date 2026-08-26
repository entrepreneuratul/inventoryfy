import { IsEmail, IsEnum } from 'class-validator';
import { ReportFrequency, ReportType } from '../../../generated/prisma/enums';

export class ScheduleReportDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsEnum(ReportFrequency)
  frequency!: ReportFrequency;

  @IsEmail()
  email!: string;
}
