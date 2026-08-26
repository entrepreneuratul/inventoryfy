import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { InviteTeamMemberDto } from './dto/team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../auth/guards/business-access.guard';
import { CapabilityGuard } from '../auth/guards/capability.guard';
import { RequireCapability } from '../auth/decorators/require-capability.decorator';

@UseGuards(JwtAuthGuard, BusinessAccessGuard, CapabilityGuard)
@Controller('businesses/:businessId/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  /** Visible to any team member — no capability required (matches the
   * mockup's read-only "Team & roles" screen, open to all logged-in staff). */
  @Get()
  list(@Param('businessId') businessId: string) {
    return this.team.list(businessId);
  }

  @RequireCapability('MANAGE_TEAM')
  @Post('invite')
  invite(@Param('businessId') businessId: string, @Body() dto: InviteTeamMemberDto) {
    return this.team.invite(businessId, dto.name, dto.email, dto.teamRole);
  }

  @RequireCapability('MANAGE_TEAM')
  @Post(':membershipId/toggle-suspend')
  toggleSuspend(@Param('businessId') businessId: string, @Param('membershipId') membershipId: string) {
    return this.team.toggleSuspend(businessId, membershipId);
  }
}
