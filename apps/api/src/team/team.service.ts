import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { InviteResult, TeamMemberRow } from '@inventoryfy/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipRole, MembershipStatus, TeamRole } from '../../generated/prisma/enums';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<TeamMemberRow[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { businessId },
      include: { user: true, business: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(toRow);
  }

  async invite(businessId: string, name: string, email: string, teamRole: TeamRole): Promise<InviteResult> {
    if (teamRole === TeamRole.OWNER) {
      throw new BadRequestException('Owner access is granted separately, not through an invite');
    }

    let user = await this.prisma.user.findUnique({ where: { email } });
    let temporaryPassword: string | null = null;

    if (!user) {
      temporaryPassword = crypto.randomBytes(6).toString('base64url'); // e.g. "k3f9DqYb"
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      user = await this.prisma.user.create({ data: { name, email, passwordHash } });
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: user.id, businessId } },
    });
    if (existing) throw new BadRequestException('This person already has access to this business');

    const membership = await this.prisma.membership.create({
      data: {
        userId: user.id,
        businessId,
        role: MembershipRole.STAFF,
        teamRole,
        status: MembershipStatus.INVITED,
        invitedAt: new Date(),
      },
    });

    return { membershipId: membership.id, email: user.email, temporaryPassword };
  }

  async toggleSuspend(businessId: string, membershipId: string): Promise<TeamMemberRow> {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: true, business: true },
    });
    if (!membership || membership.businessId !== businessId) throw new NotFoundException('Team member not found');
    if (membership.role === MembershipRole.OWNER) {
      throw new BadRequestException("Can't suspend an owner membership");
    }

    const nextStatus = membership.status === MembershipStatus.SUSPENDED ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED;
    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: nextStatus },
      include: { user: true, business: true },
    });
    return toRow(updated);
  }
}

function toRow(m: {
  id: string;
  teamRole: TeamRole;
  status: MembershipStatus;
  user: { name: string; email: string };
  business: { name: string };
}): TeamMemberRow {
  return {
    membershipId: m.id,
    name: m.user.name,
    email: m.user.email,
    teamRole: m.teamRole,
    businessName: m.business.name,
    status: m.status,
  };
}
