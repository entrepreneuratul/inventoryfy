import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type {
  AssignOwnerRequest,
  AssignOwnerResult,
  OnboardTenantRequest,
  OnboardTenantResult,
  TenantRow,
} from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipRole, MembershipStatus, TeamRole } from '../../generated/prisma/enums';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants(): Promise<TenantRow[]> {
    const businesses = await this.prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { memberships: { where: { role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE } } },
        },
      },
    });
    return businesses.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      currency: b.currency,
      createdAt: b.createdAt.toISOString(),
      ownerCount: b._count.memberships,
    }));
  }

  async onboardTenant(dto: OnboardTenantRequest): Promise<OnboardTenantResult> {
    const business = await this.prisma.business.create({
      data: {
        name: dto.businessName,
        type: dto.businessType || null,
        // Every real tenant seen on this platform so far trades in INR
        // (see the API's own currency formatter) — default to that
        // rather than Prisma's schema-level "USD" fallback, which is
        // just a placeholder from before any real business existed.
        currency: dto.currency || 'INR',
        timezone: dto.timezone || 'Asia/Kolkata',
      },
    });

    const { temporaryPassword } = await this.grantOwner(business.id, dto.ownerName, dto.ownerEmail);

    return {
      business: {
        id: business.id,
        name: business.name,
        type: business.type,
        currency: business.currency,
        createdAt: business.createdAt.toISOString(),
        ownerCount: 1,
      },
      ownerEmail: dto.ownerEmail,
      temporaryPassword,
    };
  }

  async assignOwner(businessId: string, dto: AssignOwnerRequest): Promise<AssignOwnerResult> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Tenant not found');

    const { temporaryPassword, promoted } = await this.grantOwner(businessId, dto.name, dto.email);
    return { businessId, ownerEmail: dto.email, temporaryPassword, promoted };
  }

  /**
   * Shared by onboarding a brand-new business and assigning an owner to
   * an existing one — finds-or-creates the User (same one-time-reveal
   * temp-password convention as TeamService.invite()), then grants an
   * ACTIVE OWNER membership.
   *
   * Additive, not exclusive: an existing owner's own access is never
   * touched, so this can also be used to add a co-owner rather than
   * replace one — a real "transfer ownership away from someone" action
   * would need its own explicit design (and its own confirmation UX),
   * which wasn't what was asked for here. If the person already has
   * some other membership on this business (most likely STAFF), it's
   * promoted to OWNER in place rather than creating a second row
   * (userId_businessId is unique per business).
   *
   * Owner memberships are created ACTIVE, not INVITED — unlike a STAFF
   * invite, there's no "first login flips it to ACTIVE" logic on the
   * OWNER branch of AuthService.buildProfile (it only ever returns
   * memberships that are already ACTIVE), so INVITED would leave a
   * brand-new owner completely unable to log in.
   */
  private async grantOwner(
    businessId: string,
    name: string,
    email: string,
  ): Promise<{ temporaryPassword: string | null; promoted: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    let temporaryPassword: string | null = null;

    if (!user) {
      temporaryPassword = crypto.randomBytes(6).toString('base64url');
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      user = await this.prisma.user.create({ data: { name, email: normalizedEmail, passwordHash } });
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: user.id, businessId } },
    });

    if (existing) {
      await this.prisma.membership.update({
        where: { id: existing.id },
        data: {
          role: MembershipRole.OWNER,
          teamRole: TeamRole.OWNER,
          status: MembershipStatus.ACTIVE,
          joinedAt: existing.joinedAt ?? new Date(),
        },
      });
      return { temporaryPassword, promoted: true };
    }

    await this.prisma.membership.create({
      data: {
        userId: user.id,
        businessId,
        role: MembershipRole.OWNER,
        teamRole: TeamRole.OWNER,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });
    return { temporaryPassword, promoted: false };
  }
}
