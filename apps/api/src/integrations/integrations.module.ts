import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsPublicController } from './integrations-public.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationApiKeyGuard } from './guards/integration-api-key.guard';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [IntegrationsController, IntegrationsPublicController],
  providers: [IntegrationsService, IntegrationApiKeyGuard],
})
export class IntegrationsModule {}
