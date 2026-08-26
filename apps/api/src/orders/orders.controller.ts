import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, SetPaymentStatusDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';

@UseGuards(JwtAuthGuard, BusinessAccessGuard)
@Controller('businesses/:businessId/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Param('businessId') businessId: string) {
    return this.orders.list(businessId);
  }

  @Post()
  create(@Param('businessId') businessId: string, @Body() dto: CreateOrderDto) {
    return this.orders.create(businessId, dto);
  }

  @Get(':orderId')
  get(@Param('businessId') businessId: string, @Param('orderId') orderId: string) {
    return this.orders.get(businessId, orderId);
  }

  @Post(':orderId/ship')
  ship(@Param('businessId') businessId: string, @Param('orderId') orderId: string) {
    return this.orders.ship(businessId, orderId);
  }

  @Post(':orderId/deliver')
  deliver(@Param('businessId') businessId: string, @Param('orderId') orderId: string) {
    return this.orders.deliver(businessId, orderId);
  }

  @Post(':orderId/cancel')
  cancel(@Param('businessId') businessId: string, @Param('orderId') orderId: string) {
    return this.orders.cancel(businessId, orderId);
  }

  @Post(':orderId/payment-status')
  setPaymentStatus(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: SetPaymentStatusDto,
  ) {
    return this.orders.setPaymentStatus(businessId, orderId, dto.paymentStatus);
  }
}
