import { Inject, Injectable } from '@nestjs/common';
import { decryptSecret, encryptSecret, generateSecureToken, hashToken, isLinkMode, type AccessMode } from '@bulava/auth';
import type { Prisma } from '@bulava/database';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { EventLinksService } from '../domains/event-links.service';
import { openRegistrationByDefault } from '../registrations/registration-defaults';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 3600 * 1000;

/** What the host shares: one event link (link modes) or personal invitations. */
export interface ShareLinkInfo {
  mode: AccessMode;
  /** LINK: share `url` with everyone. PERSONAL: add guests and send each their own invitation. */
  kind: 'LINK' | 'PERSONAL';
  url: string | null;
  /** SECRET_TOKEN only: when the link stops working. */
  expiresAt: string | null;
  expired: boolean;
  /** PRIVATE_LINK with a PIN: visitors also need the PIN. */
  hasPin: boolean;
  /** People can register themselves from the link. */
  registrationOpen: boolean;
  eventStatus: string;
}

/**
 * When a new secret link stops working: a week after the event's last date,
 * or 90 days from now when no date is set; never less than a day nor more
 * than a year away.
 */
export function defaultSecretLinkExpiry(dates: Array<Date | null | undefined>, now = new Date()): Date {
  const latest = dates.filter((d): d is Date => d instanceof Date).sort((a, b) => b.getTime() - a.getTime())[0];
  const target = latest ? latest.getTime() + 7 * DAY_MS : now.getTime() + 90 * DAY_MS;
  return new Date(Math.min(Math.max(target, now.getTime() + DAY_MS), now.getTime() + 365 * DAY_MS));
}

/**
 * The link a host shares for a link-shared event: the event page for PUBLIC
 * and PRIVATE_LINK events, and for SECRET_TOKEN events the page plus a secret
 * key that expires (`?k=<token>`; SHA-256 for lookup, AES-GCM so the host can
 * copy it again). Personal invitations still work in every mode; INVITE_ONLY
 * and GROUP_RESTRICTED events have nothing else to share.
 */
@Injectable()
export class ShareLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: EventLinksService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** The event page: on the event's own domain when one is live, otherwise /e/<slug> on the main site. */
  async eventPageUrl(eventId: string, slug: string): Promise<string> {
    const origin = await this.links.guestOrigin(eventId);
    return origin === this.links.mainOrigin ? `${origin}/e/${slug}` : `${origin}/`;
  }

  private async newSecret(tx: Tx, policyId: string, expiresAt: Date): Promise<void> {
    const token = generateSecureToken();
    await tx.accessPolicy.update({
      where: { id: policyId },
      data: { linkTokenHash: hashToken(token), linkTokenCiphertext: encryptSecret(token, this.config.TOKEN_ENCRYPTION_KEY), linkExpiresAt: expiresAt },
    });
  }

  private async eventDates(tx: Tx, eventId: string): Promise<Array<Date | null>> {
    const event = await tx.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { startDate: true, endDate: true, functions: { where: { deletedAt: null }, select: { startsAt: true, endsAt: true } } },
    });
    return [event.startDate, event.endDate, ...event.functions.flatMap((f) => [f.startsAt, f.endsAt])];
  }

  /** Gives the event a secret link if it has none (when it becomes SECRET_TOKEN). */
  async ensureSecretLink(tx: Tx, eventId: string): Promise<void> {
    const policy = await tx.accessPolicy.findFirstOrThrow({ where: { event: { id: eventId } }, select: { id: true, linkTokenHash: true } });
    if (policy.linkTokenHash) return;
    await this.newSecret(tx, policy.id, defaultSecretLinkExpiry(await this.eventDates(tx, eventId)));
  }

  private decrypt(ciphertext: string | null): string | null {
    if (!ciphertext) return null;
    try {
      return decryptSecret(ciphertext, this.config.TOKEN_ENCRYPTION_KEY);
    } catch {
      return null;
    }
  }

  async info(access: EventAccessContext): Promise<ShareLinkInfo> {
    const load = () =>
      this.prisma.event.findFirst({
        where: { id: access.eventId, deletedAt: null },
        select: { id: true, slug: true, status: true, accessPolicy: true, registrationSettings: { select: { enabled: true } } },
      });
    let event = await load();
    if (!event) throw AppError.notFound('Event');
    const mode = event.accessPolicy.mode;
    const base = { mode, hasPin: mode === 'PRIVATE_LINK' && event.accessPolicy.pinHash !== null, eventStatus: event.status };
    if (!isLinkMode(mode)) return { ...base, kind: 'PERSONAL', url: null, expiresAt: null, expired: false, registrationOpen: false };

    // A secret link that is missing or cannot be read any more (key rotated) is replaced.
    const missingSecret = mode === 'SECRET_TOKEN' && !this.decrypt(event.accessPolicy.linkTokenCiphertext);
    // Registration never set: open by default, as the event page and the Registrations tab treat it.
    const unsetRegistration = !event.registrationSettings;
    if (missingSecret || unsetRegistration) {
      const policy = event.accessPolicy;
      await this.prisma.$transaction(async (tx) => {
        if (missingSecret) await this.newSecret(tx, policy.id, policy.linkExpiresAt ?? defaultSecretLinkExpiry(await this.eventDates(tx, access.eventId)));
        if (unsetRegistration) await openRegistrationByDefault(tx, access.eventId);
      });
      event = (await load())!;
    }
    const page = await this.eventPageUrl(event.id, event.slug);
    const secret = mode === 'SECRET_TOKEN' ? this.decrypt(event.accessPolicy.linkTokenCiphertext) : null;
    const expiresAt = mode === 'SECRET_TOKEN' ? event.accessPolicy.linkExpiresAt : null;
    return {
      ...base,
      kind: 'LINK',
      url: secret ? `${page}?k=${secret}` : page,
      expiresAt: expiresAt?.toISOString() ?? null,
      expired: !!expiresAt && expiresAt <= new Date(),
      registrationOpen: event.registrationSettings?.enabled ?? false,
    };
  }

  private async secretPolicy(eventId: string) {
    const policy = await this.prisma.accessPolicy.findFirst({ where: { event: { id: eventId, deletedAt: null } } });
    if (!policy) throw AppError.notFound('Event');
    if (policy.mode !== 'SECRET_TOKEN') throw new AppError('VALIDATION_FAILED', 'Only secret links can be replaced or set to expire. Choose "Secret link" under who can open the invitation.');
    return policy;
  }

  /** A new secret link; the old one stops working at once. An expired link also gets a fresh expiry. */
  async rotate(access: EventAccessContext, meta: RequestMeta): Promise<ShareLinkInfo> {
    const policy = await this.secretPolicy(access.eventId);
    await this.prisma.$transaction(async (tx) => {
      const keep = policy.linkExpiresAt && policy.linkExpiresAt > new Date() ? policy.linkExpiresAt : defaultSecretLinkExpiry(await this.eventDates(tx, access.eventId));
      await this.newSecret(tx, policy.id, keep);
      await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'event.share_link_rotated', targetType: 'Event', targetId: access.eventId, eventId: access.eventId, meta }, tx);
    });
    return this.info(access);
  }

  async setExpiry(access: EventAccessContext, expiresAt: Date, meta: RequestMeta): Promise<ShareLinkInfo> {
    const policy = await this.secretPolicy(access.eventId);
    await this.prisma.$transaction(async (tx) => {
      if (!policy.linkTokenHash) await this.newSecret(tx, policy.id, expiresAt);
      else await tx.accessPolicy.update({ where: { id: policy.id }, data: { linkExpiresAt: expiresAt } });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'event.share_link_expiry_set', targetType: 'Event', targetId: access.eventId, eventId: access.eventId, metadata: { expiresAt: expiresAt.toISOString() }, meta },
        tx,
      );
    });
    return this.info(access);
  }
}
