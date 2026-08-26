import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { BusinessAccessGuard } from './guards/business-access.guard';
import { CapabilityGuard } from './guards/capability.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        // Seconds, not a "7d"-style string — sidesteps the jsonwebtoken
        // StringValue typing and keeps env parsing unambiguous.
        signOptions: { expiresIn: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 24 * 7 },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, BusinessAccessGuard, CapabilityGuard],
  exports: [RolesGuard, BusinessAccessGuard, CapabilityGuard],
})
export class AuthModule {}
