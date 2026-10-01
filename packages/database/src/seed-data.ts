import type { Prisma, PrismaClient, TemplateType } from '../generated/client';
import { LANGUAGES } from '@bulava/localization';
import { RETIRED_TEMPLATE_KEYS, TEMPLATE_CATALOG } from '@bulava/template-catalog';
import { validateTemplateDefinition } from '@bulava/template-schema';
import { FEATURE_KEYS } from '@bulava/validation';

/**
 * Reference data the platform needs in every environment.
 * Idempotent and create-only: rows edited later by admins are never overwritten.
 */

interface EventTypeSeed {
  key: string;
  name: string;
  detailsSchemaKey?: string;
  defaultFunctions: Array<{ name: string; slug: string }>;
  defaultGroups: Array<{ name: string; slug: string }>;
}

const ALL = { name: 'All Guests', slug: 'all-guests' };
const FAMILY = { name: 'Family', slug: 'family' };
const FRIENDS = { name: 'Friends', slug: 'friends' };

const EVENT_TYPES: EventTypeSeed[] = [
  {
    key: 'WEDDING',
    name: 'Wedding',
    detailsSchemaKey: 'couple',
    defaultFunctions: [
      { name: 'Haldi', slug: 'haldi' },
      { name: 'Mehendi', slug: 'mehendi' },
      { name: 'Sangeet', slug: 'sangeet' },
      { name: 'Baraat', slug: 'baraat' },
      { name: 'Wedding', slug: 'wedding' },
      { name: 'Reception', slug: 'reception' },
    ],
    defaultGroups: [
      ALL,
      { name: 'Bride Family', slug: 'bride-family' },
      { name: 'Groom Family', slug: 'groom-family' },
      { name: 'Close Family', slug: 'close-family' },
      FRIENDS,
      { name: 'VIP', slug: 'vip' },
    ],
  },
  { key: 'ENGAGEMENT', name: 'Engagement / Roka', detailsSchemaKey: 'couple', defaultFunctions: [{ name: 'Ring Ceremony', slug: 'ring-ceremony' }], defaultGroups: [ALL, FAMILY, FRIENDS] },
  { key: 'BIRTHDAY', name: 'Birthday', detailsSchemaKey: 'honoree', defaultFunctions: [{ name: 'Birthday Party', slug: 'party' }], defaultGroups: [ALL, FAMILY, FRIENDS] },
  { key: 'ANNIVERSARY', name: 'Anniversary', detailsSchemaKey: 'couple', defaultFunctions: [{ name: 'Celebration', slug: 'celebration' }], defaultGroups: [ALL, FAMILY, FRIENDS] },
  { key: 'BABY_SHOWER', name: 'Baby Shower / Godh Bharai', detailsSchemaKey: 'honoree', defaultFunctions: [{ name: 'Godh Bharai', slug: 'godh-bharai' }], defaultGroups: [ALL, FAMILY, FRIENDS] },
  { key: 'NAMING_CEREMONY', name: 'Naming Ceremony / Namkaran', detailsSchemaKey: 'honoree', defaultFunctions: [{ name: 'Namkaran', slug: 'namkaran' }], defaultGroups: [ALL, FAMILY] },
  { key: 'MUNDAN', name: 'Mundan', detailsSchemaKey: 'honoree', defaultFunctions: [{ name: 'Mundan Ceremony', slug: 'mundan' }], defaultGroups: [ALL, FAMILY] },
  { key: 'THREAD_CEREMONY', name: 'Thread Ceremony / Upanayanam', detailsSchemaKey: 'honoree', defaultFunctions: [{ name: 'Upanayanam', slug: 'upanayanam' }], defaultGroups: [ALL, FAMILY] },
  { key: 'HOUSEWARMING', name: 'Housewarming / Griha Pravesh', defaultFunctions: [{ name: 'Griha Pravesh Puja', slug: 'griha-pravesh' }], defaultGroups: [ALL, FAMILY, FRIENDS] },
  { key: 'RELIGIOUS', name: 'Puja / Religious Function', defaultFunctions: [{ name: 'Puja', slug: 'puja' }], defaultGroups: [ALL] },
  { key: 'FESTIVAL', name: 'Festival Party (Diwali, Eid, Christmas…)', defaultFunctions: [{ name: 'Celebration', slug: 'celebration' }], defaultGroups: [ALL, FAMILY, FRIENDS] },
  { key: 'CORPORATE', name: 'Corporate Event', defaultFunctions: [{ name: 'Main Session', slug: 'main-session' }], defaultGroups: [{ name: 'Attendees', slug: 'attendees' }, { name: 'Speakers', slug: 'speakers' }, { name: 'VIP', slug: 'vip' }] },
  { key: 'SCHOOL_COLLEGE', name: 'School / College Event', defaultFunctions: [{ name: 'Main Event', slug: 'main-event' }], defaultGroups: [ALL] },
  { key: 'COMMUNITY', name: 'Community Event', defaultFunctions: [{ name: 'Main Event', slug: 'main-event' }], defaultGroups: [ALL] },
  { key: 'RETIREMENT', name: 'Retirement / Farewell', detailsSchemaKey: 'honoree', defaultFunctions: [{ name: 'Farewell Party', slug: 'farewell' }], defaultGroups: [ALL] },
  { key: 'CUSTOM', name: 'Custom Event', defaultFunctions: [], defaultGroups: [ALL] },
];

interface PlanSeed {
  key: string;
  name: string;
  description: string;
  priceMinor: number;
  interval: 'ONE_TIME' | 'YEAR';
  sortOrder: number;
  features: Array<{ featureKey: string; enabled: boolean; limit?: number | null }>;
}

const F = FEATURE_KEYS;

/** Initial plans. Prices and limits are editable by admins; code never reads them from here at runtime. */
const PLANS: PlanSeed[] = [
  {
    key: 'FREE',
    name: 'Free',
    description: 'Everything you need to invite and track RSVPs for one event.',
    priceMinor: 0,
    interval: 'ONE_TIME',
    sortOrder: 0,
    features: [
      { featureKey: F.EVENTS_MAX, enabled: true, limit: 1 },
      { featureKey: F.FUNCTIONS_MAX, enabled: true, limit: 6 },
      { featureKey: F.GUESTS_MAX, enabled: true, limit: 100 },
      { featureKey: F.TEMPLATES_MAX_TIER, enabled: true, limit: 0 },
      { featureKey: F.PHOTOS_MAX, enabled: true, limit: 50 },
      { featureKey: F.VIDEO_RENDERS_MAX, enabled: true, limit: 1 },
      { featureKey: F.VIDEO_HD, enabled: false },
      { featureKey: F.WATERMARK, enabled: true },
      { featureKey: F.CUSTOM_DOMAIN, enabled: false },
      { featureKey: F.WHATSAPP_MESSAGES, enabled: false },
    ],
  },
  {
    key: 'STANDARD',
    name: 'Standard',
    description: 'One event with Standard templates, more guests and no watermark.',
    priceMinor: 99900,
    interval: 'ONE_TIME',
    sortOrder: 1,
    features: [
      { featureKey: F.FUNCTIONS_MAX, enabled: true, limit: 10 },
      { featureKey: F.GUESTS_MAX, enabled: true, limit: 500 },
      { featureKey: F.TEMPLATES_MAX_TIER, enabled: true, limit: 1 },
      { featureKey: F.PHOTOS_MAX, enabled: true, limit: 500 },
      { featureKey: F.VIDEO_RENDERS_MAX, enabled: true, limit: 3 },
      { featureKey: F.VIDEO_HD, enabled: true },
      { featureKey: F.WATERMARK, enabled: false },
      { featureKey: F.CUSTOM_DOMAIN, enabled: false },
      { featureKey: F.WHATSAPP_MESSAGES, enabled: true, limit: 300 },
    ],
  },
  {
    key: 'PREMIUM',
    name: 'Premium',
    description: 'Any template, unlimited functions and guests, video invites and a large photo gallery.',
    priceMinor: 299900,
    interval: 'ONE_TIME',
    sortOrder: 2,
    features: [
      { featureKey: F.FUNCTIONS_MAX, enabled: true, limit: null },
      { featureKey: F.GUESTS_MAX, enabled: true, limit: null },
      { featureKey: F.TEMPLATES_MAX_TIER, enabled: true, limit: 2 },
      { featureKey: F.PHOTOS_MAX, enabled: true, limit: 5000 },
      { featureKey: F.VIDEO_RENDERS_MAX, enabled: true, limit: 10 },
      { featureKey: F.VIDEO_HD, enabled: true },
      { featureKey: F.WATERMARK, enabled: false },
      { featureKey: F.CUSTOM_DOMAIN, enabled: true },
      { featureKey: F.WHATSAPP_MESSAGES, enabled: true, limit: 1000 },
    ],
  },
  {
    key: 'STUDIO',
    name: 'Studio',
    description: 'For planners, photographers and designers managing many client events.',
    priceMinor: 599900,
    interval: 'YEAR',
    sortOrder: 3,
    features: [
      { featureKey: F.EVENTS_MAX, enabled: true, limit: 50 },
      { featureKey: F.FUNCTIONS_MAX, enabled: true, limit: null },
      { featureKey: F.GUESTS_MAX, enabled: true, limit: null },
      { featureKey: F.TEMPLATES_MAX_TIER, enabled: true, limit: 2 },
      { featureKey: F.PHOTOS_MAX, enabled: true, limit: 5000 },
      { featureKey: F.VIDEO_RENDERS_MAX, enabled: true, limit: 50 },
      { featureKey: F.VIDEO_HD, enabled: true },
      { featureKey: F.WATERMARK, enabled: false },
      { featureKey: F.PLANNER, enabled: true },
      { featureKey: F.CUSTOM_DOMAIN, enabled: true },
      { featureKey: F.WHATSAPP_MESSAGES, enabled: true, limit: 1000 },
    ],
  },
];

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  for (const [index, type] of EVENT_TYPES.entries()) {
    await prisma.eventType.upsert({
      where: { key: type.key },
      create: {
        key: type.key,
        name: type.name,
        detailsSchemaKey: type.detailsSchemaKey ?? null,
        defaultFunctions: type.defaultFunctions,
        defaultGroups: type.defaultGroups,
        sortOrder: index,
      },
      update: {},
    });
  }

  for (const [index, lang] of LANGUAGES.entries()) {
    await prisma.language.upsert({
      where: { code: lang.code },
      create: { code: lang.code, name: lang.name, nativeName: lang.nativeName, script: lang.script, direction: lang.direction, sortOrder: index },
      update: {},
    });
  }

  for (const plan of PLANS) {
    const existing = await prisma.pricingPlan.findUnique({ where: { key: plan.key }, include: { features: true } });
    if (!existing) {
      await prisma.pricingPlan.create({
        data: {
          key: plan.key,
          name: plan.name,
          description: plan.description,
          priceMinor: plan.priceMinor,
          interval: plan.interval,
          sortOrder: plan.sortOrder,
          features: { create: plan.features.map((f) => ({ featureKey: f.featureKey, enabled: f.enabled, limit: f.limit ?? null })) },
        },
      });
      continue;
    }
    // Add features introduced after the plan was first seeded; never change existing ones.
    const have = new Set(existing.features.map((f) => f.featureKey));
    const missing = plan.features.filter((f) => !have.has(f.featureKey));
    if (missing.length) {
      await prisma.planFeature.createMany({
        data: missing.map((f) => ({ planId: existing.id, featureKey: f.featureKey, enabled: f.enabled, limit: f.limit ?? null })),
      });
    }
  }
}

/**
 * Seed catalog templates. New templates are created as published version 1.
 * With `updateChanged`, a catalog definition that differs from the current
 * published version is published as a new version (history is kept).
 */
/** JSON with object keys sorted: jsonb reorders keys, so plain stringify would see every stored definition as changed. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(sort(value));
}

/** Versions the catalog itself published (staff edits in Template Studio use other changelogs). */
const CATALOG_CHANGELOGS = new Set(['Catalog seed', 'Catalog update']);

/**
 * The template catalog is code (templates/src). On every deploy:
 *  - new catalog templates are created and published;
 *  - catalog-owned templates whose definition changed get a new published
 *    version (events keep the version they chose), with their name,
 *    description and filters refreshed. Templates staff edited in Template
 *    Studio are left alone unless `updateChanged` (--update-templates) forces it;
 *  - templates staff deleted are never recreated or touched;
 *  - retired catalog keys (lookalikes removed from the catalog) are soft-deleted.
 */
export async function seedTemplates(
  prisma: PrismaClient,
  options: { updateChanged?: boolean } = {},
): Promise<{ created: number; updated: number; retired: number }> {
  let created = 0;
  let updated = 0;
  for (const { meta, definition } of TEMPLATE_CATALOG) {
    const validated = validateTemplateDefinition(definition);
    if (!validated.ok) throw new Error(`Catalog template ${meta.key} is invalid: ${JSON.stringify(validated.issues)}`);
    const json = validated.definition as unknown as Prisma.InputJsonValue;
    const type = validated.definition.type as TemplateType;
    const metaData = {
      name: meta.name,
      description: meta.description,
      category: meta.category,
      style: meta.style,
      tier: meta.tier,
      badge: meta.badge ?? null,
      featured: meta.featured ?? false,
      sortOrder: meta.sortOrder,
      eventTypes: meta.eventTypes,
      languages: validated.definition.languages,
      outputs: [type],
      isPremium: meta.tier === 'PREMIUM',
      tags: meta.tags,
    };

    const existing = await prisma.template.findUnique({ where: { key: meta.key }, include: { currentVersion: true, versions: { select: { version: true } } } });
    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const template = await tx.template.create({ data: { key: meta.key, ...metaData, status: 'PUBLISHED' } });
        const version = await tx.templateVersion.create({
          data: { templateId: template.id, version: 1, type, definition: json, status: 'PUBLISHED', publishedAt: new Date(), changelog: 'Catalog seed' },
        });
        await tx.template.update({ where: { id: template.id }, data: { currentVersionId: version.id } });
      });
      created++;
      continue;
    }
    if (existing.deletedAt) continue;
    const catalogOwned = !existing.currentVersion || CATALOG_CHANGELOGS.has(existing.currentVersion.changelog ?? '');
    const changed = canonicalJson(existing.currentVersion?.definition) !== canonicalJson(validated.definition);
    if (changed && (catalogOwned || options.updateChanged)) {
      const next = Math.max(0, ...existing.versions.map((v) => v.version)) + 1;
      await prisma.$transaction(async (tx) => {
        const version = await tx.templateVersion.create({
          data: { templateId: existing.id, version: next, type, definition: json, status: 'PUBLISHED', publishedAt: new Date(), changelog: 'Catalog update' },
        });
        await tx.template.update({ where: { id: existing.id }, data: { ...metaData, currentVersionId: version.id } });
      });
      updated++;
    }
  }
  const retired = await prisma.template.updateMany({
    where: { key: { in: [...RETIRED_TEMPLATE_KEYS] }, deletedAt: null },
    data: { status: 'ARCHIVED', deletedAt: new Date() },
  });
  return { created, updated, retired: retired.count };
}
