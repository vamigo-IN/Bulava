import { Inject, Injectable } from '@nestjs/common';
import { generateSecureToken, hashPassword, hashToken, verifyPassword } from '@bulava/auth';
import type { ClaimAccountInput, LoginInput, PhoneSignupInput, SetPasswordInput, SignupInput } from '@bulava/validation';
import type { User } from '@bulava/database';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { maskTarget } from '../guest-access/otp.service';
import { PHONE_RESEND_AFTER_SECONDS, PhoneOtpService } from '../onboarding/phone-otp.service';
import { AccountService } from '../users/account.service';
import { ConsentService } from '../users/consent.service';
import { EmailCodeService, type EmailChallenge } from './email-code.service';
import { MfaService } from './mfa.service';
import { toPublicUser, type PublicUser } from './public-user';
import { SessionService, type IssuedSession } from './session.service';

export { toPublicUser, type PublicUser } from './public-user';

const MAX_FAILED_LOGINS = 10;
const LOCKOUT_SECONDS = 15 * 60;
/** WhatsApp codes one address may ask for in an hour, across numbers (the sign-in form costs a message each time). */
const PHONE_SENDS_PER_IP_HOUR = 20;
/** Minutes to finish making an account after the WhatsApp code proved the number. */
const PHONE_SIGNUP_SECONDS = 15 * 60;

const phoneSignupKey = (token: string) => `phone-signup:${hashToken(token)}`;

export type SignedIn = { user: PublicUser; session: IssuedSession };

/** Signing in to an account waiting to be deleted: no session yet, only the offer to restore it. */
export interface RestoreOffer {
  restoreRequired: true;
  restoreToken: string;
  deleteAt: Date;
}

/** The account has an authenticator app: its code (or a recovery code) finishes the sign-in. */
export interface MfaStep {
  mfaRequired: true;
  challengeToken: string;
  challengeExpiresAt: Date;
}

/** The password was right: the code emailed to the account's address finishes the sign-in. */
export type EmailCodeStep = EmailChallenge & { emailCodeRequired: true };

/** Nothing is saved until the code sent to the address is entered (signing up, adding an email, a reset). */
export type VerificationStep = EmailChallenge & { verificationRequired: true };

/** A WhatsApp code for a number without an account: the token that makes one. */
export interface PhoneSignupStep {
  signupRequired: true;
  signupToken: string;
  /** The number, masked. */
  target: string;
}

export type LoginResult = SignedIn | MfaStep | RestoreOffer;

/** What a sign-up keeps while its code is on the way. */
interface PendingSignup {
  name: string;
  passwordHash: string;
  phone: string | null;
  whatsappUpdates: boolean;
  /** The policy versions shown when the box was ticked. */
  versions: Record<string, string>;
}

/**
 * Signing up and signing in. Every way in proves something the person holds:
 * an email address is confirmed with a code before an account is made with it
 * (or before it is added to one); a password alone never signs in, it is
 * followed by the authenticator app's code or, without one, a code sent to the
 * account's email; a WhatsApp code proves the number. Google sign-in lives in
 * `GoogleAuthService`, the authenticator step in `MfaService`.
 */
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
    private readonly emailCodes: EmailCodeService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Sign-up by email, adding an email and resetting a password need codes that can reach people. */
  private async assertEmailCodes(): Promise<void> {
    if (!(await this.emailCodes.available())) {
      throw new AppError('EMAIL_CODES_UNAVAILABLE', 'We cannot send email codes right now. Continue with Google or WhatsApp instead.');
    }
  }

  // ───── Email and password ─────

  /** Step one of signing up: the details are checked and kept, and a code goes to the address. Nothing is saved yet. */
  async signup(input: SignupInput, meta: RequestMeta): Promise<VerificationStep> {
    await this.assertEmailCodes();
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.');
    if (input.phone && (await this.prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } }))) {
      throw new AppError('PHONE_TAKEN', 'An account already uses this WhatsApp number. Sign in with it instead.');
    }
    const [passwordHash, versions] = await Promise.all([hashPassword(input.password), this.consents.versions(['terms', 'privacy'])]);
    const pending: PendingSignup = { name: input.name, passwordHash, phone: input.phone ?? null, whatsappUpdates: Boolean(input.phone && input.whatsappUpdates), versions };
    const challenge = await this.emailCodes.start('signup', input.email, pending, { name: input.name });
    await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.signup_code_sent', targetType: 'User', meta });
    return { verificationRequired: true, ...challenge };
  }

  /** Step two: the code proves the address, and the account is made with it confirmed. */
  async completeSignup(challengeToken: string, code: string, meta: RequestMeta): Promise<SignedIn> {
    const { email, payload } = await this.emailCodes.verify<PendingSignup>(challengeToken, code, 'signup');
    // The address or the number may have been taken while the code was on its way.
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    const phone = payload.phone && !(await this.prisma.user.findUnique({ where: { phone: payload.phone }, select: { id: true } })) ? payload.phone : null;
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: payload.name,
          email,
          passwordHash: payload.passwordHash,
          emailVerifiedAt: new Date(),
          phone,
          whatsappOptInAt: phone && payload.whatsappUpdates ? new Date() : null,
        },
      });
      // The ticked box on the sign-up form: the Terms and the Privacy Policy, with the versions shown then.
      await this.consents.recordSignup(tx, created.id, payload.versions, 'signup');
      // A separate, optional tick: updates on WhatsApp.
      if (phone && payload.whatsappUpdates) await this.consents.recordWhatsAppUpdates(tx, created.id, true, 'signup');
      await this.audit.record({ actorType: 'USER', actorId: created.id, action: 'user.signup', targetType: 'User', targetId: created.id, metadata: { method: 'email' }, meta }, tx);
      return created;
    });
    const session = await this.sessions.issue(user, meta);
    return { user: toPublicUser(user), session };
  }

  /**
   * Password step. A right password never signs in by itself: accounts with an
   * authenticator app get its challenge (`MfaService.completeLogin`), the others
   * a code by email (`completeLogin`). An account waiting to be deleted is
   * offered a restore once the code is in. In production without email set up,
   * the password alone signs in, as before codes existed (the console warns).
   */
  async login(input: LoginInput, meta: RequestMeta): Promise<LoginResult | EmailCodeStep> {
    const lockKey = `login-fail:${input.email}`;
    const failures = Number((await this.redis.client.get(lockKey)) ?? 0);
    if (failures >= MAX_FAILED_LOGINS) {
      throw new AppError('RATE_LIMITED', 'Too many failed attempts. Please try again later.');
    }

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = user?.passwordHash
      ? await verifyPassword(input.password, user.passwordHash)
      : await this.burnPasswordCheck(input.password);
    const restorable = Boolean(user && AccountService.restorable(user));

    if (!user || !valid || (!restorable && (user.status !== 'ACTIVE' || user.deletedAt))) {
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

    // The authenticator app is the stronger second step; it stays the only one for those accounts.
    if (user.totpEnabledAt) {
      if (restorable) return this.restoreOffer(user, meta);
      return { mfaRequired: true, ...(await this.mfa.createChallenge(user.id)) };
    }
    if (user.email && (await this.emailCodes.available())) {
      const challenge = await this.emailCodes.start('login', user.email, { userId: user.id }, { name: user.name });
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.login_code_sent', targetType: 'User', targetId: user.id, meta });
      return { emailCodeRequired: true, ...challenge };
    }
    if (restorable) return this.restoreOffer(user, meta);
    return this.signIn(user, meta, { method: 'password' });
  }

  /** The emailed code finishes a password sign-in, and confirms the address if it was not yet. */
  async completeLogin(challengeToken: string, code: string, meta: RequestMeta): Promise<LoginResult> {
    const { payload } = await this.emailCodes.verify<{ userId: string }>(challengeToken, code, 'login');
    const found = await this.prisma.user.findUnique({ where: { id: payload.userId } });
    if (!found) throw new AppError('VERIFICATION_EXPIRED', 'This code has expired. Please start again.');
    const user = found.emailVerifiedAt ? found : await this.prisma.user.update({ where: { id: found.id }, data: { emailVerifiedAt: new Date() } });
    if (AccountService.restorable(user)) return this.restoreOffer(user, meta);
    if (user.status !== 'ACTIVE' || user.deletedAt) throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    // Turned on between the two steps: it still applies.
    if (user.totpEnabledAt) return { mfaRequired: true, ...(await this.mfa.createChallenge(user.id)) };
    return this.signIn(user, meta, { method: 'password', secondFactor: 'email' });
  }

  /** Another code for a step that is waiting for one (sign-up, sign-in, a new email, a reset). */
  resendEmailCode(challengeToken: string) {
    return this.emailCodes.resend(challengeToken);
  }

  // ───── Forgotten password ─────

  /**
   * A reset code to the address. An address without an account gets the same
   * answer and no email, so the form cannot be used to look addresses up.
   */
  async forgotPassword(email: string, meta: RequestMeta): Promise<VerificationStep> {
    await this.assertEmailCodes();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const eligible = user && !user.deletedAt && (user.status === 'ACTIVE' || AccountService.restorable(user)) ? user : null;
    const challenge = await this.emailCodes.start('reset', email, { userId: eligible?.id ?? null }, { name: eligible?.name, silent: !eligible });
    if (eligible) {
      await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.password_reset_requested', targetType: 'User', targetId: eligible.id, meta });
    }
    return { verificationRequired: true, ...challenge };
  }

  /**
   * The emailed code and a new password: every session ends, the address counts
   * as confirmed, and the person is signed in (through the authenticator app,
   * or the restore offer, when those apply).
   */
  async resetPassword(challengeToken: string, code: string, newPassword: string, meta: RequestMeta): Promise<LoginResult> {
    const { payload } = await this.emailCodes.verify<{ userId: string | null }>(challengeToken, code, 'reset');
    const found = payload.userId ? await this.prisma.user.findUnique({ where: { id: payload.userId } }) : null;
    if (!found || found.deletedAt) throw new AppError('VERIFICATION_EXPIRED', 'This code has expired. Please start again.');
    const passwordHash = await hashPassword(newPassword);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: found.id }, data: { passwordHash, emailVerifiedAt: found.emailVerifiedAt ?? new Date() } });
      await this.sessions.revokeAllForUser(found.id, tx);
      await this.audit.record({ actorType: 'USER', actorId: found.id, action: 'user.password_reset', targetType: 'User', targetId: found.id, meta }, tx);
      return updated;
    });
    if (user.email) await this.redis.client.del(`login-fail:${user.email}`);
    if (AccountService.restorable(user)) return this.restoreOffer(user, meta);
    if (user.status !== 'ACTIVE') throw new AppError('INVALID_CREDENTIALS', 'This account cannot sign in.');
    if (user.totpEnabledAt) return { mfaRequired: true, ...(await this.mfa.createChallenge(user.id)) };
    return this.signIn(user, meta, { method: 'password_reset' });
  }

  // ───── A WhatsApp number instead of an email ─────

  /**
   * A code to any WhatsApp number: it signs in to the number's account, or
   * proves the number for a new one, so the answer never says whether an
   * account exists. `sendId` lets the page ask whether the message got through.
   */
  async requestPhoneCode(phone: string, meta: RequestMeta): Promise<{ sent: true; target: string; sendId: string; resendAfter: number }> {
    await this.phoneOtp.assertAvailable();
    if (meta.ipAddress && !this.config.RATE_LIMIT_DISABLED) {
      const key = `phone-otp-ip:${meta.ipAddress}`;
      const sends = await this.redis.client.incr(key);
      if (sends === 1) await this.redis.client.expire(key, 3600);
      if (sends > PHONE_SENDS_PER_IP_HOUR) throw new AppError('RATE_LIMITED', 'Too many codes requested. Please wait a while, or sign in another way.');
    }
    const { target, sendId } = await this.phoneOtp.send(phone, 'login');
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.phone_code_sent', targetType: 'User', targetId: user?.id ?? null, meta });
    return { sent: true, target, sendId, resendAfter: PHONE_RESEND_AFTER_SECONDS };
  }

  /**
   * The code from WhatsApp: it signs in to the account the number belongs to,
   * or, for a number without one, returns the token that makes one. A number
   * saved on an account but never confirmed there does not sign in to it (a
   * mistyped number would hand the account to a stranger); the account's owner
   * signs in another way and confirms the number first.
   */
  async loginWithPhone(phone: string, code: string, meta: RequestMeta): Promise<LoginResult | PhoneSignupStep> {
    await this.phoneOtp.verify(phone, code, 'login');
    const found = await this.prisma.user.findUnique({ where: { phone } });
    if (found && AccountService.restorable(found)) {
      if (!found.phoneVerifiedAt && !found.provisional) throw await this.unconfirmed(found.id, meta);
      return this.restoreOffer(found, meta);
    }
    if (!found) {
      const signupToken = generateSecureToken();
      await this.redis.client.set(phoneSignupKey(signupToken), phone, 'EX', PHONE_SIGNUP_SECONDS);
      return { signupRequired: true, signupToken, target: maskTarget(phone) };
    }
    if (found.status !== 'ACTIVE' || found.deletedAt) {
      await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.login', targetType: 'User', targetId: found.id, result: 'FAILURE', metadata: { reason: 'NOT_ACTIVE', method: 'whatsapp_otp' }, meta });
      throw new AppError('INVALID_CREDENTIALS', 'This account cannot sign in.');
    }
    // An account made from this number (the quick start) is the number's own; any other needs it confirmed.
    if (!found.phoneVerifiedAt && !found.provisional) throw await this.unconfirmed(found.id, meta);
    // A verified number secures a provisional account.
    const user = await this.prisma.user.update({ where: { id: found.id }, data: { phoneVerifiedAt: found.phoneVerifiedAt ?? new Date(), provisional: false } });
    if (user.totpEnabledAt) {
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.login_code_verified', targetType: 'User', targetId: user.id, metadata: { method: 'whatsapp_otp' }, meta });
      return { mfaRequired: true, ...(await this.mfa.createChallenge(user.id)) };
    }
    return this.signIn(user, meta, { method: 'whatsapp_otp' });
  }

  /** Makes an account for a number its owner proved with a code a moment ago (name and the ticked Terms box). */
  async signupWithPhone(input: PhoneSignupInput, meta: RequestMeta): Promise<SignedIn> {
    const phone = await this.redis.client.getdel(phoneSignupKey(input.signupToken));
    if (!phone) throw new AppError('VERIFICATION_EXPIRED', 'This step expired. Please start again.');
    if (await this.prisma.user.findUnique({ where: { phone }, select: { id: true } })) {
      throw new AppError('PHONE_TAKEN', 'An account already uses this WhatsApp number. Sign in with it instead.');
    }
    const versions = await this.consents.versions(['terms', 'privacy']);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: input.name, phone, phoneVerifiedAt: new Date(), whatsappOptInAt: input.whatsappUpdates ? new Date() : null },
      });
      await this.consents.recordSignup(tx, created.id, versions, 'signup_whatsapp');
      if (input.whatsappUpdates) await this.consents.recordWhatsAppUpdates(tx, created.id, true, 'signup');
      await this.audit.record({ actorType: 'USER', actorId: created.id, action: 'user.signup', targetType: 'User', targetId: created.id, metadata: { method: 'whatsapp' }, meta }, tx);
      return created;
    });
    const session = await this.sessions.issue(user, meta);
    return { user: toPublicUser(user), session };
  }

  // ───── Adding an email to an account made from a WhatsApp number ─────

  /** An account without an email adds one with a password; the address is added once its code is entered. */
  async claim(userId: string, input: ClaimAccountInput, meta: RequestMeta): Promise<VerificationStep> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.email) throw new AppError('CONFLICT', 'This account already has an email address.');
    const taken = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (taken) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.');
    await this.assertEmailCodes();
    const passwordHash = await hashPassword(input.password);
    const challenge = await this.emailCodes.start('claim', input.email, { userId, passwordHash, name: input.name ?? null }, { name: input.name ?? user.name });
    await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.claim_code_sent', targetType: 'User', targetId: userId, meta });
    return { verificationRequired: true, ...challenge };
  }

  /** The code proves the address: it is added, confirmed, with the password, and the account is secured. */
  async completeClaim(userId: string, challengeToken: string, code: string, meta: RequestMeta): Promise<PublicUser> {
    const { email, payload } = await this.emailCodes.verify<{ userId: string; passwordHash: string; name: string | null }>(challengeToken, code, 'claim');
    if (payload.userId !== userId) throw new AppError('VERIFICATION_EXPIRED', 'This code has expired. Please start again.');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.email) throw new AppError('CONFLICT', 'This account already has an email address.');
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id: userId },
        data: { email, emailVerifiedAt: new Date(), passwordHash: payload.passwordHash, name: payload.name ?? user.name, provisional: false },
      });
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.claimed', targetType: 'User', targetId: userId, meta }, tx);
      return row;
    });
    return toPublicUser(updated);
  }

  /**
   * Set a first password (accounts created with Google) or change it (the
   * current password is required). Other sessions end; the caller gets a
   * fresh session that keeps its two-step status.
   */
  async setPassword(userId: string, input: SetPasswordInput, meta: RequestMeta, sessionMfa: boolean): Promise<IssuedSession> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // A password signs in with an email: an account made from a WhatsApp number adds both together (claim).
    if (!user.email) throw new AppError('BAD_REQUEST', 'Add an email address first: a password signs in with it.');
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

  // ───── Internals ─────

  private async signIn(user: User, meta: RequestMeta, metadata: Record<string, string>): Promise<SignedIn> {
    const session = await this.sessions.issue(user, meta);
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.login', targetType: 'User', targetId: user.id, metadata, meta });
    return { user: toPublicUser(user), session };
  }

  private async restoreOffer(user: User, meta: RequestMeta): Promise<RestoreOffer> {
    await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.restore_offered', targetType: 'User', targetId: user.id, meta });
    return { restoreRequired: true, restoreToken: await this.account.restoreToken(user.id), deleteAt: user.deletionScheduledAt! };
  }

  private async unconfirmed(userId: string, meta: RequestMeta): Promise<AppError> {
    await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.login', targetType: 'User', targetId: userId, result: 'FAILURE', metadata: { reason: 'PHONE_UNCONFIRMED', method: 'whatsapp_otp' }, meta });
    return new AppError(
      'PHONE_UNCONFIRMED',
      'This number is saved on an account that has not confirmed it yet. Sign in with that account’s email or Google, then confirm the number under Account.',
    );
  }

  private async burnPasswordCheck(password: string): Promise<false> {
    this.dummyHash ??= hashPassword('bulava-timing-equalizer');
    await verifyPassword(password, await this.dummyHash);
    return false;
  }
}
