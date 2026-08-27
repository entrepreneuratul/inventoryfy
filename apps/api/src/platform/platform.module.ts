import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [PlatformController, OnboardingController],
  providers: [PlatformService, OnboardingService],
})
export class PlatformModule {}
