import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Prisma, TemplateTier, TemplateType } from '@bulava/database';
import { FEATURE_KEYS, z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import { PlatformSettingsService } from '../settings/settings.service';

/** A list with definitions is for a few templates (a type's films, a gallery's few without pre-rendered images). */
export const MAX_DEFINITIONS = 60;

export const TemplateListQuerySchema = z.object({
  type: z.enum(['WEBSITE', 'VIDEO', 'DIGITAL_CARD']).optional(),
  eventType: z.string().max(40).optional(),
  tag: z.string().max(40).optional(),
  tier: z.enum(['FREE', 'STANDARD', 'PREMIUM']).optional(),
  featured: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: z.string().trim().max(80).optional(),
  /** Only these templates (comma-separated keys). */
  keys: z.string().max(5000).optional(),
  include: z.enum(['definition']).optional(),
});
export type TemplateListQuery = z.infer<typeof TemplateListQuerySchema>;

const LIST_CACHE_KEY = 'cache:templates:published:v2';
const LIST_TTL_SECONDS = 600;
/** A published version never changes (Studio edits make a new draft), so its definition caches for long. */
const definitionKey = (versionId: string) => `cache:templates:definition:${versionId}`;
const DEFINITION_TTL_SECONDS = 86_400;

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
  /** What a gallery card shows without the definition: the theme's colours and the hero section's variant. */
  preview: { colors: Record<string, string> | null; heroVariant: string | null };
  definition?: unknown;
}

/**
 * Published template catalog (public). The list (without definitions, which
 * run to megabytes across the catalog) is cached in Redis and publishing
 * invalidates it; definitions are fetched per template and cached by version.
 */
@Injectable()
export class TemplatesService implements OnApplicationBootstrap {
  /** One load at a time: a cold cache under load would otherwise query once per request. */
  private loading: Promise<TemplateSummary[]> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: PlatformSettingsService,
  ) {}

  /** A release's migrate job changes the catalog before the API starts: drop the list the previous release cached. */
  async onApplicationBootstrap(): Promise<void> {
    await this.invalidate();
  }

  private async summaries(): Promise<TemplateSummary[]> {
    const cached = await this.redis.client.get(LIST_CACHE_KEY).catch(() => null);
    if (cached) return JSON.parse(cached) as TemplateSummary[];
    this.loading ??= this.loadSummaries().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async loadSummaries(): Promise<TemplateSummary[]> {
    const rows = await this.prisma.template.findMany({
      where: { status: 'PUBLISHED', currentVersionId: { not: null } },
      include: { currentVersion: { select: { id: true, version: true, status: true } } },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    const published = rows.filter((r) => r.currentVersion?.status === 'PUBLISHED');
    // Only the parts of each definition a card shows, read in the database.
    const ids = published.map((r) => r.currentVersion!.id);
    const looks = ids.length
      ? await this.prisma.$queryRaw<Array<{ id: string; colors: Record<string, string> | null; heroVariant: string | null }>>`
          SELECT "id", "definition"->'theme'->'colors' AS "colors", "definition" #>> '{website,pages,0,sections,0,variant}' AS "heroVariant"
          FROM "template_versions" WHERE "id" = ANY(${ids}::uuid[])`
      : [];
    const look = new Map(looks.map((l) => [l.id, l]));
    const list: TemplateSummary[] = published.map((r) => ({
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
      preview: { colors: look.get(r.currentVersion!.id)?.colors ?? null, heroVariant: look.get(r.currentVersion!.id)?.heroVariant ?? null },
    }));
    await this.redis.client.set(LIST_CACHE_KEY, JSON.stringify(list), 'EX', LIST_TTL_SECONDS).catch(() => undefined);
    return list;
  }

  /** Definitions of published versions, from the cache or the database. */
  private async definitions(versionIds: string[]): Promise<Map<string, unknown>> {
    const out = new Map<string, unknown>();
    if (!versionIds.length) return out;
    const cached: Array<string | null> = await this.redis.client.mget(...versionIds.map(definitionKey)).catch(() => versionIds.map(() => null));
    const missing = versionIds.filter((id, i) => {
      const hit = cached[i];
      if (hit) out.set(id, JSON.parse(hit));
      return !hit;
    });
    if (missing.length) {
      const rows = await this.prisma.templateVersion.findMany({ where: { id: { in: missing } }, select: { id: true, definition: true } });
      const pipeline = this.redis.client.pipeline();
      for (const r of rows) {
        out.set(r.id, r.definition as Prisma.JsonValue);
        pipeline.set(definitionKey(r.id), JSON.stringify(r.definition), 'EX', DEFINITION_TTL_SECONDS);
      }
      await pipeline.exec().catch(() => undefined);
    }
    return out;
  }

  async invalidate(): Promise<void> {
    await this.redis.client.del(LIST_CACHE_KEY).catch(() => undefined);
  }

  async list(query: TemplateListQuery): Promise<TemplateSummary[]> {
    const q = query.q?.toLowerCase();
    const keys = query.keys ? new Set(query.keys.split(',').map((k) => k.trim()).filter(Boolean)) : null;
    const found = (await this.summaries())
      .filter((t) => !keys || keys.has(t.key))
      .filter((t) => !query.type || t.outputs.includes(query.type))
      .filter((t) => !query.eventType || t.eventTypes.length === 0 || t.eventTypes.includes(query.eventType))
      .filter((t) => !query.tag || t.tags.includes(query.tag))
      .filter((t) => !query.tier || t.tier === query.tier)
      .filter((t) => query.featured === undefined || t.featured === query.featured)
      .filter((t) => !q || `${t.name} ${t.category} ${t.style ?? ''} ${t.tags.join(' ')}`.toLowerCase().includes(q));
    if (query.include !== 'definition') return found;
    if (found.length > MAX_DEFINITIONS) {
      throw new AppError('VALIDATION_FAILED', `Definitions come with at most ${MAX_DEFINITIONS} templates: narrow the list by type, event type or keys.`);
    }
    const defs = await this.definitions(found.map((t) => t.templateVersionId));
    return found.map((t) => ({ ...t, definition: defs.get(t.templateVersionId) }));
  }

  async getByKey(key: string): Promise<TemplateSummary> {
    const found = (await this.summaries()).find((t) => t.key === key);
    if (!found) throw AppError.notFound('Template');
    const defs = await this.definitions([found.templateVersionId]);
    return { ...found, definition: defs.get(found.templateVersionId) };
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
