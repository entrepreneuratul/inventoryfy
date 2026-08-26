import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { AuthModule } from '../auth/auth.module';
import { WarehousesModule } from '../warehouses/warehouses.module';

@Module({
  imports: [AuthModule, WarehousesModule],
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [SuppliersService, PurchaseOrdersService],
})
export class SuppliersModule {}
