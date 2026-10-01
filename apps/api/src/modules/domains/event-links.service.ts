import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const CACHE_MS = 30_000;

/**
 * Where guest-facing links point: an event's active custom domain, otherwise
 * the main site. Also tells the CSRF guard which customer domains may post
 * (guests RSVP and upload photos from them). Small in-memory caches keep this
 * off the hot path; changes made through DomainsService clear them at once.
 */
@Injectable()
export class EventLinksService {
  private readonly perEvent = new Map<string, { origin: string; expires: number }>();
  private active: { hosts: Set<string>; expires: number } = { hosts: new Set(), expires: 0 };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get mainOrigin(): string {
    return this.config.WEB_ORIGIN.replace(/\/$/, '');
  }

  /** Customer domains use the main site's scheme and port (https in production). */
  originFor(hostname: string): string {
    const main = new URL(this.mainOrigin);
    return `${main.protocol}//${hostname}${main.port ? `:${main.port}` : ''}`;
  }

  async guestOrigin(eventId: string): Promise<string> {
    const cached = this.perEvent.get(eventId);
    if (cached && cached.expires > Date.now()) return cached.origin;
    const domain = await this.prisma.eventDomain.findFirst({ where: { eventId, status: 'ACTIVE' }, select: { hostname: true } });
    const origin = domain ? this.originFor(domain.hostname) : this.mainOrigin;
    this.perEvent.set(eventId, { origin, expires: Date.now() + CACHE_MS });
    return origin;
  }

  /** Is this browser Origin one of the active customer domains? */
  async isCustomerOrigin(origin: string): Promise<boolean> {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }
    const main = new URL(this.mainOrigin);
    if (url.protocol !== main.protocol || url.port !== main.port) return false;
    if (this.active.expires <= Date.now()) {
      const rows = await this.prisma.eventDomain.findMany({ where: { status: 'ACTIVE', event: { deletedAt: null } }, select: { hostname: true } });
      this.active = { hosts: new Set(rows.map((r) => r.hostname)), expires: Date.now() + CACHE_MS };
    }
    return this.active.hosts.has(url.hostname);
  }

  forget(eventId: string): void {
    this.perEvent.delete(eventId);
    this.active.expires = 0;
  }
}

@Global()
@Module({ providers: [EventLinksService], exports: [EventLinksService] })
export class EventLinksModule {}
