import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationConnectionDto } from './dto/integration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';
import { CapabilityGuard } from '../auth/guards/capability.guard';
import { RequireCapability } from '../auth/decorators/require-capability.decorator';

@UseGuards(JwtAuthGuard, BusinessAccessGuard, CapabilityGuard)
@Controller('businesses/:businessId/integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  /** Visible to any team member, same as Team's roster — only creating,
   * pausing, or revoking a connection needs MANAGE_INTEGRATIONS. */
  @Get()
  list(@Param('businessId') businessId: string) {
    return this.integrations.list(businessId);
  }

  @Get('events')
  events(@Param('businessId') businessId: string) {
    return this.integrations.events(businessId);
  }

  @RequireCapability('MANAGE_INTEGRATIONS')
  @Post()
  create(@Param('businessId') businessId: string, @Body() dto: CreateIntegrationConnectionDto) {
    return this.integrations.create(businessId, dto);
  }

  @RequireCapability('MANAGE_INTEGRATIONS')
  @Post(':id/toggle-status')
  toggleStatus(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.integrations.toggleStatus(businessId, id);
  }

  @RequireCapability('MANAGE_INTEGRATIONS')
  @Delete(':id')
  remove(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.integrations.remove(businessId, id);
  }
}
