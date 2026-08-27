import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { MembershipRole, MembershipStatus, TeamRole } from '../../../generated/prisma/enums';
import { JwtPayload, RequestUser } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Runs on every authenticated request. We re-check membership status in
   * the DB (rather than trusting the token's role/businessId blindly) so
   * that suspending a user, or removing their access to a business, takes
   * effect immediately instead of waiting out the token's expiry.
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User no longer exists');

    if (payload.role === MembershipRole.STAFF) {
      if (!payload.businessId) throw new UnauthorizedException('Missing business context');
      const membership = await this.prisma.membership.findUnique({
        where: { userId_businessId: { userId: user.id, businessId: payload.businessId } },
      });
      if (!membership || membership.role !== MembershipRole.STAFF || membership.status !== MembershipStatus.ACTIVE) {
        throw new UnauthorizedException('Staff access to this business is no longer active');
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: MembershipRole.STAFF,
        teamRole: membership.teamRole,
        businessId: payload.businessId,
        isSuperOwner: user.isSuperOwner,
      };
    }

    // OWNER: must still hold at least one active OWNER membership.
    const ownsAny = await this.prisma.membership.findFirst({
      where: { userId: user.id, role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
    });
    if (!ownsAny) throw new UnauthorizedException('Owner access is no longer active');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: MembershipRole.OWNER,
      teamRole: TeamRole.OWNER,
      businessId: null,
      isSuperOwner: user.isSuperOwner,
    };
  }
}
