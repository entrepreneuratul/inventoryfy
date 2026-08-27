import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/** Global — every module that needs to send an email (currently just
 * PlatformModule's onboarding leads) injects this without importing it
 * explicitly each time. */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
