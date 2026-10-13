import { FEATURE_KEYS } from '@bulava/validation';
import type { PrismaClient } from '../generated/client';

/**
 * Plan feature resolution, shared by the API (EntitlementsService) and the
 * workers, so a reminder job and a dashboard request never disagree about what
 * an event's plan allows. Nothing about pricing or limits is hard-coded: the
 * FREE plan's PlanFeature rows are the baseline, and paid or complimentary
 * grants (Entitlement rows) override it.
 */

export interface FeatureValue {
  enabled: boolean;
  /** null = unlimited. */
  limit: number | null;
  /** SUBSCRIPTION: the account's plan (one-time or yearly); ADDON: an add-on bought on top of it (ADR-062). */
  source: 'FREE_PLAN' | 'EVENT_PURCHASE' | 'SUBSCRIPTION' | 'ADDON';
}

/** Entitlements from add-ons (ADR-062): they add to the plan instead of replacing it. */
export const ADDON_SOURCE = 'ADDON';

type Db = Pick<PrismaClient, 'event' | 'pricingPlan' | 'entitlement'>;

/** For boolean features where the customer is better off with the feature disabled. */
const PREFER_DISABLED = new Set<string>(['branding.watermark']);

export function moreGenerous(key: string, a: FeatureValue, b: FeatureValue): FeatureValue {
  if (a.enabled !== b.enabled) {
    const preferDisabled = PREFER_DISABLED.has(key);
    return (preferDisabled ? !a.enabled : a.enabled) ? a : b;
  }
  if (a.limit === null) return a;
  if (b.limit === null) return b;
  return a.limit >= b.limit ? a : b;
}

/**
 * Add-ons on top of the features so far (ADR-062): a limit adds to the plan's
 * (an unlimited one stays unlimited, a switched-off one starts from nothing),
 * a switch is set as generously as the plan allows (the watermark goes off,
 * HD comes on).
 */
export function withAddOns(features: Map<string, FeatureValue>, addOns: ReadonlyArray<{ featureKey: string; enabled: boolean; limit: number | null }>): Map<string, FeatureValue> {
  if (!addOns.length) return features;
  const out = new Map(features);
  for (const a of addOns) {
    const current = out.get(a.featureKey);
    if (a.limit !== null) {
      const base = current?.enabled ? current.limit : 0;
      out.set(a.featureKey, { enabled: true, limit: base === null ? null : base + a.limit, source: 'ADDON' });
      continue;
    }
    const value: FeatureValue = { enabled: a.enabled, limit: null, source: 'ADDON' };
    out.set(a.featureKey, current && current.source !== 'FREE_PLAN' ? moreGenerous(a.featureKey, current, value) : value);
  }
  return out;
}

async function freePlan(prisma: Db): Promise<Map<string, FeatureValue>> {
  const plan = await prisma.pricingPlan.findUnique({ where: { key: 'FREE' }, include: { features: true } });
  return new Map((plan?.features ?? []).map((f) => [f.featureKey, { enabled: f.enabled, limit: f.limit, source: 'FREE_PLAN' as const }]));
}

/** Effective features for an event: FREE baseline, overridden by event purchases and the owner's subscription. Null when the event does not exist. */
export async function loadEventFeatures(prisma: Db, eventId: string, now: Date = new Date()): Promise<Map<string, FeatureValue> | null> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event) return null;
  const [base, grants] = await Promise.all([
    freePlan(prisma),
    prisma.entitlement.findMany({
      where: {
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        AND: [{ OR: [{ eventId }, { userId: event.ownerId, eventId: null }] }],
      },
    }),
  ]);
  const granted = new Map<string, FeatureValue>();
  for (const g of grants) {
    if (g.sourceType === ADDON_SOURCE) continue;
    const value: FeatureValue = { enabled: g.enabled, limit: g.limit, source: g.eventId ? 'EVENT_PURCHASE' : 'SUBSCRIPTION' };
    const current = granted.get(g.featureKey);
    granted.set(g.featureKey, current ? moreGenerous(g.featureKey, current, value) : value);
  }
  return withAddOns(
    new Map([...base, ...granted]),
    grants.filter((g) => g.sourceType === ADDON_SOURCE),
  );
}

/** Features for creating new events (user-level): FREE baseline + subscription. */
export async function loadUserFeatures(prisma: Db, userId: string, now: Date = new Date()): Promise<Map<string, FeatureValue>> {
  const [base, grants] = await Promise.all([
    freePlan(prisma),
    prisma.entitlement.findMany({
      where: { userId, eventId: null, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    }),
  ]);
  const merged = new Map(base);
  for (const g of grants) {
    if (g.sourceType === ADDON_SOURCE) continue;
    const value: FeatureValue = { enabled: g.enabled, limit: g.limit, source: 'SUBSCRIPTION' };
    const current = merged.get(g.featureKey);
    merged.set(g.featureKey, current && current.source !== 'FREE_PLAN' ? moreGenerous(g.featureKey, current, value) : value);
  }
  return withAddOns(
    merged,
    grants.filter((g) => g.sourceType === ADDON_SOURCE),
  );
}

/** Whether an event's plan includes the photo gallery: on unless its plan turns it off, as the API checks it. */
export async function galleryIncluded(prisma: Db, eventId: string, now: Date = new Date()): Promise<boolean> {
  const features = await loadEventFeatures(prisma, eventId, now);
  return !!features && (features.get(FEATURE_KEYS.GALLERY)?.enabled ?? true);
}

/** A count limit: 0 when the feature is off, null when unlimited. */
export function featureLimit(features: Map<string, FeatureValue>, key: string): number | null {
  const f = features.get(key);
  if (!f || !f.enabled) return 0;
  return f.limit;
}

/**
 * Serialise WhatsApp allowance checks for one event, until the surrounding
 * transaction ends. Host sends (API) and scheduled reminders (worker) take it
 * before counting what is left, so two at once cannot both spend the last
 * messages. Call it inside a transaction.
 */
export async function lockWhatsAppAllowance(tx: Pick<PrismaClient, '$executeRaw'>, eventId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`whatsapp-allowance:${eventId}`}::text, 0))`;
}

/** WhatsApp Business messages an event has used: queued or sent (skipped and failed ones are not charged). */
export function whatsappMessagesUsed(prisma: Pick<PrismaClient, 'notification'>, eventId: string): Promise<number> {
  return prisma.notification.count({ where: { eventId, channel: 'WHATSAPP', status: { in: ['QUEUED', 'SENT'] } } });
}

/** WhatsApp messages an event may still send: 0 when its plan has none, Infinity when unlimited. */
export async function whatsappMessagesLeft(prisma: Db & Pick<PrismaClient, 'notification'>, eventId: string, now: Date = new Date()): Promise<number> {
  const features = await loadEventFeatures(prisma, eventId, now);
  if (!features) return 0;
  const limit = featureLimit(features, FEATURE_KEYS.WHATSAPP_MESSAGES);
  if (limit === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - (await whatsappMessagesUsed(prisma, eventId)));
}
