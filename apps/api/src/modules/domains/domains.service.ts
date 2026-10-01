import { Inject, Injectable } from '@nestjs/common';
import { generateSecureToken } from '@bulava/auth';
import type { EventDomain } from '@bulava/database';
import { challengeName, challengeValue, checkDomain, CloudflareSaasProvider, ManualHostnameProvider, normalizeHostname, type DnsResolver, type HostnameProvider } from '@bulava/domains';
import { SettingsStore } from '@bulava/settings';
import { FEATURE_KEYS } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { SETTINGS_STORE } from '../settings/settings.service';
import { EventLinksService } from './event-links.service';

export const DNS_RESOLVER = Symbol('DNS_RESOLVER');
export const HOSTNAME_PROVIDER = Symbol('HOSTNAME_PROVIDER');
/** HOSTNAME_PROVIDER's production value: build the provider from the Super Admin's settings. */
export const FROM_SETTINGS = 'from-settings' as const;

interface Routing {
  provider: HostnameProvider | null;
  target: { cname: string; addresses: string[] };
}

/**
 * Custom domains for events (a plan feature). The host proves ownership with
 * a TXT record, points the name at Bulava, and the domain goes live once TLS
 * is ready. Checks run on demand here and periodically in the worker.
 */
@Injectable()
export class DomainsService {
  private built: { fingerprint: string; provider: HostnameProvider | null } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly links: EventLinksService,
    @Inject(DNS_RESOLVER) private readonly resolver: DnsResolver,
    /** Tests inject a provider (or null for "none"); otherwise FROM_SETTINGS. */
    @Inject(HOSTNAME_PROVIDER) private readonly override: HostnameProvider | null | typeof FROM_SETTINGS,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(SETTINGS_STORE) private readonly settings: SettingsStore,
  ) {}

  private get mainHost(): string {
    return new URL(this.config.WEB_ORIGIN).hostname;
  }

  /** Certificates and routing names from settings: Cloudflare for SaaS, manual, or off (then custom domains are unavailable). */
  private async routing(): Promise<Routing> {
    const s = await this.settings.get('domains');
    const target = { cname: (s.value.cnameTarget ?? `domains.${this.mainHost}`).toLowerCase(), addresses: s.value.addresses };
    if (this.override !== FROM_SETTINGS) return { provider: this.override, target };
    const token = s.secrets.cloudflareApiToken;
    const fingerprint = `${s.value.mode}\n${s.value.zoneId ?? ''}\n${token ?? ''}`;
    if (this.built?.fingerprint !== fingerprint) {
      const provider =
        s.value.mode === 'cloudflare' && token && s.value.zoneId
          ? new CloudflareSaasProvider({ apiToken: token, zoneId: s.value.zoneId, apiBase: this.config.CLOUDFLARE_API_BASE })
          : s.value.mode === 'manual'
            ? new ManualHostnameProvider()
            : null;
      this.built = { fingerprint, provider };
    }
    return { provider: this.built.provider, target };
  }

  private requireProvider(r: Routing): HostnameProvider {
    if (!r.provider) throw new AppError('DOMAIN_UNAVAILABLE', 'Custom domains are not available yet.');
    return r.provider;
  }

  private view(domain: EventDomain | null, entitled: boolean, r: Routing) {
    const target = r.target;
    return {
      available: r.provider !== null,
      entitled,
      target,
      domain: domain
        ? {
            hostname: domain.hostname,
            status: domain.status,
            url: domain.status === 'ACTIVE' ? this.links.originFor(domain.hostname) : null,
            lastError: domain.lastError,
            sslStatus: domain.sslStatus,
            verifiedAt: domain.verifiedAt,
            lastCheckedAt: domain.lastCheckedAt,
            // The DNS records the host must add.
            records: [
              ...(domain.verifiedAt ? [] : [{ type: 'TXT', name: challengeName(domain.hostname), value: challengeValue(domain.verificationToken) }]),
              { type: 'CNAME', name: domain.hostname, value: target.cname },
              ...target.addresses.map((a) => ({ type: 'A', name: domain.hostname, value: a, alternative: true })),
            ],
          }
        : null,
    };
  }

  private async entitled(eventId: string): Promise<boolean> {
    return EntitlementsService.enabled(await this.entitlements.forEvent(eventId), FEATURE_KEYS.CUSTOM_DOMAIN);
  }

  async get(access: EventAccessContext) {
    const [domain, entitled, r] = await Promise.all([this.prisma.eventDomain.findUnique({ where: { eventId: access.eventId } }), this.entitled(access.eventId), this.routing()]);
    return this.view(domain, entitled, r);
  }

  /** Connect (or replace) the event's domain. It stays pending until DNS and TLS check out. */
  async set(access: EventAccessContext, input: string, meta: RequestMeta) {
    const r = await this.routing();
    const provider = this.requireProvider(r);
    if (!(await this.entitled(access.eventId))) {
      throw new AppError('PLAN_UPGRADE_REQUIRED', 'Custom domains are part of the Premium plan.', { feature: FEATURE_KEYS.CUSTOM_DOMAIN });
    }
    const parsed = normalizeHostname(input, [this.mainHost, r.target.cname]);
    if ('problem' in parsed) throw new AppError('DOMAIN_INVALID', 'That domain cannot be used.', { reason: parsed.problem });
    // Only a working, verified claim holds a name; unverified claims never block anyone.
    const taken = await this.prisma.eventDomain.findFirst({
      where: { hostname: parsed.hostname, eventId: { not: access.eventId }, verifiedAt: { not: null }, status: { not: 'FAILED' }, event: { deletedAt: null } },
      select: { id: true },
    });
    if (taken) throw new AppError('DOMAIN_TAKEN', 'This domain is already connected to another event.');

    const existing = await this.prisma.eventDomain.findUnique({ where: { eventId: access.eventId } });
    if (existing?.hostname === parsed.hostname) return this.view(existing, true, r);
    if (existing?.providerId) await provider.remove(existing.providerId).catch(() => undefined);
    const domain = await this.prisma.$transaction(async (tx) => {
      await tx.eventDomain.deleteMany({ where: { eventId: access.eventId } });
      const row = await tx.eventDomain.create({ data: { eventId: access.eventId, hostname: parsed.hostname, verificationToken: generateSecureToken(24) } });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'event.domain_set', targetType: 'EventDomain', targetId: row.id, eventId: access.eventId, metadata: { hostname: parsed.hostname }, meta },
        tx,
      );
      return row;
    });
    this.links.forget(access.eventId);
    return this.view(domain, true, r);
  }

  async check(access: EventAccessContext) {
    const domain = await this.prisma.eventDomain.findUnique({ where: { eventId: access.eventId } });
    if (!domain) throw AppError.notFound('Domain');
    const r = await this.routing();
    const checked = await checkDomain({ prisma: this.prisma, resolver: this.resolver, provider: this.requireProvider(r), target: r.target }, domain.id);
    this.links.forget(access.eventId);
    return this.view(checked, await this.entitled(access.eventId), r);
  }

  async remove(access: EventAccessContext, meta: RequestMeta): Promise<void> {
    const domain = await this.prisma.eventDomain.findUnique({ where: { eventId: access.eventId } });
    if (!domain) return;
    const { provider } = await this.routing();
    if (domain.providerId && provider) await provider.remove(domain.providerId);
    await this.prisma.$transaction(async (tx) => {
      await tx.eventDomain.delete({ where: { id: domain.id } });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'event.domain_removed', targetType: 'EventDomain', targetId: domain.id, eventId: access.eventId, metadata: { hostname: domain.hostname }, meta },
        tx,
      );
    });
    this.links.forget(access.eventId);
  }

  /**
   * For the web app's routing: which event does this host serve? Only live
   * domains of events that still exist. The domain is an alias for the event's
   * pages, which apply the same status rules as on the main site (a draft's page
   * is not found, its invitations say "not available yet", archived pages stay
   * readable), so links behave identically on both hosts.
   */
  async resolve(host: string): Promise<{ slug: string } | null> {
    const parsed = normalizeHostname(host);
    if ('problem' in parsed) return null;
    // ACTIVE implies verified, and only one claim per hostname can be verified.
    const domain = await this.prisma.eventDomain.findFirst({
      where: { hostname: parsed.hostname, status: 'ACTIVE' },
      select: { event: { select: { slug: true, deletedAt: true } } },
    });
    if (!domain || domain.event.deletedAt) return null;
    return { slug: domain.event.slug };
  }
}
