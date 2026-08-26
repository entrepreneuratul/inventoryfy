import { SetMetadata } from '@nestjs/common';
import type { Capability } from '@inventoryfy/shared-types';

export const CAPABILITY_KEY = 'capability';
export const RequireCapability = (capability: Capability) => SetMetadata(CAPABILITY_KEY, capability);
