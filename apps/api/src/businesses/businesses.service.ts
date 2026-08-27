import { Injectable, NotFoundException } from '@nestjs/common';
import type { BusinessSummary } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(businessId: string): Promise<BusinessSummary> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');
    return { id: business.id, name: business.name, type: business.type, currency: business.currency };
  }
}
