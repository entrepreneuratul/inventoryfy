import { IsEmail, IsEnum, IsString, MinLength, ValidateIf } from 'class-validator';
import { MembershipRole } from '../../../generated/prisma/enums';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;

  // Required when logging in as staff: which business context to authenticate against.
  // Ignored (and unvalidated) for owner logins, who resolve their businesses from memberships.
  @ValidateIf((dto: LoginDto) => dto.role === MembershipRole.STAFF)
  @IsString()
  businessId?: string;
}
