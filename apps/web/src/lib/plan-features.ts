import type { Translator } from '@bulava/localization';

/** A plan's admin-managed feature rows, as GET /meta/plans lists them. */
interface PlanFeatures {
  features: Array<{ featureKey: string; enabled: boolean; limit: number | null }>;
}

/** Human-readable feature lines from admin-managed PlanFeature rows (nothing hard-coded): the pricing cards and the checkout. */
export function planFeatureLines(plan: PlanFeatures, t: Translator): string[] {
  const f = new Map(plan.features.map((x) => [x.featureKey, x]));
  const lines: string[] = [];
  const ev = f.get('events.max');
  if (ev?.enabled && ev.limit !== null) lines.push(ev.limit > 1 ? t('plan.feature.events.max.many', { limit: ev.limit }) : t('plan.feature.events.max', { limit: ev.limit }));
  const tier = f.get('templates.maxTier');
  if (tier?.enabled) lines.push(t(`plan.feature.templates.${Math.min(2, tier.limit ?? 2) as 0 | 1 | 2}`));
  const fn = f.get('functions.max');
  if (fn?.enabled) lines.push(fn.limit === null ? t('plan.feature.functions.unlimited') : t('plan.feature.functions.max', { limit: fn.limit }));
  const guests = f.get('guests.max');
  if (guests?.enabled) lines.push(guests.limit === null ? t('plan.feature.guests.unlimited') : t('plan.feature.guests.max', { limit: guests.limit.toLocaleString('en-IN') }));
  lines.push(t('plan.feature.rsvp'), t('plan.feature.whatsapp'));
  const photos = f.get('media.photos.max');
  if (photos?.enabled && photos.limit !== null) lines.push(t('plan.feature.photos', { limit: photos.limit.toLocaleString('en-IN') }));
  const video = f.get('video.renders.max');
  if (video?.enabled && video.limit !== null) lines.push(t('plan.feature.video', { limit: video.limit }));
  if (f.get('video.hd')?.enabled) lines.push(t('plan.feature.videoHd'));
  const wa = f.get('messaging.whatsapp.max');
  if (wa?.enabled) lines.push(wa.limit === null ? t('plan.feature.whatsappMessages.unlimited') : t('plan.feature.whatsappMessages', { limit: wa.limit.toLocaleString('en-IN') }));
  const wm = f.get('branding.watermark');
  if (wm) lines.push(wm.enabled ? t('plan.feature.watermark') : t('plan.feature.noWatermark'));
  if (f.get('planner.workspace')?.enabled) lines.push(t('plan.feature.planner'));
  return lines;
}

/** The design tier a plan unlocks (templates.maxTier): 0 free, 1 standard, 2 premium. */
export const planTier = (plan: PlanFeatures): number => plan.features.find((f) => f.featureKey === 'templates.maxTier')?.limit ?? 0;
