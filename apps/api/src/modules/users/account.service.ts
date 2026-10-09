import { Inject, Injectable } from '@nestjs/common';
import { generateSecureToken, hashToken, verifyPassword, type PlatformRole } from '@bulava/auth';
import { SettingsStore } from '@bulava/settings';
import { ACCOUNT_RESTORE_DAYS, type DeleteAccountInput, type UpdateProfileInput } from '@bulava/validation';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { toPublicUser, type PublicUser } from '../auth/public-user';
import { MfaService } from '../auth/mfa.service';
import { SessionService, type IssuedSession } from '../auth/session.service';
import { EventLinksService } from '../domains/event-links.service';
import { PHONE_RESEND_AFTER_SECONDS, PhoneOtpService } from '../onboarding/phone-otp.service';
import { SETTINGS_STORE } from '../settings/settings.service';
import { accountDeletionScheduledEmail } from './account-email';

const DAY = 86_400_000;
const RESTORE_TOKEN_SECONDS = 15 * 60;
const restoreKey = (token: string) => `account-restore:${hashToken(token)}`;

export type RestoreResult = { user: PublicUser; session: IssuedSession } | { mfaRequired: true; challengeToken: string; challengeExpiresAt: Date };

/**
 * Deleting an account, with a way back. Deleting takes the owner's events
 * offline at once and schedules the account for erasure ACCOUNT_RESTORE_DAYS
 * later; signing in before then offers to restore it (a one-use token), and the
 * worker erases what is left after it (`purgeDeletedAccounts`).
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly queues: QueueService,
    private readonly links: EventLinksService,
    private readonly phoneOtp: PhoneOtpService,
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
  ) {}

  /** A code on WhatsApp to the account's own number: confirmed, it signs in with WhatsApp too. */
  async sendPhoneConfirmation(userId: string, meta: RequestMeta): Promise<{ sent: true; target: string; sendId: string; resendAfter: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
    if (!user.phone) throw new AppError('BAD_REQUEST', 'Add a WhatsApp number first.');
    if (user.phoneVerifiedAt) throw new AppError('CONFLICT', 'This number is already confirmed.');
    const { target, sendId } = await this.phoneOtp.send(user.phone, 'confirm');
    await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.phone_code_sent', targetType: 'User', targetId: userId, metadata: { purpose: 'confirm' }, meta });
    return { sent: true, target, sendId, resendAfter: PHONE_RESEND_AFTER_SECONDS };
  }

  /** The code from WhatsApp confirms the number (and secures an account made from it). */
  async confirmPhone(userId: string, code: string, meta: RequestMeta): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    if (!user.phone) throw new AppError('BAD_REQUEST', 'Add a WhatsApp number first.');
    await this.phoneOtp.verify(user.phone, code, 'confirm');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date(), provisional: false } });
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.phone_verified', targetType: 'User', targetId: userId, meta }, tx);
      return row;
    });
    return toPublicUser(updated);
  }

  /** Name, WhatsApp number (a changed number needs verifying again) and the WhatsApp-updates consent. */
  async updateProfile(userId: string, input: UpdateProfileInput, meta: RequestMeta): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (input.phone && input.phone !== user.phone) {
      const taken = await this.prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
      if (taken) throw new AppError('PHONE_TAKEN', 'An account already uses this WhatsApp number.');
    }
    const phoneChanged = input.phone !== undefined && input.phone !== user.phone;
    const nextPhone = input.phone === undefined ? user.phone : input.phone;
    // Updates need a number; dropping the number withdraws the consent.
    const wantsUpdates = input.whatsappUpdates ?? user.whatsappOptInAt !== null;
    const optIn = nextPhone ? wantsUpdates : false;
    const optInChanged = optIn !== (user.whatsappOptInAt !== null);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id: userId },
        data: {
          name: input.name ?? user.name,
          phone: nextPhone,
          phoneVerifiedAt: phoneChanged ? null : user.phoneVerifiedAt,
          whatsappOptInAt: optIn ? (user.whatsappOptInAt ?? new Date()) : null,
        },
      });
      if (optInChanged) await tx.consent.create({ data: { userId, kind: 'whatsapp_updates', granted: optIn, version: 'whatsapp_updates@1', source: 'account' } });
      await this.audit.record(
        { actorType: 'USER', actorId: userId, action: 'user.profile_updated', targetType: 'User', targetId: userId, metadata: { phoneChanged, whatsappUpdates: optInChanged ? optIn : undefined }, meta },
        tx,
      );
      return row;
    });
    return toPublicUser(updated);
  }

  /** A sign-in that reached an account waiting to be deleted, still inside its restore window. */
  static restorable(user: { status: string; deletionScheduledAt: Date | null }): boolean {
    return user.status === 'PENDING_DELETION' && user.deletionScheduledAt !== null && user.deletionScheduledAt.getTime() > Date.now();
  }

  /** Proof that the owner just signed in (password or Google), good for one restore within 15 minutes. */
  async restoreToken(userId: string): Promise<string> {
    const token = generateSecureToken();
    await this.redis.client.set(restoreKey(token), userId, 'EX', RESTORE_TOKEN_SECONDS);
    return token;
  }

  async scheduleDeletion(userId: string, input: DeleteAccountInput, meta: RequestMeta): Promise<{ deleteAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
    if (user.platformRole === 'SUPER_ADMIN') throw new AppError('SUPER_ADMIN_PROTECTED', 'Hand over the Super Admin role before deleting this account.');
    // The person at the keyboard must be the owner: their password, or the word DELETE for Google-only accounts.
    if (user.passwordHash) {
      if (!input.password || !(await verifyPassword(input.password, user.passwordHash))) {
        await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.deletion_requested', targetType: 'User', targetId: userId, result: 'FAILURE', metadata: { reason: 'PASSWORD' }, meta });
        throw new AppError('INVALID_CREDENTIALS', 'Your password is incorrect.');
      }
    } else if (input.confirm !== 'DELETE') {
      throw new AppError('VALIDATION_FAILED', 'Type DELETE to confirm.', [{ path: 'confirm', message: 'Type DELETE to confirm' }]);
    }

    const now = new Date();
    const deleteAt = new Date(now.getTime() + ACCOUNT_RESTORE_DAYS * DAY);
    await this.prisma.$transaction(async (tx) => {
      // Events go offline at once; they are marked with the request time so a restore brings back exactly these.
      const offline = await tx.event.updateMany({ where: { ownerId: userId, deletedAt: null }, data: { deletedAt: now } });
      await this.sessions.revokeAllForUser(userId, tx);
      await tx.user.update({ where: { id: userId }, data: { status: 'PENDING_DELETION', deletionRequestedAt: now, deletionScheduledAt: deleteAt } });
      await this.audit.record(
        { actorType: 'USER', actorId: userId, action: 'user.deletion_requested', targetType: 'User', targetId: userId, metadata: { eventsOffline: offline.count, deleteAt: deleteAt.toISOString() }, meta },
        tx,
      );
    });

    if (user.email) {
      const site = (await this.store.get('site')).value;
      const mail = accountDeletionScheduledEmail({ site: site.name, name: user.name, deleteAt, loginUrl: `${this.links.mainOrigin}/login`, supportEmail: site.supportEmail });
      await this.queues.addQuietly('email', { to: user.email, ...mail }, { removeOnComplete: true, removeOnFail: true });
    }
    return { deleteAt };
  }

  /** Undoes a deletion request: the account and the events that went offline with it come back. */
  async restore(token: string, meta: RequestMeta): Promise<RestoreResult> {
    const userId = await this.redis.client.getdel(restoreKey(token));
    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!user || !AccountService.restorable(user)) throw new AppError('RESTORE_EXPIRED', 'This restore step expired. Sign in again to restore your account.');

    const restored = await this.prisma.$transaction(async (tx) => {
      const events = user.deletionRequestedAt
        ? await tx.event.updateMany({ where: { ownerId: user.id, deletedAt: user.deletionRequestedAt }, data: { deletedAt: null } })
        : { count: 0 };
      const updated = await tx.user.update({ where: { id: user.id }, data: { status: 'ACTIVE', deletionRequestedAt: null, deletionScheduledAt: null } });
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.restored', targetType: 'User', targetId: user.id, metadata: { eventsRestored: events.count }, meta }, tx);
      return updated;
    });

    // Two-step accounts still finish with their code.
    if (restored.totpEnabledAt) return { mfaRequired: true, ...(await this.mfa.createChallenge(restored.id)) };
    const session = await this.sessions.issue({ id: restored.id, platformRole: restored.platformRole as PlatformRole }, meta);
    return { user: toPublicUser(restored), session };
  }
}
