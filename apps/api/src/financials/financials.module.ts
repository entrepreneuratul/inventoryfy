import { Module } from '@nestjs/common';
import { FinancialsController } from './financials.controller';
import { FinancialsService } from './financials.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FinancialsController],
  providers: [FinancialsService],
})
export class FinancialsModule {}
