import { Controller, Delete, Get, HttpCode, Inject, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CurrentUser, ReqMeta, type RequestMeta } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser } from '../../common/request-context';
import { PLATFORM_ROLE_PERMISSIONS, type PlatformRole } from '@bulava/auth';
import { AuditService } from '../audit/audit.service';
import { toPublicUser } from '../auth/auth.service';
import { clearSessionCookies } from '../auth/cookies';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const row = await this.prisma.user.findFirst({ where: { id: user.id, deletedAt: null, status: 'ACTIVE' } });
    if (!row) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
    // UI hints for staff tools; every admin route re-checks the role (and the second factor) itself.
    return {
      ...toPublicUser(row),
      platformPermissions: [...PLATFORM_ROLE_PERMISSIONS[row.platformRole as PlatformRole]],
      mfaEnabled: Boolean(row.totpEnabledAt),
      hasPassword: Boolean(row.passwordHash),
      googleLinked: Boolean(row.googleSub),
      mfaVerified: user.mfa,
      mfaRequired: this.config.staffMfaRequired && row.platformRole !== 'USER',
    };
  }

  /** Personal data export (privacy): profile, events owned, orders and consents. */
  @Get('me/export')
  async export(@CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta, @Res() res: Response) {
    const data = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        locale: true,
        createdAt: true,
        ownedEvents: { select: { id: true, title: true, typeKey: true, status: true, createdAt: true, deletedAt: true } },
        orders: { select: { id: true, status: true, amountMinor: true, currency: true, createdAt: true } },
        consents: true,
      },
    });
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.data_exported', targetType: 'User', targetId: user.id, meta });
    res
      .status(200)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="bulava-my-data.json"')
      .setHeader('Cache-Control', 'no-store')
      .send(JSON.stringify(data, null, 2));
  }

  /**
   * Account deletion: personal fields are anonymized immediately, sessions
   * revoked and owned events closed (links stop working). Rows are kept only
   * as long as the retention policy requires for audit and accounting.
   */
  @Delete('me')
  @HttpCode(200)
  async deleteMe(@CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const events = await tx.event.findMany({ where: { ownerId: user.id, deletedAt: null }, select: { id: true } });
      const ids = events.map((e) => e.id);
      await tx.event.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } });
      await tx.invitation.updateMany({ where: { eventId: { in: ids }, status: { not: 'REVOKED' } }, data: { status: 'REVOKED', revokedAt: now } });
      await tx.invitationToken.updateMany({ where: { eventId: { in: ids }, revokedAt: null }, data: { revokedAt: now } });
      await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.user.update({
        where: { id: user.id },
        data: { name: 'Deleted user', email: null, phone: null, passwordHash: null, googleSub: null, totpSecretCiphertext: null, totpEnabledAt: null, totpLastStep: null, status: 'DELETED', deletedAt: now },
      });
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.deleted', targetType: 'User', targetId: user.id, metadata: { eventsClosed: ids.length }, meta }, tx);
    });
    clearSessionCookies(res, this.config);
    return { deleted: true };
  }
}
