import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AlertChannelRow,
  AlertType as SharedAlertType,
  NotificationHistoryRow,
  SendDigestResult,
  ThresholdRow,
  UpdateAlertChannelRequest,
} from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AlertType, MembershipStatus, NotificationChannel, NotificationDeliveryStatus, TeamRole } from '../../generated/prisma/enums';

// Backend-local copy of shared-types' ALERT_TYPE_LABELS — see the comment
// on CAPABILITY_MATRIX in auth/capability-matrix.ts for why: Nest's build
// doesn't bundle node_modules, so only `import type` from a
// no-build-step workspace package is safe at runtime here.
const ALERT_TYPE_LABELS: Record<SharedAlertType, string> = {
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  NEW_ORDER: 'New order',
  SUPPLIER_BILL_OVERDUE: 'Supplier bill overdue',
  PAYMENT_DUE: 'Payment due',
};

const DEFAULT_SETTINGS: Record<AlertType, { email: boolean; whatsapp: boolean; roles: TeamRole[] }> = {
  [AlertType.LOW_STOCK]: { email: true, whatsapp: true, roles: [TeamRole.BUSINESS_ADMIN, TeamRole.INVENTORY_MANAGER] },
  [AlertType.OUT_OF_STOCK]: { email: true, whatsapp: true, roles: [TeamRole.OWNER, TeamRole.BUSINESS_ADMIN] },
  [AlertType.NEW_ORDER]: { email: false, whatsapp: true, roles: [TeamRole.SALES_STAFF] },
  [AlertType.SUPPLIER_BILL_OVERDUE]: { email: true, whatsapp: false, roles: [TeamRole.OWNER, TeamRole.ACCOUNTANT] },
  [AlertType.PAYMENT_DUE]: { email: true, whatsapp: true, roles: [TeamRole.ACCOUNTANT] },
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async thresholds(businessId: string): Promise<ThresholdRow[]> {
    const products = await this.prisma.product.findMany({ where: { businessId }, include: { variants: true } });
    return products.map((p) => ({
      productId: p.id,
      name: p.name,
      stock: p.variants.reduce((s, v) => s + v.stock, 0),
      threshold: p.lowStockThreshold,
    }));
  }

  async updateThreshold(businessId: string, productId: string, threshold: number): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.businessId !== businessId) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id: productId }, data: { lowStockThreshold: threshold } });
  }

  async alertChannels(businessId: string): Promise<AlertChannelRow[]> {
    await this.ensureDefaults(businessId);
    const settings = await this.prisma.alertChannelSetting.findMany({ where: { businessId } });
    return settings
      .sort((a, b) => ALERT_TYPE_ORDER.indexOf(a.alertType) - ALERT_TYPE_ORDER.indexOf(b.alertType))
      .map((s) => ({
        alertType: s.alertType,
        label: ALERT_TYPE_LABELS[s.alertType],
        emailEnabled: s.emailEnabled,
        whatsappEnabled: s.whatsappEnabled,
        recipientRoles: s.recipientRoles,
      }));
  }

  async updateAlertChannel(businessId: string, alertType: AlertType, dto: UpdateAlertChannelRequest): Promise<AlertChannelRow> {
    await this.ensureDefaults(businessId);
    const updated = await this.prisma.alertChannelSetting.update({
      where: { businessId_alertType: { businessId, alertType } },
      data: {
        emailEnabled: dto.emailEnabled,
        whatsappEnabled: dto.whatsappEnabled,
        recipientRoles: dto.recipientRoles,
      },
    });
    return {
      alertType: updated.alertType,
      label: ALERT_TYPE_LABELS[updated.alertType],
      emailEnabled: updated.emailEnabled,
      whatsappEnabled: updated.whatsappEnabled,
      recipientRoles: updated.recipientRoles,
    };
  }

  async history(businessId: string): Promise<NotificationHistoryRow[]> {
    const entries = await this.prisma.notificationLogEntry.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return entries.map((e) => ({
      id: e.id,
      date: e.createdAt.toISOString(),
      type: ALERT_TYPE_LABELS[e.alertType],
      channel: e.channel,
      recipient: e.recipient,
      status: e.status,
    }));
  }

  /** Computes current low-stock / out-of-stock conditions and logs what
   * would be sent for each enabled channel, to whichever active team
   * members hold an eligible role. No SMTP/WhatsApp integration exists —
   * SENT means "a channel was enabled and had an eligible recipient",
   * FAILED means it didn't. */
  async sendDigestNow(businessId: string): Promise<SendDigestResult> {
    await this.ensureDefaults(businessId);
    const products = await this.prisma.product.findMany({ where: { businessId }, include: { variants: true } });
    const hasLowStock = products.some((p) => {
      const stock = p.variants.reduce((s, v) => s + v.stock, 0);
      return stock > 0 && stock <= p.lowStockThreshold;
    });
    const hasOutOfStock = products.some((p) => p.variants.reduce((s, v) => s + v.stock, 0) <= 0);

    const alertTypes: AlertType[] = [
      ...(hasLowStock ? [AlertType.LOW_STOCK] : []),
      ...(hasOutOfStock ? [AlertType.OUT_OF_STOCK] : []),
    ];

    let queued = 0;
    let failed = 0;

    for (const alertType of alertTypes) {
      const setting = await this.prisma.alertChannelSetting.findUniqueOrThrow({
        where: { businessId_alertType: { businessId, alertType } },
      });
      const channels: NotificationChannel[] = [
        ...(setting.emailEnabled ? [NotificationChannel.EMAIL] : []),
        ...(setting.whatsappEnabled ? [NotificationChannel.WHATSAPP] : []),
      ];
      if (channels.length === 0) continue;

      const recipients = await this.prisma.membership.findMany({
        where: { businessId, status: MembershipStatus.ACTIVE, teamRole: { in: setting.recipientRoles } },
        include: { user: true },
      });

      for (const channel of channels) {
        if (recipients.length === 0) {
          await this.prisma.notificationLogEntry.create({
            data: { businessId, alertType, channel, recipient: 'No eligible recipient configured', status: NotificationDeliveryStatus.FAILED },
          });
          failed++;
          continue;
        }
        for (const r of recipients) {
          await this.prisma.notificationLogEntry.create({
            data: { businessId, alertType, channel, recipient: r.user.name, status: NotificationDeliveryStatus.SENT },
          });
          queued++;
        }
      }
    }

    return { queued, failed };
  }

  private async ensureDefaults(businessId: string): Promise<void> {
    const existing = await this.prisma.alertChannelSetting.findMany({ where: { businessId }, select: { alertType: true } });
    const existingTypes = new Set(existing.map((e) => e.alertType));
    const missing = ALERT_TYPE_ORDER.filter((t) => !existingTypes.has(t));
    if (missing.length === 0) return;

    await this.prisma.alertChannelSetting.createMany({
      data: missing.map((alertType) => ({
        businessId,
        alertType,
        emailEnabled: DEFAULT_SETTINGS[alertType].email,
        whatsappEnabled: DEFAULT_SETTINGS[alertType].whatsapp,
        recipientRoles: DEFAULT_SETTINGS[alertType].roles,
      })),
    });
  }
}

const ALERT_TYPE_ORDER: AlertType[] = [
  AlertType.LOW_STOCK,
  AlertType.OUT_OF_STOCK,
  AlertType.NEW_ORDER,
  AlertType.SUPPLIER_BILL_OVERDUE,
  AlertType.PAYMENT_DUE,
];
