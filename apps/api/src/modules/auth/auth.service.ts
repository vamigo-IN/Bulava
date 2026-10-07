import { Injectable } from '@nestjs/common';
import { hashPassword, verifyPassword } from '@bulava/auth';
import type { ClaimAccountInput, LoginInput, SetPasswordInput, SignupInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { maskTarget } from '../guest-access/otp.service';
import { PhoneOtpService } from '../onboarding/phone-otp.service';
import { AccountService } from '../users/account.service';
import { ConsentService } from '../users/consent.service';
import { MfaService } from './mfa.service';
import { toPublicUser, type PublicUser } from './public-user';
import { SessionService, type IssuedSession } from './session.service';

export { toPublicUser, type PublicUser } from './public-user';

const MAX_FAILED_LOGINS = 10;
const LOCKOUT_SECONDS = 15 * 60;

/** Signing in to an account waiting to be deleted: no session yet, only the offer to restore it. */
export interface RestoreOffer {
  restoreRequired: true;
  restoreToken: string;
  deleteAt: Date;
}

@Injectable()
export class AuthService {
  /** Used to keep login timing constant when the email does not exist. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
    private readonly consents: ConsentService,
    private readonly account: AccountService,
    private readonly phoneOtp: PhoneOtpService,
  ) {}

  async signup(input: SignupInput, meta: RequestMeta): Promise<{ user: PublicUser; session: IssuedSession }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.');
    if (input.phone && (await this.prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } }))) {
      throw new AppError('PHONE_TAKEN', 'An account already uses this WhatsApp number. Sign in with it instead.');
    }

    const [passwordHash, versions] = await Promise.all([hashPassword(input.password), this.consents.versions(['terms', 'privacy'])]);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash, phone: input.phone ?? null, whatsappOptInAt: input.phone && input.whatsappUpdates ? new Date() : null },
      });
      // The ticked box on the sign-up form: the Terms and the Privacy Policy, with the versions shown.
      await this.consents.recordSignup(tx, created.id, versions, 'signup');
      // A separate, optional tick: updates on WhatsApp.
      if (input.phone && input.whatsappUpdates) await this.consents.recordWhatsAppUpdates(tx, created.id, true, 'signup');
      await this.audit.record({ actorType: 'USER', actorId: created.id, action: 'user.signup', targetType: 'User', targetId: created.id, meta }, tx);
      return created;
    });
    const session = await this.sessions.issue(user, meta);
    return { user: toPublicUser(user), session };
  }

  /**
   * A sign-in code to a WhatsApp number. Numbers without an account get the
   * same answer and no message, so the form cannot be used to look numbers up.
   */
  async requestPhoneCode(phone: string, meta: RequestMeta): Promise<{ sent: true; target: string }> {
    await this.phoneOtp.assertAvailable();
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, status: true, deletedAt: true } });
    if (user && user.status === 'ACTIVE' && !user.deletedAt) {
      await this.phoneOtp.send(phone, 'login');
      await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.phone_code_sent', targetType: 'User', targetId: user.id, meta });
    }
    return { sent: true, target: maskTarget(phone) };
  }

  /** The code from WhatsApp signs the account in: no password, and the number counts as verified. */
  async loginWithPhone(
    phone: string,
    code: string,
    meta: RequestMeta,
  ): Promise<{ user: PublicUser; session: IssuedSession } | { mfaRequired: true; challengeToken: string; challengeExpiresAt: Date } | RestoreOffer> {
    await this.phoneOtp.verify(phone, code, 'login');
    const found = await this.prisma.user.findUnique({ where: { phone } });
    if (found && AccountService.restorable(found)) {
      await this.audit.record({ actorType: 'USER', actorId: found.id, action: 'user.restore_offered', targetType: 'User', targetId: found.id, meta });
      return { restoreRequired: true, restoreToken: await this.account.restoreToken(found.id), deleteAt: found.deletionScheduledAt! };
    }
    if (!found || found.status !== 'ACTIVE' || found.deletedAt) {
      await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.login', targetType: 'User', targetId: found?.id ?? null, result: 'FAILURE', metadata: { reason: 'NO_ACCOUNT', method: 'whatsapp_otp' }, meta });
      throw new AppError('INVALID_CREDENTIALS', 'No account uses this number.');
    }
    // A verified number secures a provisional account.
    const user = await this.prisma.user.update({ where: { id: found.id }, data: { phoneVerifiedAt: found.phoneVerifiedAt ?? new Date(), provisional: false } });
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.login', targetType: 'User', targetId: user.id, metadata: { method: 'whatsapp_otp' }, meta });
    if (user.totpEnabledAt) return { mfaRequired: true, ...(await this.mfa.createChallenge(user.id)) };
    const session = await this.sessions.issue(user, meta);
    return { user: toPublicUser(user), session };
  }

  /**
   * An account made from a WhatsApp number alone adds an email and a password:
   * it can then sign in anywhere, receive receipts, publish and pay.
   */
  async claim(userId: string, input: ClaimAccountInput, meta: RequestMeta): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.provisional) throw new AppError('CONFLICT', 'This account is already secured.');
    const taken = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (taken) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.');
    const passwordHash = await hashPassword(input.password);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id: userId }, data: { email: input.email, passwordHash, name: input.name ?? user.name, provisional: false } });
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.claimed', targetType: 'User', targetId: userId, meta }, tx);
      return row;
    });
    return toPublicUser(updated);
  }

  /**
   * Password step. Accounts with two-step sign-in get a short-lived challenge
   * instead of a session; `MfaService.completeLogin` finishes the sign-in. An
   * account waiting to be deleted gets the offer to restore it instead.
   */
  async login(
    input: LoginInput,
    meta: RequestMeta,
  ): Promise<{ user: PublicUser; session: IssuedSession } | { mfaRequired: true; challengeToken: string; challengeExpiresAt: Date } | RestoreOffer> {
    const lockKey = `login-fail:${input.email}`;
    const failures = Number((await this.redis.client.get(lockKey)) ?? 0);
    if (failures >= MAX_FAILED_LOGINS) {
      throw new AppError('RATE_LIMITED', 'Too many failed attempts. Please try again later.');
    }

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = user?.passwordHash
      ? await verifyPassword(input.password, user.passwordHash)
      : await this.burnPasswordCheck(input.password);

    // The right password for an account in its restore window: offer to restore it, nothing else.
    if (user && valid && AccountService.restorable(user)) {
      await this.redis.client.del(lockKey);
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.restore_offered', targetType: 'User', targetId: user.id, meta });
      return { restoreRequired: true, restoreToken: await this.account.restoreToken(user.id), deleteAt: user.deletionScheduledAt! };
    }

    if (!user || !valid || user.status !== 'ACTIVE' || user.deletedAt) {
      await this.redis.client.multi().incr(lockKey).expire(lockKey, LOCKOUT_SECONDS).exec();
      await this.audit.record({
        actorType: 'ANONYMOUS',
        action: 'user.login',
        targetType: 'User',
        targetId: user?.id ?? null,
        result: 'FAILURE',
        metadata: { reason: 'INVALID_CREDENTIALS' },
        meta,
      });
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    await this.redis.client.del(lockKey);
    if (user.totpEnabledAt) return { mfaRequired: true, ...(await this.mfa.createChallenge(user.id)) };
    const session = await this.sessions.issue(user, meta);
    return { user: toPublicUser(user), session };
  }

  /**
   * Set a first password (accounts created with Google) or change it (the
   * current password is required). Other sessions end; the caller gets a
   * fresh session that keeps its two-step status.
   */
  async setPassword(userId: string, input: SetPasswordInput, meta: RequestMeta, sessionMfa: boolean): Promise<IssuedSession> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const changing = Boolean(user.passwordHash);
    if (changing && !(input.currentPassword && (await verifyPassword(input.currentPassword, user.passwordHash!)))) {
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.password_check', targetType: 'User', targetId: userId, result: 'FAILURE', meta });
      throw new AppError('INVALID_CREDENTIALS', 'Your current password is incorrect.');
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await this.sessions.revokeAllForUser(userId, tx);
      await this.audit.record(
        { actorType: 'USER', actorId: userId, action: changing ? 'user.password_changed' : 'user.password_set', targetType: 'User', targetId: userId, meta },
        tx,
      );
    });
    return this.sessions.issue(user, meta, { mfa: sessionMfa });
  }

  private async burnPasswordCheck(password: string): Promise<false> {
    this.dummyHash ??= hashPassword('bulava-timing-equalizer');
    await verifyPassword(password, await this.dummyHash);
    return false;
  }
}
