import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { generateSecureToken, hashPassword, hashToken } from '@bulava/auth';
import type { EventMemberInvite, EventRole, Prisma } from '@bulava/database';
import { SettingsStore } from '@bulava/settings';
import type { AcceptTeamInviteInput } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { AuthUser, EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { EventLinksService } from '../domains/event-links.service';
import { SETTINGS_STORE } from '../settings/settings.service';
import { teamInviteEmail } from './team-invite-email';

/** Wrong codes before an invitation locks (the host can send a new one). */
export const MAX_INVITE_ATTEMPTS = 5;

export interface TeamInviteDto {
  id: string;
  email: string;
  role: EventRole;
  functionIds: string[];
  status: 'PENDING' | 'LOCKED';
  createdAt: Date;
  invitedBy: string | null;
}

const toDto = (i: EventMemberInvite & { invitedBy?: { name: string } | null }): TeamInviteDto => ({
  id: i.id,
  email: i.email,
  role: i.role,
  functionIds: i.functionIds,
  status: i.status === 'LOCKED' ? 'LOCKED' : 'PENDING',
  createdAt: i.createdAt,
  invitedBy: i.invitedBy?.name ?? null,
});

/**
 * Inviting someone to an event team before they have a Bulava account. They
 * receive a link and a 6-digit code by email; on the link they enter the code,
 * then choose their name and password, and join the team signed in. The code
 * has no time limit but works once (the invitation is then ACCEPTED), and five
 * wrong codes lock the invitation until the host sends a new one. The link
 * token and code are stored only as hashes, and the email job is removed from
 * the queue once sent.
 */
@Injectable()
export class TeamInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly links: EventLinksService,
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private codeHash(tokenHash: string, code: string): string {
    return createHmac('sha256', this.config.JWT_ACCESS_SECRET).update(`team-invite:${tokenHash}:${code}`).digest('hex');
  }

  private secrets() {
    const token = generateSecureToken();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const tokenHash = hashToken(token);
    return { token, code, tokenHash, codeHash: this.codeHash(tokenHash, code) };
  }

  /** Team links live on the main site (they lead into the dashboard, never a customer domain). */
  joinUrl(token: string): string {
    return `${this.links.mainOrigin}/team/join/${token}`;
  }

  private async email(invite: { eventId: string; email: string; role: EventRole }, secrets: { token: string; code: string }, inviterName: string): Promise<void> {
    const [event, site] = await Promise.all([this.prisma.event.findUniqueOrThrow({ where: { id: invite.eventId }, select: { title: true } }), this.store.get('site')]);
    const mail = teamInviteEmail({ site: site.value.name, inviterName, eventTitle: event.title, role: invite.role, code: secrets.code, url: this.joinUrl(secrets.token) });
    // The email carries the code, so the job is dropped from Redis as soon as it is done.
    await this.queues.add('email', { to: invite.email, ...mail }, { removeOnComplete: true, removeOnFail: true });
  }

  private async inviterName(userId: string): Promise<string> {
    return (await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? 'Your host';
  }

  /** A new invitation (replacing one still waiting for the same email) and its email. */
  async create(access: EventAccessContext, input: { email: string; role: EventRole; functionIds: string[] }, meta: RequestMeta): Promise<TeamInviteDto> {
    const s = this.secrets();
    const invite = await this.prisma.$transaction(async (tx) => {
      await tx.eventMemberInvite.updateMany({ where: { eventId: access.eventId, email: input.email, status: { in: ['PENDING', 'LOCKED'] } }, data: { status: 'REVOKED' } });
      const created = await tx.eventMemberInvite.create({
        data: { eventId: access.eventId, email: input.email, role: input.role, functionIds: input.functionIds, tokenHash: s.tokenHash, codeHash: s.codeHash, invitedById: access.userId },
      });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'member.invited', targetType: 'EventMemberInvite', targetId: created.id, eventId: access.eventId, metadata: { role: input.role }, meta },
        tx,
      );
      return created;
    });
    await this.email(invite, s, await this.inviterName(access.userId));
    return toDto(invite);
  }

  /** Invitations still waiting (or locked), for the team card. */
  async list(eventId: string): Promise<TeamInviteDto[]> {
    const rows = await this.prisma.eventMemberInvite.findMany({
      where: { eventId, status: { in: ['PENDING', 'LOCKED'] } },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDto);
  }

  private async findOpen(access: EventAccessContext, inviteId: string) {
    const invite = await this.prisma.eventMemberInvite.findFirst({ where: { id: inviteId, eventId: access.eventId, status: { in: ['PENDING', 'LOCKED'] } } });
    if (!invite) throw AppError.notFound('Invitation');
    if (invite.role === 'ADMIN' && access.role !== 'OWNER') throw AppError.forbidden('Only the owner can invite admins.');
    return invite;
  }

  /** A new link and code (the old ones stop working), also unlocking a locked invitation. */
  async resend(access: EventAccessContext, inviteId: string, meta: RequestMeta): Promise<TeamInviteDto> {
    const invite = await this.findOpen(access, inviteId);
    const s = this.secrets();
    const updated = await this.prisma.eventMemberInvite.update({ where: { id: invite.id }, data: { tokenHash: s.tokenHash, codeHash: s.codeHash, attempts: 0, status: 'PENDING' } });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'member.invite_resent', targetType: 'EventMemberInvite', targetId: invite.id, eventId: access.eventId, meta });
    await this.email(updated, s, await this.inviterName(access.userId));
    return toDto(updated);
  }

  async revoke(access: EventAccessContext, inviteId: string, meta: RequestMeta): Promise<void> {
    const invite = await this.findOpen(access, inviteId);
    await this.prisma.eventMemberInvite.update({ where: { id: invite.id }, data: { status: 'REVOKED' } });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'member.invite_revoked', targetType: 'EventMemberInvite', targetId: invite.id, eventId: access.eventId, meta });
  }

  // ───────────────────────── The invited person ─────────────────────────

  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError('TEAM_INVITE_INVALID', 'This invitation link is not valid any more.');
    const invite = await this.prisma.eventMemberInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { event: { select: { id: true, title: true, deletedAt: true } }, invitedBy: { select: { name: true } } },
    });
    if (!invite || invite.event.deletedAt || invite.status === 'REVOKED' || invite.status === 'ACCEPTED') {
      throw new AppError('TEAM_INVITE_INVALID', 'This invitation link is not valid any more. Ask the host to send a new one.');
    }
    if (invite.status === 'LOCKED') throw new AppError('TEAM_INVITE_LOCKED', 'This invitation was locked after too many wrong codes. Ask the host to send a new one.');
    return invite;
  }

  private async accountExists(email: string): Promise<boolean> {
    // Any row, including closed accounts: the email is unique across all of them.
    return (await this.prisma.user.count({ where: { email } })) > 0;
  }

  /** What the join page shows before the code: the event, the role and who invited them. */
  async publicInfo(token: string) {
    const invite = await this.byToken(token);
    return {
      eventTitle: invite.event.title,
      role: invite.role,
      invitedBy: invite.invitedBy?.name ?? null,
      email: invite.email,
      accountExists: await this.accountExists(invite.email),
    };
  }

  /** Every wrong code counts; the fifth locks the invitation. */
  private async checkCode(invite: { id: string; eventId: string; tokenHash: string; codeHash: string }, code: string): Promise<void> {
    const expected = Buffer.from(invite.codeHash);
    const given = Buffer.from(this.codeHash(invite.tokenHash, code));
    if (expected.length === given.length && timingSafeEqual(expected, given)) return;
    const { attempts } = await this.prisma.eventMemberInvite.update({ where: { id: invite.id }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
    if (attempts >= MAX_INVITE_ATTEMPTS) {
      await this.prisma.eventMemberInvite.updateMany({ where: { id: invite.id, status: 'PENDING' }, data: { status: 'LOCKED' } });
      await this.audit.record({ actorType: 'SYSTEM', action: 'member.invite_locked', targetType: 'EventMemberInvite', targetId: invite.id, eventId: invite.eventId });
      throw new AppError('TEAM_INVITE_LOCKED', 'This invitation was locked after too many wrong codes. Ask the host to send a new one.');
    }
    throw new AppError('TEAM_INVITE_CODE_INVALID', 'That code is not correct.', { attemptsLeft: MAX_INVITE_ATTEMPTS - attempts });
  }

  /** Step one on the join page: the code is right (it is used up only when they join). */
  async verify(token: string, code: string) {
    const invite = await this.byToken(token);
    await this.checkCode(invite, code);
    return { ok: true as const, accountExists: await this.accountExists(invite.email) };
  }

  /** Marks the invitation used and adds the member (unless they are already on the team). */
  private async join(tx: Prisma.TransactionClient, invite: EventMemberInvite, userId: string, meta: RequestMeta) {
    const claimed = await tx.eventMemberInvite.updateMany({ where: { id: invite.id, status: 'PENDING' }, data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: userId } });
    if (!claimed.count) throw new AppError('TEAM_INVITE_INVALID', 'This invitation has already been used.');
    const existing = await tx.eventMember.findUnique({ where: { eventId_userId: { eventId: invite.eventId, userId } } });
    if (!existing) await tx.eventMember.create({ data: { eventId: invite.eventId, userId, role: invite.role, functionIds: invite.functionIds } });
    await this.audit.record(
      { actorType: 'USER', actorId: userId, action: 'member.invite_accepted', targetType: 'EventMemberInvite', targetId: invite.id, eventId: invite.eventId, metadata: { role: invite.role, alreadyMember: !!existing }, meta },
      tx,
    );
  }

  /** Step two for someone new: the code again, plus their name and password. They are signed in. */
  async accept(token: string, input: AcceptTeamInviteInput, meta: RequestMeta) {
    const invite = await this.byToken(token);
    await this.checkCode(invite, input.code);
    if (await this.accountExists(invite.email)) {
      throw new AppError('TEAM_INVITE_SIGN_IN', 'An account with this email already exists. Sign in to join the team.');
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name: input.name, email: invite.email, passwordHash, emailVerifiedAt: new Date() } });
      await this.audit.record({ actorType: 'USER', actorId: created.id, action: 'user.signup', targetType: 'User', targetId: created.id, metadata: { via: 'team_invite' }, meta }, tx);
      await this.join(tx, invite, created.id, meta);
      return created;
    });
    const session = await this.sessions.issue(user, meta);
    return { eventId: invite.eventId, user: { id: user.id, name: user.name, email: user.email }, session };
  }

  /** For someone who already has an account: signed in as the invited email, the code joins them. */
  async acceptSignedIn(token: string, code: string, user: AuthUser, meta: RequestMeta) {
    const invite = await this.byToken(token);
    await this.checkCode(invite, code);
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    if (me.email?.toLowerCase() !== invite.email) {
      throw new AppError('TEAM_INVITE_WRONG_ACCOUNT', `This invitation was sent to ${invite.email}. Sign in with that account to join.`);
    }
    await this.prisma.$transaction((tx) => this.join(tx, invite, user.id, meta));
    return { eventId: invite.eventId };
  }
}
