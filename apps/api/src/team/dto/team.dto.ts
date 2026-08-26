import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { TeamRole } from '../../../generated/prisma/enums';

export class InviteTeamMemberDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsEnum(TeamRole)
  teamRole!: TeamRole;
}
