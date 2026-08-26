import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateAlertChannelDto, UpdateThresholdDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';
import { AlertType } from '../../generated/prisma/enums';

@UseGuards(JwtAuthGuard, BusinessAccessGuard)
@Controller('businesses/:businessId/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('thresholds')
  thresholds(@Param('businessId') businessId: string) {
    return this.notifications.thresholds(businessId);
  }

  @Patch('thresholds/:productId')
  updateThreshold(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateThresholdDto,
  ) {
    return this.notifications.updateThreshold(businessId, productId, dto.threshold);
  }

  @Get('channels')
  channels(@Param('businessId') businessId: string) {
    return this.notifications.alertChannels(businessId);
  }

  @Patch('channels/:alertType')
  updateChannel(
    @Param('businessId') businessId: string,
    @Param('alertType', new ParseEnumPipe(AlertType)) alertType: AlertType,
    @Body() dto: UpdateAlertChannelDto,
  ) {
    return this.notifications.updateAlertChannel(businessId, alertType, dto);
  }

  @Get('history')
  history(@Param('businessId') businessId: string) {
    return this.notifications.history(businessId);
  }

  @Post('send-digest')
  sendDigest(@Param('businessId') businessId: string) {
    return this.notifications.sendDigestNow(businessId);
  }
}
