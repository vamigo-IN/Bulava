import { Injectable } from '@nestjs/common';
import type { Prisma, TemplateTier, TemplateType } from '@bulava/database';
import { FEATURE_KEYS, z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import { PlatformSettingsService } from '../settings/settings.service';

export const TemplateListQuerySchema = z.object({
  type: z.enum(['WEBSITE', 'VIDEO', 'DIGITAL_CARD']).optional(),
  eventType: z.string().max(40).optional(),
  tag: z.string().max(40).optional(),
  tier: z.enum(['FREE', 'STANDARD', 'PREMIUM']).optional(),
  featured: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: z.string().trim().max(80).optional(),
  include: z.enum(['definition']).optional(),
});
export type TemplateListQuery = z.infer<typeof TemplateListQuerySchema>;

const CACHE_KEY = 'cache:templates:published:v1';
const CACHE_TTL_SECONDS = 60;

export interface TemplateSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  style: string | null;
  tier: TemplateTier;
  badge: string | null;
  featured: boolean;
  tags: string[];
  eventTypes: string[];
  languages: string[];
  outputs: TemplateType[];
  version: number;
  templateVersionId: string;
  definition?: unknown;
}

/** Published template catalog (public). Cached briefly in Redis; publishing invalidates it. */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: PlatformSettingsService,
  ) {}

  private async allPublished(): Promise<TemplateSummary[]> {
    const cached = await this.redis.client.get(CACHE_KEY).catch(() => null);
    if (cached) return JSON.parse(cached) as TemplateSummary[];
    const rows = await this.prisma.template.findMany({
      where: { status: 'PUBLISHED', currentVersionId: { not: null } },
      include: { currentVersion: { select: { id: true, version: true, definition: true, status: true } } },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    const list: TemplateSummary[] = rows
      .filter((r) => r.currentVersion?.status === 'PUBLISHED')
      .map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        category: r.category,
        style: r.style,
        tier: r.tier,
        badge: r.badge,
        featured: r.featured,
        tags: r.tags,
        eventTypes: r.eventTypes,
        languages: r.languages,
        outputs: r.outputs,
        version: r.currentVersion!.version,
        templateVersionId: r.currentVersion!.id,
        definition: r.currentVersion!.definition as Prisma.JsonValue,
      }));
    await this.redis.client.set(CACHE_KEY, JSON.stringify(list), 'EX', CACHE_TTL_SECONDS).catch(() => undefined);
    return list;
  }

  async invalidate(): Promise<void> {
    await this.redis.client.del(CACHE_KEY).catch(() => undefined);
  }

  async list(query: TemplateListQuery): Promise<TemplateSummary[]> {
    const q = query.q?.toLowerCase();
    return (await this.allPublished())
      .filter((t) => !query.type || t.outputs.includes(query.type))
      .filter((t) => !query.eventType || t.eventTypes.length === 0 || t.eventTypes.includes(query.eventType))
      .filter((t) => !query.tag || t.tags.includes(query.tag))
      .filter((t) => !query.tier || t.tier === query.tier)
      .filter((t) => query.featured === undefined || t.featured === query.featured)
      .filter((t) => !q || `${t.name} ${t.category} ${t.style ?? ''} ${t.tags.join(' ')}`.toLowerCase().includes(q))
      .map((t) => (query.include === 'definition' ? t : { ...t, definition: undefined }));
  }

  async getByKey(key: string): Promise<TemplateSummary> {
    const found = (await this.allPublished()).find((t) => t.key === key);
    if (!found) throw AppError.notFound('Template');
    return found;
  }

  /** Real platform numbers for social proof (never fabricated). */
  async siteStats() {
    const [events, invitationsOpened, rsvps, templates, languages] = await Promise.all([
      this.prisma.event.count({ where: { deletedAt: null, status: { in: ['ACTIVE', 'COMPLETED', 'ARCHIVED'] } } }),
      this.prisma.invitation.count({ where: { openedAt: { not: null } } }),
      this.prisma.rSVP.count({ where: { status: { not: 'PENDING' } } }),
      this.prisma.template.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.language.count({ where: { enabled: true } }),
    ]);
    return { events, invitationsOpened, rsvps, templates, languages };
  }

  testimonials() {
    return this.prisma.testimonial.findMany({
      where: { published: true },
      select: { id: true, quote: true, authorName: true, location: true, eventLabel: true, rating: true },
      orderBy: { sortOrder: 'asc' },
      take: 12,
    });
  }

  /** Active plans for pricing pages. WhatsApp allowances are listed only while WhatsApp sending is set up. */
  async plans() {
    const [plans, messaging] = await Promise.all([this.activePlans(), this.settings.messaging()]);
    if (messaging.whatsappInvitations || messaging.whatsappReminders) return plans;
    return plans.map((p) => ({ ...p, features: p.features.filter((f) => f.featureKey !== FEATURE_KEYS.WHATSAPP_MESSAGES) }));
  }

  private activePlans() {
    return this.prisma.pricingPlan.findMany({
      where: { active: true },
      select: {
        key: true,
        name: true,
        description: true,
        priceMinor: true,
        currency: true,
        interval: true,
        features: { select: { featureKey: true, enabled: true, limit: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
