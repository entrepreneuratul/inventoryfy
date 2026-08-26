import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IntegrationsService } from './integrations.service';
import { ReceiveExternalOrderDto } from './dto/integration.dto';
import { IntegrationApiKeyGuard } from './guards/integration-api-key.guard';
import type { IntegrationConnection } from '../../generated/prisma/client';

/** The public contract an external storefront actually calls — a
 * completely different surface from the rest of the API: no login, just
 * `Authorization: Bearer <apiKey>` (see IntegrationApiKeyGuard). Versioned
 * (/v1) since, unlike the rest of this app, changing this shape breaks
 * someone else's independently-deployed code. */
@UseGuards(IntegrationApiKeyGuard)
@Controller('integrations/v1')
export class IntegrationsPublicController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('catalog')
  catalog(@Req() req: Request & { integrationConnection: IntegrationConnection }) {
    return this.integrations.catalog(req.integrationConnection);
  }

  @Post('orders')
  receiveOrder(@Req() req: Request & { integrationConnection: IntegrationConnection }, @Body() dto: ReceiveExternalOrderDto) {
    return this.integrations.receiveOrder(req.integrationConnection, dto);
  }
}
