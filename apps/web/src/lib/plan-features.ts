import type { Translator } from '@bulava/localization';

/** A plan's admin-managed feature rows, as GET /meta/plans lists them. */
interface PlanFeatures {
  features: Array<{ featureKey: string; enabled: boolean; limit: number | null }>;
}

const featureMap = (plan: PlanFeatures) => new Map(plan.features.map((x) => [x.featureKey, x]));
const count = (n: number) => n.toLocaleString('en-IN');

/** What the host gets to share (ADR-062): the live link and the PDF with every plan, the MP4 video with some. */
export function planFormats(plan: PlanFeatures): { link: boolean; pdf: boolean; video: boolean } {
  const f = featureMap(plan);
  const events = f.get('events.max');
  const video = f.get('video.renders.max');
  return { link: Boolean(events?.enabled && (events.limit === null || events.limit > 0)), pdf: true, video: Boolean(video?.enabled && (video.limit === null || video.limit > 0)) };
}

/**
 * The plan card's lines from its admin-managed rows (nothing hard-coded), in
 * the words of a celebration: functions, guests, designs, photos, replies,
 * branding and what the team does. Software counters (published events, video
 * renders, message credits) stay off the cards (ADR-062); the comparison table
 * lists them.
 */
export function planFeatureLines(plan: PlanFeatures, t: Translator): string[] {
  const f = featureMap(plan);
  const lines: string[] = [];
  const fn = f.get('functions.max');
  if (fn?.enabled) lines.push(fn.limit === null ? t('plan.feature.functions.unlimited') : t('plan.feature.functions.max', { limit: fn.limit }));
  const guests = f.get('guests.max');
  if (guests?.enabled) lines.push(guests.limit === null ? t('plan.feature.guests.unlimited') : t('plan.feature.guests.max', { limit: count(guests.limit) }));
  const tier = f.get('templates.maxTier');
  if (tier?.enabled) lines.push(t(`plan.feature.templates.${Math.min(2, tier.limit ?? 2) as 0 | 1 | 2}`));
  // The photo gallery comes with the plan's gallery (ADR-067).
  const photos = f.get('media.photos.max');
  if ((f.get('gallery.enabled')?.enabled ?? true) && photos?.enabled && photos.limit !== null && photos.limit > 0) lines.push(t('plan.feature.photos', { limit: count(photos.limit) }));
  if (f.get('rsvp.enabled')?.enabled ?? true) lines.push(t('plan.feature.rsvp'));
  const wm = f.get('branding.watermark');
  if (wm) lines.push(wm.enabled ? t('plan.feature.watermark') : t('plan.feature.noWatermark'));
  if (f.get('messaging.whatsapp.max')?.enabled) lines.push(t('plan.feature.whatsappInvites'));
  const cards = f.get('cards.included');
  if (cards?.enabled && (cards.limit === null || cards.limit > 0)) lines.push(cards.limit === null ? t('plan.feature.cards.unlimited') : t('plan.feature.cards', { limit: count(cards.limit) }));
  if (f.get('music.enabled')?.enabled) lines.push(t('plan.feature.music'));
  if (f.get('link.custom')?.enabled) lines.push(t('plan.feature.customLink'));
  if (f.get('service.doneForYou')?.enabled) lines.push(t('plan.feature.doneForYou'));
  if (f.get('support.priority')?.enabled) lines.push(t('plan.feature.prioritySupport'));
  if (f.get('planner.workspace')?.enabled) lines.push(t('plan.feature.planner'));
  return lines;
}

/** One row of the plans comparison: a label and each plan's value in words. */
export interface CompareRow {
  label: string;
  values: string[];
}

/** Every plan side by side, the limits the cards leave out included (published events, video renders, WhatsApp messages). */
export function planCompareRows(plans: PlanFeatures[], t: Translator): CompareRow[] {
  const maps = plans.map(featureMap);
  const yes = t('pricing.compare.yes');
  const no = t('pricing.compare.no');
  const limit = (key: string, unit?: (n: number) => string) =>
    maps.map((f) => {
      const row = f.get(key);
      if (!row?.enabled) return no;
      if (row.limit === null) return t('pricing.compare.unlimited');
      return unit ? unit(row.limit) : count(row.limit);
    });
  const flag = (key: string, fallback = false) => maps.map((f) => ((f.get(key)?.enabled ?? fallback) ? yes : no));
  return [
    { label: t('pricing.compare.link'), values: plans.map((p) => (planFormats(p).link ? yes : no)) },
    { label: t('pricing.compare.pdf'), values: plans.map(() => yes) },
    { label: t('pricing.compare.video'), values: plans.map((p) => (planFormats(p).video ? yes : no)) },
    {
      label: t('pricing.compare.designs'),
      values: maps.map((f) => {
        const tier = f.get('templates.maxTier')?.limit ?? 0;
        return tier >= 2 ? t('pricing.compare.allDesigns') : tier === 1 ? t('pricing.compare.standardDesigns') : t('pricing.compare.freeDesigns');
      }),
    },
    { label: t('pricing.compare.branding'), values: maps.map((f) => (f.get('branding.watermark')?.enabled ? t('pricing.compare.mark') : t('pricing.compare.noMark'))) },
    { label: t('pricing.compare.celebrations'), values: limit('events.max') },
    { label: t('pricing.compare.functions'), values: limit('functions.max') },
    { label: t('pricing.compare.guests'), values: limit('guests.max') },
    { label: t('pricing.compare.photos'), values: maps.map((f, i) => ((f.get('gallery.enabled')?.enabled ?? true) && (f.get('media.photos.max')?.limit ?? 1) !== 0 ? limit('media.photos.max')[i]! : no)) },
    { label: t('pricing.compare.cards'), values: maps.map((f, i) => (f.get('cards.included')?.enabled ? limit('cards.included')[i]! : no)) },
    { label: t('pricing.compare.rsvp'), values: flag('rsvp.enabled', true) },
    { label: t('pricing.compare.whatsapp'), values: limit('messaging.whatsapp.max') },
    { label: t('pricing.compare.videos'), values: limit('video.renders.max') },
    { label: t('pricing.compare.customLink'), values: flag('link.custom') },
    { label: t('pricing.compare.music'), values: flag('music.enabled') },
    { label: t('pricing.compare.doneForYou'), values: flag('service.doneForYou') },
    { label: t('pricing.compare.support'), values: maps.map((f) => (f.get('support.priority')?.enabled ? t('pricing.compare.priority') : t('pricing.compare.standardSupport'))) },
  ];
}

/** The design tier a plan unlocks (templates.maxTier): 0 free, 1 standard, 2 premium. */
export const planTier = (plan: PlanFeatures): number => plan.features.find((f) => f.featureKey === 'templates.maxTier')?.limit ?? 0;

/** What an add-on adds, in words, from its rows (a limit adds to the plan's). */
export function addOnLine(addOn: PlanFeatures, t: Translator): string | null {
  const row = addOn.features[0];
  if (!row) return null;
  switch (row.featureKey) {
    case 'video.renders.max':
      return t('addon.adds.video');
    case 'branding.watermark':
      return t('addon.adds.noMark');
    case 'functions.max':
      return t('addon.adds.functions', { n: row.limit ?? 1 });
    case 'events.max':
      return t('addon.adds.events', { n: row.limit ?? 1 });
    case 'media.photos.max':
      return t('addon.adds.photos', { n: count(row.limit ?? 0) });
    default:
      return null;
  }
}
