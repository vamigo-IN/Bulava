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
  /** The usual price shown struck through beside the offer price (ADR-067). */
  listPriceMinor?: number;
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

/** A paid plan's features, in the order the plans page reads them (ADR-067). */
function tier(o: {
  functions: number | null;
  guests: number | null;
  /** 1: Free and Premium designs; 2: Signature designs too. */
  designs: 1 | 2;
  photos: number;
  renders: number;
  whatsapp: number;
  music: boolean;
  /** The owner's own link and domain. */
  premium: boolean;
  /** Watermark-free digital cards included. */
  cards: number;
  prioritySupport?: boolean;
}): PlanSeed['features'] {
  return [
    { featureKey: F.EVENTS_MAX, enabled: true, limit: 1 },
    { featureKey: F.FUNCTIONS_MAX, enabled: true, limit: o.functions },
    { featureKey: F.GUESTS_MAX, enabled: true, limit: o.guests },
    { featureKey: F.TEMPLATES_MAX_TIER, enabled: true, limit: o.designs },
    { featureKey: F.PHOTOS_MAX, enabled: true, limit: o.photos },
    { featureKey: F.VIDEO_RENDERS_MAX, enabled: o.renders > 0, limit: o.renders },
    { featureKey: F.VIDEO_HD, enabled: o.renders > 0 },
    { featureKey: F.WATERMARK, enabled: false },
    { featureKey: F.CUSTOM_DOMAIN, enabled: o.premium },
    { featureKey: F.WHATSAPP_MESSAGES, enabled: o.whatsapp > 0, limit: o.whatsapp },
    { featureKey: F.RSVP, enabled: true },
    { featureKey: F.MUSIC, enabled: o.music },
    { featureKey: F.CUSTOM_LINK, enabled: o.premium },
    { featureKey: F.GALLERY, enabled: true },
    { featureKey: F.CARDS_INCLUDED, enabled: o.cards > 0, limit: o.cards },
    ...(o.prioritySupport ? [{ featureKey: F.PRIORITY_SUPPORT, enabled: true }] : []),
  ];
}

/**
 * Initial plans and add-ons: Free and four one-time paid plans, each for one
 * celebration, offered below their usual price, with add-ons on top (ADR-062,
 * ADR-067). Prices and limits are editable by admins; code never reads them
 * from here at runtime.
 */
const PLANS: PlanSeed[] = [
  {
    key: 'FREE',
    name: 'Free',
    description: 'One event with one function on a free design, with the Bulava mark across it. Design and preview anything you like.',
    priceMinor: 0,
    interval: 'ONE_TIME',
    sortOrder: 0,
    features: [
      { featureKey: F.EVENTS_MAX, enabled: true, limit: 1 },
      { featureKey: F.FUNCTIONS_MAX, enabled: true, limit: 1 },
      { featureKey: F.GUESTS_MAX, enabled: true, limit: 50 },
      { featureKey: F.TEMPLATES_MAX_TIER, enabled: true, limit: 0 },
      { featureKey: F.PHOTOS_MAX, enabled: true, limit: 0 },
      { featureKey: F.VIDEO_RENDERS_MAX, enabled: false, limit: 0 },
      { featureKey: F.VIDEO_HD, enabled: false },
      { featureKey: F.WATERMARK, enabled: true },
      { featureKey: F.CUSTOM_DOMAIN, enabled: false },
      { featureKey: F.WHATSAPP_MESSAGES, enabled: false, limit: 0 },
      { featureKey: F.RSVP, enabled: false },
      { featureKey: F.MUSIC, enabled: false },
      { featureKey: F.CUSTOM_LINK, enabled: false },
      { featureKey: F.GALLERY, enabled: false },
      { featureKey: F.CARDS_INCLUDED, enabled: false, limit: 0 },
    ],
  },
  {
    key: 'STARTER',
    name: 'Starter',
    description: 'Your invitation without the Bulava mark, on Premium designs: one function, RSVP for 150 guests and a 50-photo gallery.',
    priceMinor: 29900,
    listPriceMinor: 59900,
    interval: 'ONE_TIME',
    sortOrder: 1,
    tagline: 'No branding',
    features: tier({ functions: 1, guests: 150, designs: 1, photos: 50, renders: 0, whatsapp: 0, music: false, premium: false, cards: 0 }),
  },
  {
    key: 'STANDARD',
    name: 'Standard',
    description: 'Up to 4 functions and 400 guests, invitations and RSVP updates on WhatsApp, music, a 250-photo gallery and 5 watermark-free cards.',
    priceMinor: 59900,
    listPriceMinor: 119900,
    interval: 'ONE_TIME',
    sortOrder: 2,
    tagline: 'RSVP on WhatsApp',
    features: tier({ functions: 4, guests: 400, designs: 1, photos: 250, renders: 0, whatsapp: 300, music: true, premium: false, cards: 5 }),
  },
  {
    key: 'PREMIUM',
    name: 'Premium',
    description: 'Signature designs, the MP4 video, your own link, 8 functions, 1,000 guests, a 1,000-photo gallery and 10 watermark-free cards.',
    priceMinor: 99900,
    listPriceMinor: 199900,
    interval: 'ONE_TIME',
    sortOrder: 3,
    badge: 'Most popular',
    tagline: '+ MP4 video',
    features: tier({ functions: 8, guests: 1000, designs: 2, photos: 1000, renders: 5, whatsapp: 700, music: true, premium: true, cards: 10 }),
  },
  {
    key: 'ULTIMATE',
    name: 'Ultimate',
    description: 'Everything for one big celebration: unlimited functions and guests, every design, 10 videos, a 5,000-photo gallery and 20 watermark-free cards.',
    priceMinor: 199900,
    listPriceMinor: 399900,
    interval: 'ONE_TIME',
    sortOrder: 4,
    tagline: 'Everything, unlimited',
    features: tier({ functions: null, guests: null, designs: 2, photos: 5000, renders: 10, whatsapp: 1500, music: true, premium: true, cards: 20, prioritySupport: true }),
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
    offeredTo: ['STARTER', 'STANDARD'],
    features: [
      { featureKey: F.VIDEO_RENDERS_MAX, enabled: true, limit: 5 },
      { featureKey: F.VIDEO_HD, enabled: true },
    ],
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
    offeredTo: ['STARTER', 'STANDARD', 'PREMIUM'],
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
    offeredTo: ['STARTER', 'STANDARD', 'PREMIUM', 'ULTIMATE'],
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
          listPriceMinor: plan.listPriceMinor ?? null,
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
      isPremium: meta.tier === 'SIGNATURE',
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
 * migrates. A release that changes the database may not be able to read it yet (a table or column it
 * lacks, an enum value it renamed), so there is nothing to compare: null instead of an error, and the
 * migrate job then reports what it syncs. `migrationsPending` (from `pendingMigrations`) says the
 * release has migrations still to run: then any query the database refuses means just that.
 */
export async function previewTemplates(
  prisma: PrismaClient,
  options: { updateChanged?: boolean; catalog?: CatalogEntry[]; retiredKeys?: readonly string[]; migrationsPending?: boolean } = {},
): Promise<TemplateSeedResult | null> {
  const { migrationsPending = false, ...seedOptions } = options;
  try {
    return await seedTemplates(prisma, { ...seedOptions, dryRun: true });
  } catch (error) {
    if (schemaBehind(error) || (migrationsPending && queryRefused(error))) return null;
    throw error;
  }
}

/** The database lacks a table (P2021) or column (P2022) this release reads: its migrations have not run yet. */
export function schemaBehind(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'P2021' || code === 'P2022';
}

/**
 * A query the database answered with data this release's client cannot read or a refusal (Prisma's
 * P2xxx errors, and unknown request errors such as "Value 'STANDARD' not found in enum"), as opposed
 * to an unreachable database (P1xxx) or a bug in the seed.
 */
function queryRefused(error: unknown): boolean {
  const { name, code } = (error ?? {}) as { name?: unknown; code?: unknown };
  if (name === 'PrismaClientUnknownRequestError') return true;
  return name === 'PrismaClientKnownRequestError' && typeof code === 'string' && code.startsWith('P2');
}
