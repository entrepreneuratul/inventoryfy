import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/**
 * Resend-backed email — same provider and the same graceful-degrade
 * shape as Ritkalp's lib/email.ts (a connected storefront client of
 * this platform): no RESEND_API_KEY set → every call here just logs
 * instead of throwing, so onboarding-lead capture and everything else
 * that fires an email keeps working end-to-end (the lead is still
 * persisted — see OnboardingService) before Resend is actually
 * configured, rather than failing the whole request over it.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private client(): Resend | null {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
  }

  async send(params: { to: string; subject: string; html: string }): Promise<void> {
    const resend = this.client();
    const from = process.env.RESEND_FROM_EMAIL || 'Inventoryfy <onboarding@inventoryfy.dev>';

    if (!resend) {
      this.logger.log(`RESEND_API_KEY not set — would have sent "${params.subject}" to ${params.to}`);
      return;
    }

    try {
      await resend.emails.send({ from, to: params.to, subject: params.subject, html: params.html });
    } catch (err) {
      // Email is always a side effect of some other action here (a lead
      // being recorded, an order being placed) — a delivery failure must
      // never fail that action, just get logged so it's noticed.
      this.logger.error(`Failed to send "${params.subject}" to ${params.to}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
