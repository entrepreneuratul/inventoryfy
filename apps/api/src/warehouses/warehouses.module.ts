import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { LotTrackingController } from './lot-tracking.controller';
import { LotTrackingService } from './lot-tracking.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController, LotTrackingController],
  providers: [InventoryService, LotTrackingService],
})
export class WarehousesModule {}
