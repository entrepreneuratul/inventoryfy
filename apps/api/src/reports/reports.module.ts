import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AuthModule } from '../auth/auth.module';
import { FinancialsModule } from '../financials/financials.module';

@Module({
  imports: [AuthModule, FinancialsModule],
  controllers: [DashboardController, ReportsController],
  providers: [DashboardService, ReportsService],
})
export class ReportsModule {}
