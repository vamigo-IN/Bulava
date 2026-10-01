import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { platformRoleHasPermission, type PlatformPermission } from '@bulava/auth';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PLATFORM_PERMISSION } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';
import type { AuthenticatedRequest } from '../request-context';

/**
 * Admin routes. The platform role is re-read from the database (not trusted
 * from the JWT) so demotions take effect immediately. With STAFF_MFA_REQUIRED
 * (the production default) the session must also have passed two-step sign-in.
 */
@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<PlatformPermission | undefined>(PLATFORM_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
    const user = await this.prisma.user.findUnique({ where: { id: request.user.id }, select: { platformRole: true, status: true, deletedAt: true } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt || !platformRoleHasPermission(user.platformRole, permission)) {
      // 404 so the admin surface is not advertised to regular users.
      throw AppError.notFound('Page');
    }
    if (this.config.staffMfaRequired && !request.user.mfa) {
      throw new AppError('MFA_REQUIRED', 'Staff tools need two-step sign-in. Set it up in Security, then sign in again.');
    }
    request.user.platformRole = user.platformRole;
    return true;
  }
}
