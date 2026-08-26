import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import type { RequestUser } from '../auth/types';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
// A handful of writes that aren't meaningful audit events on their own —
// login issues no business-scoped side effect, and the CSV/report/schedule
// routes below are themselves either reads-in-disguise or already covered
// by their target resource's own mutation.
const SKIP_PATH_SEGMENTS = new Set(['login']);

/**
 * Writes one AuditLogEntry per successful mutating request under
 * /businesses/:businessId/*, without instrumenting each service by hand.
 * Registered globally in main.ts. Never blocks or fails the response —
 * the write happens after the handler already succeeded, and any error
 * writing it is swallowed by AuditService itself.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method;

    if (!MUTATING_METHODS.has(method)) return next.handle();

    const routePath: string | undefined = request.route?.path;
    if (!routePath || !routePath.startsWith('/businesses/:businessId/')) return next.handle();

    const segments = routePath.split('/').filter(Boolean); // ['businesses', ':businessId', 'products', ...]
    const entity = segments[2];
    if (!entity || SKIP_PATH_SEGMENTS.has(entity)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const user: RequestUser | undefined = request.user;
        const businessId: string | undefined = request.params?.businessId;
        if (!user || !businessId) return;
        this.audit.record({
          businessId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          action: method,
          entity,
          path: request.originalUrl ?? request.url,
        });
      }),
    );
  }
}
