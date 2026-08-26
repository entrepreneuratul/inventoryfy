import { ConflictException, Injectable } from '@nestjs/common';
import type { Category } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({ where: { businessId }, orderBy: { name: 'asc' } });
    return categories.map((c) => ({ id: c.id, name: c.name }));
  }

  async create(businessId: string, name: string): Promise<Category> {
    const existing = await this.prisma.category.findUnique({ where: { businessId_name: { businessId, name } } });
    if (existing) throw new ConflictException(`Category "${name}" already exists`);
    const category = await this.prisma.category.create({ data: { businessId, name } });
    return { id: category.id, name: category.name };
  }
}
