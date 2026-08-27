import { Injectable, Logger } from '@nestjs/common';
import type { OnboardingLeadRow, SubmitOnboardingLeadRequest } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

/**
 * The public landing page's "request access" form. Deliberately does
 * NOT auto-onboard anything — this only records the request and emails
 * both sides, so a human (a Super Owner) reviews it and completes the
 * real onboarding through PlatformService.onboardTenant. Two separate
 * concerns kept in one small service since they're both just "what
 * happens to a submitted lead": persisting it survives an email
 * provider outage; the emails are what actually get a human's
 * attention.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async listLeads(): Promise<OnboardingLeadRow[]> {
    const leads = await this.prisma.onboardingLead.findMany({ orderBy: { createdAt: 'desc' } });
    return leads.map((l) => ({
      id: l.id,
      businessName: l.businessName,
      contactName: l.contactName,
      email: l.email,
      phone: l.phone,
      message: l.message,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async submitLead(dto: SubmitOnboardingLeadRequest): Promise<{ received: true }> {
    const lead = await this.prisma.onboardingLead.create({
      data: {
        businessName: dto.businessName,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone || null,
        message: dto.message || null,
      },
    });

    // Best-effort from here — the lead is already safely recorded above,
    // so an email provider hiccup must never turn into an error response
    // for someone who just filled out a form.
    await this.email.send({
      to: dto.email,
      subject: `Thanks for your interest in Inventoryfy, ${dto.contactName}`,
      html: `
        <p>Hi ${escapeHtml(dto.contactName)},</p>
        <p>Thanks for requesting access to Inventoryfy for <strong>${escapeHtml(dto.businessName)}</strong>.
        Our team will review your request and reach out to ${escapeHtml(dto.email)} shortly to get you set up.</p>
        <p>— The Inventoryfy team</p>
      `,
    });

    const notifyTo = await this.resolveNotifyEmail();
    if (notifyTo) {
      await this.email.send({
        to: notifyTo,
        subject: `New onboarding request: ${dto.businessName}`,
        html: `
          <p>New "request access" submission from the landing page:</p>
          <table cellpadding="6">
            <tr><td><strong>Business</strong></td><td>${escapeHtml(dto.businessName)}</td></tr>
            <tr><td><strong>Contact</strong></td><td>${escapeHtml(dto.contactName)}</td></tr>
            <tr><td><strong>Email</strong></td><td>${escapeHtml(dto.email)}</td></tr>
            <tr><td><strong>Phone</strong></td><td>${escapeHtml(dto.phone || '—')}</td></tr>
            <tr><td><strong>Message</strong></td><td>${escapeHtml(dto.message || '—')}</td></tr>
          </table>
          <p>Lead id: ${lead.id} — review and onboard from Platform → Tenants once you're ready.</p>
        `,
      });
    } else {
      this.logger.warn(`No ONBOARDING_NOTIFY_EMAIL and no Super Owner account found — lead ${lead.id} recorded but nobody was emailed`);
    }

    return { received: true };
  }

  /** ONBOARDING_NOTIFY_EMAIL if set; otherwise fall back to any Super
   * Owner's own address, so "notify us" works out of the box without
   * extra config — see EmailService for the plain-log fallback if
   * Resend itself isn't configured either. */
  private async resolveNotifyEmail(): Promise<string | null> {
    const configured = process.env.ONBOARDING_NOTIFY_EMAIL;
    if (configured) return configured;
    const superOwner = await this.prisma.user.findFirst({ where: { isSuperOwner: true }, orderBy: { createdAt: 'asc' } });
    return superOwner?.email ?? null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
