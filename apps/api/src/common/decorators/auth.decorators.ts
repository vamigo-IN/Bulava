import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { EventPermission, PlatformPermission } from '@bulava/auth';
import type { AuthenticatedRequest, AuthUser, EventAccessContext } from '../request-context';

export const IS_PUBLIC = 'bulava:is-public';
export const SKIP_CSRF = 'bulava:skip-csrf';
export const EVENT_PERMISSION = 'bulava:event-permission';
export const PLATFORM_PERMISSION = 'bulava:platform-permission';

/** Requires a platform role (SUPPORT / PLATFORM_ADMIN) holding this permission. */
export const RequirePlatformPermission = (permission: PlatformPermission) => SetMetadata(PLATFORM_PERMISSION, permission);

/** Route needs no user session (e.g. signup, guest invitation endpoints). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route is called by third parties that cannot send the CSRF header (e.g. payment webhooks). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

/**
 * Requires the current user to hold `permission` on the event in `:eventId`.
 * Non-members get 404 so event existence is not revealed.
 */
export const RequireEventPermission = (permission: EventPermission) => SetMetadata(EVENT_PERMISSION, permission);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) throw new Error('CurrentUser used on a route without authentication');
  return request.user;
});

export const EventAccess = createParamDecorator((_: unknown, ctx: ExecutionContext): EventAccessContext => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.eventAccess) throw new Error('EventAccess used on a route without RequireEventPermission');
  return request.eventAccess;
});

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent')?.slice(0, 500) ?? null,
  };
});
