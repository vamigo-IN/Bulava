import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { permissionsForEventRole, type EventPermission } from '@bulava/auth';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EVENT_PERMISSION } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';
import type { AuthenticatedRequest } from '../request-context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenant isolation. For any route marked @RequireEventPermission, the
 * :eventId route param is checked against the caller's EventMember row.
 * The eventId comes from the URL, is never trusted from the body, and
 * services must scope every query by the eventId attached here.
 */
@Injectable()
export class EventPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<EventPermission | undefined>(EVENT_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');

    const rawEventId = request.params.eventId;
    const eventId = typeof rawEventId === 'string' ? rawEventId.toLowerCase() : undefined;
    if (!eventId || !UUID.test(eventId)) throw AppError.notFound('Event');

    const membership = await this.prisma.eventMember.findFirst({
      where: { eventId, userId: user.id, event: { deletedAt: null } },
      select: { role: true, functionIds: true },
    });
    // Non-members get 404, not 403, so event ids cannot be probed.
    if (!membership) throw AppError.notFound('Event');

    const permissions = permissionsForEventRole(membership.role);
    if (!permissions.includes(permission)) throw AppError.forbidden();

    request.eventAccess = {
      eventId,
      userId: user.id,
      role: membership.role,
      permissions,
      functionIds: membership.functionIds,
    };
    return true;
  }
}
