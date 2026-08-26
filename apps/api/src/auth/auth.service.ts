import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { BusinessSummary, LoginResponse, MeResponse } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipRole, MembershipStatus } from '../../generated/prisma/enums';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, RequestUser } from './types';

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

    const requestUser: RequestUser =
      dto.role === MembershipRole.STAFF
        ? { id: user.id, name: user.name, email: user.email, role: MembershipRole.STAFF, businessId: dto.businessId! }
        : { id: user.id, name: user.name, email: user.email, role: MembershipRole.OWNER, businessId: null };

    // Validates membership status (throws if missing/suspended) and builds
    // the business list — the same logic /auth/me uses on every refresh.
    const profile = await this.buildProfile(requestUser);

    const payload: JwtPayload = { sub: user.id, role: requestUser.role, businessId: requestUser.businessId };
    return { accessToken: await this.jwt.signAsync(payload), ...profile };
  }

  async me(user: RequestUser): Promise<MeResponse> {
    return this.buildProfile(user);
  }

  private async buildProfile(user: RequestUser): Promise<MeResponse> {
    if (user.role === MembershipRole.STAFF) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_businessId: { userId: user.id, businessId: user.businessId! } },
        include: { business: true },
      });
      if (!membership || membership.role !== MembershipRole.STAFF) {
        throw new UnauthorizedException('No staff access to that business');
      }
      if (membership.status !== MembershipStatus.ACTIVE) {
        throw new UnauthorizedException('This account has been suspended');
      }
      return {
        user: { id: user.id, name: user.name, email: user.email },
        role: 'STAFF',
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
      user: { id: user.id, name: user.name, email: user.email },
      role: 'OWNER',
      businesses: memberships.map((m) => toBusinessSummary(m.business)),
    };
  }
}

function toBusinessSummary(business: { id: string; name: string; type: string | null; currency: string }): BusinessSummary {
  return { id: business.id, name: business.name, type: business.type, currency: business.currency };
}
