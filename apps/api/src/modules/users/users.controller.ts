import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DeleteAccountSchema, PhoneConfirmSchema, UpdateProfileSchema, type DeleteAccountInput, type PhoneConfirmInput, type UpdateProfileInput } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CurrentUser, ReqMeta, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser } from '../../common/request-context';
import { PLATFORM_ROLE_PERMISSIONS, type PlatformRole } from '@bulava/auth';
import { AuditService } from '../audit/audit.service';
import { toPublicUser } from '../auth/public-user';
import { clearSessionCookies } from '../auth/cookies';
import { AccountService } from './account.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly account: AccountService,
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
      emailVerified: Boolean(row.emailVerifiedAt),
      phoneVerified: Boolean(row.phoneVerifiedAt),
      mfaVerified: user.mfa,
      mfaRequired: this.config.staffMfaRequired && row.platformRole !== 'USER',
    };
  }

  /** Name, WhatsApp number and the WhatsApp-updates consent. */
  @Patch('me')
  @ApiZodBody(UpdateProfileSchema)
  update(@CurrentUser() user: AuthUser, @ZodBody(UpdateProfileSchema) body: UpdateProfileInput, @ReqMeta() meta: RequestMeta) {
    return this.account.updateProfile(user.id, body, meta);
  }

  /** A code on WhatsApp to confirm the account's number (`sendId` tells whether the message got through). */
  @Post('me/phone/code')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendPhoneCode(@CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.account.sendPhoneConfirmation(user.id, meta);
  }

  /** The code confirms the number: it then signs in with WhatsApp too. */
  @Post('me/phone/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(PhoneConfirmSchema)
  confirmPhone(@CurrentUser() user: AuthUser, @ZodBody(PhoneConfirmSchema) body: PhoneConfirmInput, @ReqMeta() meta: RequestMeta) {
    return this.account.confirmPhone(user.id, body.code, meta);
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
   * Account deletion, with a way back: the owner's events go offline and the
   * account is erased ACCOUNT_RESTORE_DAYS later by the worker, unless the owner
   * signs in before then and restores it. Needs the password (or, for accounts
   * without one, the word DELETE).
   */
  @Delete('me')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiZodBody(DeleteAccountSchema)
  async deleteMe(@CurrentUser() user: AuthUser, @ZodBody(DeleteAccountSchema) body: DeleteAccountInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { deleteAt } = await this.account.scheduleDeletion(user.id, body, meta);
    clearSessionCookies(res, this.config);
    return { scheduled: true, deleteAt };
  }
}
