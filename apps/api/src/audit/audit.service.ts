import { Injectable, Logger } from '@nestjs/common';
import type { AuditLogRow } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget by design (called from the global interceptor after a
   * request already succeeded) — a logging failure must never surface to
   * the caller as if their actual request failed. */
  record(entry: {
    businessId: string;
    userId: string | null;
    userName: string;
    userEmail: string;
    action: string;
    entity: string;
    path: string;
  }): void {
    this.prisma.auditLogEntry.create({ data: entry }).catch((err) => {
      this.logger.warn(`Failed to write audit log entry: ${err instanceof Error ? err.message : err}`);
    });
  }

  async list(businessIds: string[]): Promise<AuditLogRow[]> {
    const entries = await this.prisma.auditLogEntry.findMany({
      where: { businessId: { in: businessIds } },
      include: { business: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return entries.map((e) => ({
      id: e.id,
      timestamp: e.createdAt.toISOString(),
      userName: e.userName,
      action: describeAction(e.action),
      entity: e.entity,
      businessName: e.business.name,
    }));
  }
}

function describeAction(method: string): string {
  const verbs: Record<string, string> = { POST: 'Created', PATCH: 'Updated', PUT: 'Replaced', DELETE: 'Deleted' };
  return verbs[method] ?? method;
}
