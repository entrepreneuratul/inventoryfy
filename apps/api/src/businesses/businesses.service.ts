import { Injectable, NotFoundException } from '@nestjs/common';
import type { BusinessSummary } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public, pre-auth list for the login screen's "Business" picker (staff
   * role): a tenant name isn't sensitive, and staff need to name their
   * workspace before we know who they are. */
  async findAllPublic(): Promise<Pick<BusinessSummary, 'id' | 'name'>[]> {
    const businesses = await this.prisma.business.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return businesses;
  }

  async findOne(businessId: string): Promise<BusinessSummary> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');
    return { id: business.id, name: business.name, type: business.type, currency: business.currency };
  }
}
