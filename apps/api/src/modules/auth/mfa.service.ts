import { Inject, Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateSecureToken,
  generateTotpSecret,
  hashToken,
  normalizeRecoveryCode,
  totpUri,
  verifyPassword,
  verifyTotp,
} from '@bulava/auth';
import type { LoginMfaInput, MfaDisableInput } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { SessionService, type IssuedSession } from './session.service';

const ISSUER = 'Bulava';
const SETUP_TTL_SECONDS = 10 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;
const MAX_CHALLENGE_ATTEMPTS = 5;
/** Per-user cap on wrong second-factor codes, across challenges (15 min window). */
const MAX_MFA_FAILURES = 10;
const MFA_LOCKOUT_SECONDS = 15 * 60;

type SecondFactor = { code?: string; recoveryCode?: string };
type MfaUser = { id: string; platformRole: string; totpSecretCiphertext: string | null; totpEnabledAt: Date | null; totpLastStep: number | null };

/**
 * Two-step sign-in with an authenticator app (TOTP) and one-time recovery
 * codes. Enrollment is confirmed with a live code before it takes effect;
 * sign-in with a second factor goes through a short-lived challenge so the
 * password step never yields a session on its own.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async status(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpEnabledAt: true, platformRole: true } });
    const recoveryCodesRemaining = user.totpEnabledAt ? await this.prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } }) : 0;
    return {
      enabled: Boolean(user.totpEnabledAt),
      enabledAt: user.totpEnabledAt,
      recoveryCodesRemaining,
      requiredForStaff: this.config.staffMfaRequired && user.platformRole !== 'USER',
    };
  }

  /** Step 1 of enrollment: a new secret, held in Redis until a code confirms it. */
  async beginSetup(userId: string, password: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabledAt) throw new AppError('MFA_ALREADY_ENABLED', 'Two-step sign-in is already on.');
    await this.assertPassword(user, password, meta);
    const secret = generateTotpSecret();
    await this.redis.client.set(this.setupKey(userId), encryptSecret(secret, this.config.TOKEN_ENCRYPTION_KEY), 'EX', SETUP_TTL_SECONDS);
    const otpauthUri = totpUri({ secret, account: user.email ?? user.name, issuer: ISSUER });
    const qrSvg = await QRCode.toString(otpauthUri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return { secret, otpauthUri, qrSvg, expiresInSeconds: SETUP_TTL_SECONDS };
  }

  /**
   * Step 2: a live code proves the app holds the secret. Every existing
   * session ends and the caller gets a fresh, verified one.
   */
  async enable(userId: string, code: string, meta: RequestMeta): Promise<{ recoveryCodes: string[]; session: IssuedSession }> {
    const pending = await this.redis.client.get(this.setupKey(userId));
    if (!pending) throw new AppError('MFA_CHALLENGE_EXPIRED', 'Setup expired. Please start again.');
    const secret = decryptSecret(pending, this.config.TOKEN_ENCRYPTION_KEY);
    const step = verifyTotp(secret, code);
    if (step === null) throw new AppError('MFA_INVALID', 'That code did not match. Check the time on your phone and try again.');

    const recoveryCodes = generateRecoveryCodes();
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, totpEnabledAt: null },
        data: { totpSecretCiphertext: pending, totpEnabledAt: new Date(), totpLastStep: step },
      });
      if (updated.count !== 1) throw new AppError('MFA_ALREADY_ENABLED', 'Two-step sign-in is already on.');
      await this.replaceRecoveryCodes(tx, userId, recoveryCodes);
      await this.sessions.revokeAllForUser(userId, tx);
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.mfa_enabled', targetType: 'User', targetId: userId, meta }, tx);
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, platformRole: true } });
    });
    await this.redis.client.del(this.setupKey(userId));
    const session = await this.sessions.issue(user, meta, { mfa: true });
    return { recoveryCodes, session };
  }

  /** Turning the second factor off needs the password and a current code (or a recovery code). */
  async disable(userId: string, input: MfaDisableInput, meta: RequestMeta): Promise<IssuedSession> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabledAt) throw new AppError('MFA_NOT_ENABLED', 'Two-step sign-in is not on.');
    await this.assertPassword(user, input.password, meta);
    await this.assertSecondFactor(user, input, meta);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { totpSecretCiphertext: null, totpEnabledAt: null, totpLastStep: null } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await this.sessions.revokeAllForUser(userId, tx);
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.mfa_disabled', targetType: 'User', targetId: userId, meta }, tx);
    });
    return this.sessions.issue(user, meta, { mfa: false });
  }

  async regenerateRecoveryCodes(userId: string, code: string, meta: RequestMeta): Promise<string[]> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabledAt) throw new AppError('MFA_NOT_ENABLED', 'Two-step sign-in is not on.');
    await this.assertSecondFactor(user, { code }, meta);
    const codes = generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await this.replaceRecoveryCodes(tx, userId, codes);
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.mfa_recovery_regenerated', targetType: 'User', targetId: userId, meta }, tx);
    });
    return codes;
  }

  // ───── Sign-in ─────

  /** Called after a correct password for a user with a second factor. */
  async createChallenge(userId: string): Promise<{ challengeToken: string; challengeExpiresAt: Date }> {
    const challengeToken = generateSecureToken();
    await this.redis.client.set(this.challengeKey(challengeToken), JSON.stringify({ userId, attempts: 0 }), 'EX', CHALLENGE_TTL_SECONDS);
    return { challengeToken, challengeExpiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000) };
  }

  async completeLogin(input: LoginMfaInput, meta: RequestMeta) {
    const key = this.challengeKey(input.challengeToken);
    const raw = await this.redis.client.get(key);
    if (!raw) throw new AppError('MFA_CHALLENGE_EXPIRED', 'This sign-in step expired. Please sign in again.');
    const challenge = JSON.parse(raw) as { userId: string; attempts: number };

    const user = await this.prisma.user.findUnique({ where: { id: challenge.userId } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt || !user.totpEnabledAt) {
      await this.redis.client.del(key);
      throw new AppError('MFA_CHALLENGE_EXPIRED', 'This sign-in step expired. Please sign in again.');
    }
    try {
      const method = await this.assertSecondFactor(user, input, meta);
      await this.redis.client.del(key);
      const session = await this.sessions.issue(user, meta, { mfa: true });
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.login', targetType: 'User', targetId: user.id, metadata: { secondFactor: method }, meta });
      const recoveryCodesRemaining = await this.prisma.mfaRecoveryCode.count({ where: { userId: user.id, usedAt: null } });
      return { user, session, recoveryCodesRemaining };
    } catch (error) {
      const attempts = challenge.attempts + 1;
      if (attempts >= MAX_CHALLENGE_ATTEMPTS) await this.redis.client.del(key);
      else await this.redis.client.set(key, JSON.stringify({ ...challenge, attempts }), 'KEEPTTL');
      throw error;
    }
  }

  /**
   * Re-confirms identity before a sensitive staff action (handing over the Super
   * Admin role, resetting someone's two-step sign-in): the password, plus a code
   * from the authenticator when two-step is on. Wrong codes count toward the lockout.
   */
  async confirmSensitiveAction(userId: string, input: { password: string; code?: string }, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.assertPassword(user, input.password, meta);
    if (user.totpEnabledAt) {
      if (!input.code) throw new AppError('MFA_REQUIRED', 'Enter the code from your authenticator app.');
      await this.assertSecondFactor(user, { code: input.code }, meta);
    }
  }

  // ───── Internals ─────

  /** Returns which factor matched; a wrong code counts toward the per-user lockout. */
  private async assertSecondFactor(user: MfaUser, input: SecondFactor, meta: RequestMeta): Promise<'totp' | 'recovery'> {
    const failKey = `mfa-fail:${user.id}`;
    if (Number((await this.redis.client.get(failKey)) ?? 0) >= MAX_MFA_FAILURES) {
      throw new AppError('RATE_LIMITED', 'Too many wrong codes. Please try again later.');
    }
    const method = input.recoveryCode ? await this.useRecoveryCode(user.id, input.recoveryCode) : await this.useTotp(user, input.code ?? '');
    if (method) {
      await this.redis.client.del(failKey);
      if (method === 'recovery') {
        await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.mfa_recovery_used', targetType: 'User', targetId: user.id, meta });
      }
      return method;
    }
    await this.redis.client.multi().incr(failKey).expire(failKey, MFA_LOCKOUT_SECONDS).exec();
    await this.audit.record({
      actorType: 'USER',
      actorId: user.id,
      action: 'user.mfa_verify',
      targetType: 'User',
      targetId: user.id,
      result: 'FAILURE',
      metadata: { method: input.recoveryCode ? 'recovery' : 'totp' },
      meta,
    });
    throw new AppError('MFA_INVALID', 'That code did not work. Check your authenticator app and try again.');
  }

  private async useTotp(user: MfaUser, code: string): Promise<'totp' | null> {
    if (!user.totpSecretCiphertext) return null;
    const secret = decryptSecret(user.totpSecretCiphertext, this.config.TOKEN_ENCRYPTION_KEY);
    const step = verifyTotp(secret, code, { lastUsedStep: user.totpLastStep });
    if (step === null) return null;
    // Conditional update: two concurrent requests with the same code cannot both succeed.
    const claimed = await this.prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return claimed.count === 1 ? 'totp' : null;
  }

  private async useRecoveryCode(userId: string, code: string): Promise<'recovery' | null> {
    const used = await this.prisma.mfaRecoveryCode.updateMany({
      where: { userId, codeHash: hashToken(normalizeRecoveryCode(code)), usedAt: null },
      data: { usedAt: new Date() },
    });
    return used.count === 1 ? 'recovery' : null;
  }

  private async replaceRecoveryCodes(tx: Pick<PrismaService, 'mfaRecoveryCode'>, userId: string, codes: string[]) {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashToken(normalizeRecoveryCode(c)) })) });
  }

  private async assertPassword(user: { id: string; passwordHash: string | null }, password: string, meta: RequestMeta) {
    if (user.passwordHash && (await verifyPassword(password, user.passwordHash))) return;
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.password_check', targetType: 'User', targetId: user.id, result: 'FAILURE', meta });
    throw new AppError('INVALID_CREDENTIALS', 'Password is incorrect.');
  }

  private setupKey(userId: string) {
    return `mfa-setup:${userId}`;
  }

  private challengeKey(token: string) {
    return `mfa-challenge:${hashToken(token)}`;
  }
}
