import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { AuthModule } from '../auth/auth.module';
import { WarehousesModule } from '../warehouses/warehouses.module';

@Module({
  imports: [AuthModule, WarehousesModule],
  controllers: [OrdersController, ReturnsController],
  providers: [OrdersService, ReturnsService],
})
export class OrdersModule {}
