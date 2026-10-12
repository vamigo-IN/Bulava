import type { Prisma, PrismaClient, TemplateType } from '../generated/client';
import { LANGUAGES } from '@bulava/localization';
import { RETIRED_TEMPLATE_KEYS, TEMPLATE_CATALOG, type CatalogEntry } from '@bulava/template-catalog';
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
  /** A tier (the account's plan) or an add-on bought on top of one (ADR-062). */
  kind?: 'PLAN' | 'ADDON';
  /** Hidden plans are sold only through an offer link (or granted by staff). */
  visibility?: 'PUBLIC' | 'HIDDEN';
  badge?: string;
  tagline?: string;
  stackable?: boolean;
  /** The plans an add-on is offered to; empty: every paid plan. */
  offeredTo?: string[];
  features: Array<{ featureKey: string; enabled: boolean; limit?: number | null }>;
}

const F = FEATURE_KEYS;

/** A tier's features, in the order the plans page reads them. */
function tier(o: {
  functions: number | null;
  guests: number | null;
  designs: 1 | 2;
  photos: number;
  renders: number;
  watermark: boolean;
  whatsapp: number;
  rsvp: boolean;
  premium: boolean;
  doneForYou?: boolean;
}): PlanSeed['features'] {
  return [
    { featureKey: F.EVENTS_MAX, enabled: true, limit: 1 },
    { featureKey: F.FUNCTIONS_MAX, enabled: true, limit: o.functions },
    { featureKey: F.GUESTS_MAX, enabled: true, limit: o.guests },
    { featureKey: F.TEMPLATES_MAX_TIER, enabled: true, limit: o.designs },
    { featureKey: F.PHOTOS_MAX, enabled: true, limit: o.photos },
    { featureKey: F.VIDEO_RENDERS_MAX, enabled: o.renders > 0, limit: o.renders },
    { featureKey: F.VIDEO_HD, enabled: o.renders > 0 },
    { featureKey: F.WATERMARK, enabled: o.watermark },
    { featureKey: F.CUSTOM_DOMAIN, enabled: o.premium },
    { featureKey: F.WHATSAPP_MESSAGES, enabled: o.whatsapp > 0, limit: o.whatsapp },
    { featureKey: F.RSVP, enabled: o.rsvp },
    { featureKey: F.MUSIC, enabled: o.premium },
    { featureKey: F.CUSTOM_LINK, enabled: o.premium },
    ...(o.doneForYou ? [{ featureKey: F.DONE_FOR_YOU, enabled: true }, { featureKey: F.PRIORITY_SUPPORT, enabled: true }] : []),
  ];
}

/**
 * Initial plans and add-ons: one-time tiers, each for one celebration, and
 * add-ons on top (ADR-062). Prices and limits are editable by admins; code
 * never reads them from here at runtime.
 */
const PLANS: PlanSeed[] = [
  {
    key: 'FREE',
    name: 'Free',
    description: 'Design and preview your invitation, video and cards as much as you like. Choose a plan to publish and download.',
    priceMinor: 0,
    interval: 'ONE_TIME',
    sortOrder: 0,
    features: [
      { featureKey: F.EVENTS_MAX, enabled: true, limit: 0 },
      { featureKey: F.FUNCTIONS_MAX, enabled: true, limit: 6 },
      { featureKey: F.GUESTS_MAX, enabled: true, limit: 100 },
      { featureKey: F.TEMPLATES_MAX_TIER, enabled: true, limit: 0 },
      { featureKey: F.PHOTOS_MAX, enabled: true, limit: 50 },
      { featureKey: F.VIDEO_RENDERS_MAX, enabled: false, limit: 0 },
      { featureKey: F.VIDEO_HD, enabled: false },
      { featureKey: F.WATERMARK, enabled: true },
      { featureKey: F.CUSTOM_DOMAIN, enabled: false },
      { featureKey: F.WHATSAPP_MESSAGES, enabled: false },
      // On in the baseline so invitations published for free before plans were one-time keep working.
      { featureKey: F.RSVP, enabled: true },
      { featureKey: F.MUSIC, enabled: true },
      { featureKey: F.CUSTOM_LINK, enabled: false },
    ],
  },
  {
    key: 'LITE',
    name: 'Lite',
    description: 'Your invitation live and as a PDF, with a small Bulava mark: two functions and 100 guests.',
    priceMinor: 15900,
    interval: 'ONE_TIME',
    sortOrder: 1,
    visibility: 'HIDDEN',
    tagline: 'Start small',
    features: tier({ functions: 2, guests: 100, designs: 1, photos: 100, renders: 0, watermark: true, whatsapp: 0, rsvp: false, premium: false }),
  },
  {
    key: 'STARTER',
    name: 'Starter',
    description: 'A clean invitation without branding, live and as a PDF: five functions and 250 guests.',
    priceMinor: 29900,
    interval: 'ONE_TIME',
    sortOrder: 2,
    tagline: 'No branding',
    features: tier({ functions: 5, guests: 250, designs: 1, photos: 250, renders: 0, watermark: false, whatsapp: 150, rsvp: true, premium: false }),
  },
  {
    key: 'STANDARD',
    name: 'Standard',
    description: 'Up to 8 functions and 500 guests, RSVP for each function, no branding.',
    priceMinor: 59900,
    interval: 'ONE_TIME',
    sortOrder: 3,
    tagline: 'Guest RSVP',
    features: tier({ functions: 8, guests: 500, designs: 1, photos: 500, renders: 0, watermark: false, whatsapp: 300, rsvp: true, premium: false }),
  },
  {
    key: 'PREMIUM',
    name: 'Premium',
    description: 'The shareable MP4 video, premium designs, your own link and music, 12 functions and 1,000 guests.',
    priceMinor: 99900,
    interval: 'ONE_TIME',
    sortOrder: 4,
    badge: 'Most popular',
    tagline: '+ MP4 video',
    features: tier({ functions: 12, guests: 1000, designs: 2, photos: 1000, renders: 5, watermark: false, whatsapp: 700, rsvp: true, premium: true }),
  },
  {
    key: 'ULTIMATE',
    name: 'Ultimate',
    description: 'Everything for one big wedding: unlimited functions and guests, every design and a 5,000-photo gallery.',
    priceMinor: 199900,
    interval: 'ONE_TIME',
    sortOrder: 5,
    tagline: 'All designs',
    features: tier({ functions: null, guests: null, designs: 2, photos: 5000, renders: 10, watermark: false, whatsapp: 1500, rsvp: true, premium: true }),
  },
  {
    key: 'GRAND',
    name: 'Grand',
    description: 'We set it up for you: everything in Ultimate, our team building your invitation, and priority support.',
    priceMinor: 299900,
    interval: 'ONE_TIME',
    sortOrder: 6,
    tagline: 'Done-for-you',
    features: tier({ functions: null, guests: null, designs: 2, photos: 5000, renders: 20, watermark: false, whatsapp: 3000, rsvp: true, premium: true, doneForYou: true }),
  },
  {
    key: 'STUDIO',
    name: 'Studio',
    description: 'For planners, photographers and designers managing many client events.',
    priceMinor: 599900,
    interval: 'YEAR',
    sortOrder: 9,
    visibility: 'HIDDEN',
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
      { featureKey: F.RSVP, enabled: true },
      { featureKey: F.MUSIC, enabled: true },
      { featureKey: F.CUSTOM_LINK, enabled: true },
    ],
  },
  // Add-ons: one thing more for a plan, without buying the next one. A limit adds to the plan's.
  {
    key: 'ADDON_VIDEO',
    name: 'MP4 video invite',
    description: 'A video your family can forward on WhatsApp, made from your invitation.',
    priceMinor: 30000,
    interval: 'ONE_TIME',
    sortOrder: 20,
    kind: 'ADDON',
    offeredTo: ['LITE', 'STARTER', 'STANDARD'],
    features: [
      { featureKey: F.VIDEO_RENDERS_MAX, enabled: true, limit: 5 },
      { featureKey: F.VIDEO_HD, enabled: true },
    ],
  },
  {
    key: 'ADDON_NO_MARK',
    name: 'Remove the Bulava mark',
    description: 'Your invitation, video and cards without the small Bulava mark.',
    priceMinor: 14900,
    interval: 'ONE_TIME',
    sortOrder: 21,
    kind: 'ADDON',
    offeredTo: ['LITE'],
    features: [{ featureKey: F.WATERMARK, enabled: false }],
  },
  {
    key: 'ADDON_FUNCTION',
    name: 'One more function',
    description: 'Room for another function (a haldi, a sangeet, a reception…) on your invitation.',
    priceMinor: 19900,
    interval: 'ONE_TIME',
    sortOrder: 22,
    kind: 'ADDON',
    stackable: true,
    offeredTo: ['LITE', 'STARTER', 'STANDARD', 'PREMIUM'],
    features: [{ featureKey: F.FUNCTIONS_MAX, enabled: true, limit: 1 }],
  },
  {
    key: 'ADDON_EVENT',
    name: 'One more celebration',
    description: 'Publish another event (a sibling’s wedding, a birthday) with everything your plan includes.',
    priceMinor: 19900,
    interval: 'ONE_TIME',
    sortOrder: 23,
    kind: 'ADDON',
    stackable: true,
    features: [{ featureKey: F.EVENTS_MAX, enabled: true, limit: 1 }],
  },
  {
    key: 'ADDON_PHOTOS',
    name: '1,000 more guest photos',
    description: 'A bigger photo gallery for everything your guests share.',
    priceMinor: 14900,
    interval: 'ONE_TIME',
    sortOrder: 24,
    kind: 'ADDON',
    stackable: true,
    features: [{ featureKey: F.PHOTOS_MAX, enabled: true, limit: 1000 }],
  },
  {
    key: 'ADDON_DONE_FOR_YOU',
    name: 'Done-for-you setup',
    description: 'Our team sets up your invitation, functions and guest list with you.',
    priceMinor: 49900,
    interval: 'ONE_TIME',
    sortOrder: 25,
    kind: 'ADDON',
    offeredTo: ['LITE', 'STARTER', 'STANDARD', 'PREMIUM', 'ULTIMATE'],
    features: [{ featureKey: F.DONE_FOR_YOU, enabled: true }],
  },
  {
    key: 'ADDON_RUSH',
    name: 'Same-day delivery',
    description: 'What our team makes for you, delivered the same day.',
    priceMinor: 19900,
    interval: 'ONE_TIME',
    sortOrder: 26,
    kind: 'ADDON',
    features: [{ featureKey: F.RUSH, enabled: true }],
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
          kind: plan.kind ?? 'PLAN',
          visibility: plan.visibility ?? 'PUBLIC',
          badge: plan.badge ?? null,
          tagline: plan.tagline ?? null,
          stackable: plan.stackable ?? false,
          offeredTo: plan.offeredTo ?? [],
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

/** JSON with object keys sorted: jsonb reorders keys, so plain stringify would see every stored definition as changed. */
export function canonicalJson(value: unknown): string {
  // Numbers compare to 15 significant digits: a stored definition comes back with float noise
  // rounded away (0.35 + 0.1 is saved as 0.45), which must not count as a change.
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : typeof v === 'number' && Number.isFinite(v)
          ? Number(v.toPrecision(15))
          : v;
  return JSON.stringify(sort(value));
}

/** Versions the catalog itself published (staff edits in Template Studio use other changelogs). */
const CATALOG_CHANGELOGS = new Set(['Catalog seed', 'Catalog update']);

export interface TemplateSeedResult {
  created: number;
  /** New published versions of catalog templates whose design changed. */
  updated: number;
  /** Catalog templates whose listing (tier, tags, order, featured…) changed without a new design. */
  synced: number;
  retired: number;
  /** What changed (or, in a dry run, what would), template by template. */
  changes: Array<{ key: string; change: 'create' | 'update' | 'sync' | 'retire' }>;
}

/**
 * The template catalog is code (templates/src); this is its migration, run by
 * the deploy's migrate job on every release. It is idempotent:
 *  - new catalog templates are created and published;
 *  - catalog-owned templates whose definition changed get a new published
 *    version (events keep the version they chose). Templates staff edited in
 *    Template Studio are left alone unless `updateChanged` (--update-templates) forces it;
 *  - catalog-owned templates whose listing changed (tier, tags, order…) are
 *    updated in place, unless staff edited that listing in the console;
 *  - templates staff deleted are never recreated or touched;
 *  - retired catalog keys (lookalikes removed from the catalog) are soft-deleted.
 * `dryRun` reports the changes without writing anything.
 */
export async function seedTemplates(
  prisma: PrismaClient,
  options: { updateChanged?: boolean; dryRun?: boolean; catalog?: CatalogEntry[]; retiredKeys?: readonly string[] } = {},
): Promise<TemplateSeedResult> {
  const catalog = options.catalog ?? TEMPLATE_CATALOG;
  const retiredKeys = [...(options.retiredKeys ?? RETIRED_TEMPLATE_KEYS)];
  const result: TemplateSeedResult = { created: 0, updated: 0, synced: 0, retired: 0, changes: [] };
  // Everything the comparison needs in two queries, not one per template.
  const rows = await prisma.template.findMany({
    where: { key: { in: catalog.map((e) => e.meta.key) } },
    include: { currentVersion: { select: { definition: true, changelog: true } }, versions: { select: { version: true }, orderBy: { version: 'desc' }, take: 1 } },
  });
  const existingByKey = new Map(rows.map((r) => [r.key, r]));
  const staffListed = new Set(
    (await prisma.auditLog.findMany({ where: { action: 'template.meta_updated', targetId: { in: rows.map((r) => r.id) } }, select: { targetId: true } })).map((a) => a.targetId),
  );

  for (const { meta, definition } of catalog) {
    const validated = validateTemplateDefinition(definition);
    if (!validated.ok) throw new Error(`Catalog template ${meta.key} is invalid: ${JSON.stringify(validated.issues)}`);
    const json = validated.definition as unknown as Prisma.InputJsonValue;
    const type = validated.definition.type as TemplateType;
    const listing = {
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

    const existing = existingByKey.get(meta.key);
    if (!existing) {
      result.created++;
      result.changes.push({ key: meta.key, change: 'create' });
      if (options.dryRun) continue;
      await prisma.$transaction(async (tx) => {
        const template = await tx.template.create({ data: { key: meta.key, ...listing, status: 'PUBLISHED' } });
        const version = await tx.templateVersion.create({
          data: { templateId: template.id, version: 1, type, definition: json, status: 'PUBLISHED', publishedAt: new Date(), changelog: 'Catalog seed' },
        });
        await tx.template.update({ where: { id: template.id }, data: { currentVersionId: version.id } });
      });
      continue;
    }
    if (existing.deletedAt) continue;
    const catalogOwned = !existing.currentVersion || CATALOG_CHANGELOGS.has(existing.currentVersion.changelog ?? '');
    // A listing staff changed in the console stays theirs; the design still follows the catalog.
    const ownListing: Partial<typeof listing> = staffListed.has(existing.id) ? { languages: listing.languages, outputs: listing.outputs } : listing;
    // The stored design as the current schema reads it: a field added with a default (a photo's crop) is no new design.
    const storedDesign = existing.currentVersion ? validateTemplateDefinition(existing.currentVersion.definition) : null;
    const changed = canonicalJson(storedDesign?.ok ? storedDesign.definition : existing.currentVersion?.definition) !== canonicalJson(validated.definition);
    if (changed && (catalogOwned || options.updateChanged)) {
      result.updated++;
      result.changes.push({ key: meta.key, change: 'update' });
      if (options.dryRun) continue;
      const next = (existing.versions[0]?.version ?? 0) + 1;
      await prisma.$transaction(async (tx) => {
        const version = await tx.templateVersion.create({
          data: { templateId: existing.id, version: next, type, definition: json, status: 'PUBLISHED', publishedAt: new Date(), changelog: 'Catalog update' },
        });
        await tx.template.update({ where: { id: existing.id }, data: { ...ownListing, currentVersionId: version.id } });
      });
      continue;
    }
    const stored = Object.fromEntries(Object.keys(ownListing).map((k) => [k, existing[k as keyof typeof listing]]));
    if (catalogOwned && canonicalJson(stored) !== canonicalJson(ownListing)) {
      result.synced++;
      result.changes.push({ key: meta.key, change: 'sync' });
      if (!options.dryRun) await prisma.template.update({ where: { id: existing.id }, data: ownListing });
    }
  }

  const retire = await prisma.template.findMany({ where: { key: { in: retiredKeys }, deletedAt: null }, select: { key: true } });
  result.retired = retire.length;
  result.changes.push(...retire.map((r) => ({ key: r.key, change: 'retire' as const })));
  if (retire.length && !options.dryRun) {
    await prisma.template.updateMany({ where: { key: { in: retire.map((r) => r.key) }, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
  }
  return result;
}

/**
 * The deploy's preview of the catalog migration: `seedTemplates` as a dry run, before the release
 * migrates. A release that changes the database cannot read the old tables yet, so there is nothing
 * to compare: null instead of an error (the migrate job then reports what it syncs).
 */
export async function previewTemplates(
  prisma: PrismaClient,
  options: { updateChanged?: boolean; catalog?: CatalogEntry[]; retiredKeys?: readonly string[] } = {},
): Promise<TemplateSeedResult | null> {
  try {
    return await seedTemplates(prisma, { ...options, dryRun: true });
  } catch (error) {
    if (schemaBehind(error)) return null;
    throw error;
  }
}

/** The database lacks a table (P2021) or column (P2022) this release reads: its migrations have not run yet. */
export function schemaBehind(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'P2021' || code === 'P2022';
}
