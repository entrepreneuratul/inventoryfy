import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationConnectionStatus } from '../../../generated/prisma/enums';

/**
 * Authenticates the public /integrations/v1/* endpoints an external
 * storefront calls — a completely different auth model from the rest of
 * the API (JwtAuthGuard): there's no logged-in user, just a long-lived
 * API key the storefront presents as `Authorization: Bearer <key>`.
 * Looked up by the SHA-256 hash of the key (only the hash is ever stored),
 * and attaches the resolved connection to the request for the controller.
 */
@Injectable()
export class IntegrationApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    const key = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
    if (!key) throw new UnauthorizedException('Missing API key');

    const apiKeyHash = createHash('sha256').update(key).digest('hex');
    const connection = await this.prisma.integrationConnection.findUnique({ where: { apiKeyHash } });
    if (!connection) throw new UnauthorizedException('Invalid API key');
    if (connection.status !== IntegrationConnectionStatus.ACTIVE) {
      throw new UnauthorizedException('This connection is paused');
    }

    request.integrationConnection = connection;
    return true;
  }
}
