import { IsEmail, IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { MembershipRole } from '../../../generated/prisma/enums';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  /** Both optional now — see AuthService.login for how the normal
   * (role-less) case resolves OWNER vs STAFF and which business
   * automatically. Still accepted explicitly for a login-mode picker
   * that wants to force one, or to disambiguate the rare case of
   * someone who's STAFF at more than one business. */
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  // Only meaningful (and only validated) for an explicit STAFF login.
  @ValidateIf((dto: LoginDto) => dto.role === MembershipRole.STAFF)
  @IsString()
  businessId?: string;
}
