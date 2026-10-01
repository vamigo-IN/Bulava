import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';
import type { AuthenticatedRequest } from '../request-context';
import { SessionService } from '../../modules/auth/session.service';
import { ACCESS_COOKIE } from '../../modules/auth/cookies';

/**
 * Global authentication. Accepts the access JWT from the httpOnly cookie
 * (browsers) or an Authorization: Bearer header (API clients).
 * Routes are private by default; @Public() opts out.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);

    const bearer = request.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookie = (request.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    const token = bearer ?? cookie;
    const claims = token ? this.sessions.verifyAccessToken(token) : null;

    if (claims) {
      request.user = { id: claims.sub, platformRole: claims.pr, via: bearer ? 'bearer' : 'cookie', mfa: claims.mfa === true };
    }
    if (isPublic) return true;
    if (!request.user) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
    return true;
  }
}
