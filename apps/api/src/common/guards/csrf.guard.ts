import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { SKIP_CSRF } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';
import { EventLinksService } from '../../modules/domains/event-links.service';
import type { AuthenticatedRequest } from '../request-context';

export const CSRF_HEADER = 'x-bulava-csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated browsers:
 *  1. Every state-changing request must carry the custom X-Bulava-CSRF header.
 *     Browsers cannot attach custom headers cross-origin without a CORS
 *     preflight, and CORS only allows Bulava origins.
 *  2. If an Origin header is present, it must be an allowed origin (the apps,
 *     or an event's live custom domain).
 * Combined with SameSite=Lax cookies this blocks cross-site form posts.
 * Bearer-token requests are not CSRF-able and skip the header check.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly links: EventLinksService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [context.getHandler(), context.getClass()])) return true;
    if (request.user?.via === 'bearer') return true;

    const origin = request.get('origin');
    // Guests also post from events' live custom domains (RSVP, photos, travel plans).
    if (origin && !this.config.allowedOrigins.includes(origin) && !(await this.links.isCustomerOrigin(origin))) {
      throw new AppError('CSRF_REJECTED', 'Request origin not allowed.');
    }
    if (request.get(CSRF_HEADER) !== '1') {
      throw new AppError('CSRF_REJECTED', 'Missing CSRF header.');
    }
    return true;
  }
}
