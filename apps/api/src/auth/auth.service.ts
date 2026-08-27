import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { BusinessSummary, LoginResponse, MeResponse } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipRole, MembershipStatus, TeamRole } from '../../generated/prisma/enums';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, RequestUser } from './types';

type Identity = Pick<RequestUser, 'id' | 'name' | 'email' | 'role' | 'businessId' | 'isSuperOwner'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid email or password');

    const identity: Identity =
      dto.role === MembershipRole.STAFF
        ? { id: user.id, name: user.name, email: user.email, role: MembershipRole.STAFF, businessId: dto.businessId!, isSuperOwner: user.isSuperOwner }
        : { id: user.id, name: user.name, email: user.email, role: MembershipRole.OWNER, businessId: null, isSuperOwner: user.isSuperOwner };

    // Validates membership status (throws if missing/suspended), flips a
    // first-time INVITED membership to ACTIVE, and builds the business
    // list — the same logic /auth/me uses on every refresh.
    const profile = await this.buildProfile(identity);

    const payload: JwtPayload = { sub: user.id, role: identity.role, businessId: identity.businessId };
    return { accessToken: await this.jwt.signAsync(payload), ...profile };
  }

  async me(user: RequestUser): Promise<MeResponse> {
    return this.buildProfile(user);
  }

  private async buildProfile(user: Identity): Promise<MeResponse> {
    if (user.role === MembershipRole.STAFF) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_businessId: { userId: user.id, businessId: user.businessId! } },
        include: { business: true },
      });
      if (!membership || membership.role !== MembershipRole.STAFF) {
        throw new UnauthorizedException('No staff access to that business');
      }
      if (membership.status === MembershipStatus.SUSPENDED) {
        throw new UnauthorizedException('This account has been suspended');
      }
      // First successful login accepts the invite — there's no separate
      // "accept" step since there's no email link to click.
      if (membership.status === MembershipStatus.INVITED) {
        await this.prisma.membership.update({
          where: { id: membership.id },
          data: { status: MembershipStatus.ACTIVE, joinedAt: new Date() },
        });
      }
      return {
        user: { id: user.id, name: user.name, email: user.email, isSuperOwner: user.isSuperOwner },
        role: 'STAFF',
        teamRole: membership.teamRole,
        businesses: [toBusinessSummary(membership.business)],
      };
    }

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
      include: { business: true },
      orderBy: { business: { name: 'asc' } },
    });
    if (memberships.length === 0) {
      throw new UnauthorizedException('No active owner access to any business');
    }
    return {
      user: { id: user.id, name: user.name, email: user.email, isSuperOwner: user.isSuperOwner },
      role: 'OWNER',
      teamRole: TeamRole.OWNER,
      businesses: memberships.map((m) => toBusinessSummary(m.business)),
    };
  }
}

function toBusinessSummary(business: { id: string; name: string; type: string | null; currency: string }): BusinessSummary {
  return { id: business.id, name: business.name, type: business.type, currency: business.currency };
}
