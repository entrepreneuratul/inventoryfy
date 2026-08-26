import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto, DecideReturnDto } from './dto/return.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';

@UseGuards(JwtAuthGuard, BusinessAccessGuard)
@Controller('businesses/:businessId/returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list(@Param('businessId') businessId: string) {
    return this.returns.list(businessId);
  }

  @Post()
  create(@Param('businessId') businessId: string, @Body() dto: CreateReturnDto) {
    return this.returns.create(businessId, dto);
  }

  @Get(':returnId')
  get(@Param('businessId') businessId: string, @Param('returnId') returnId: string) {
    return this.returns.get(businessId, returnId);
  }

  @Post(':returnId/approve')
  approve(@Param('businessId') businessId: string, @Param('returnId') returnId: string) {
    return this.returns.approve(businessId, returnId);
  }

  @Post(':returnId/mark-received')
  markReceived(@Param('businessId') businessId: string, @Param('returnId') returnId: string) {
    return this.returns.markReceived(businessId, returnId);
  }

  @Post(':returnId/decide')
  decide(@Param('businessId') businessId: string, @Param('returnId') returnId: string, @Body() dto: DecideReturnDto) {
    return this.returns.decide(businessId, returnId, dto);
  }
}
