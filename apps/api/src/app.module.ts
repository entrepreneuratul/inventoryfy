import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { CatalogModule } from './catalog/catalog.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { OrdersModule } from './orders/orders.module';
import { FinancialsModule } from './financials/financials.module';
import { ReportsModule } from './reports/reports.module';
import { TeamModule } from './team/team.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PlatformModule } from './platform/platform.module';
import { EmailModule } from './email/email.module';
import { CommonModule } from './common/stock-change-emitter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CommonModule,
    PrismaModule,
    AuthModule,
    BusinessesModule,
    CatalogModule,
    WarehousesModule,
    SuppliersModule,
    OrdersModule,
    FinancialsModule,
    ReportsModule,
    TeamModule,
    AuditModule,
    NotificationsModule,
    IntegrationsModule,
    PlatformModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
