import { ArrowRight, Check } from 'lucide-react';
import { SpotlightGrid } from '@/components/effects/spotlight-grid';
import { AuthAwareLink } from './account-links';
import type { Translator } from '@bulava/localization';
import { formatInr, type Plan } from '@/lib/server-api';
import { cn } from '@/lib/utils';

/** Human-readable feature lines from admin-managed PlanFeature rows (nothing hard-coded). */
export function planFeatureLines(plan: Plan, t: Translator): string[] {
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

/**
 * Plan cards. The popular plan sits in a gold-edged maroon card; the others are
 * glass on dark sections and white on light ones. A soft light follows the
 * pointer across the row.
 */
export function PricingCards({ plans, t, dark = false }: { plans: Plan[]; t: Translator; dark?: boolean }) {
  if (!plans.length) return null;
  return (
    <SpotlightGrid className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const popular = plan.key === 'PREMIUM';
        const onDark = popular || dark;
        return (
          <div
            key={plan.key}
            className={cn(
              'relative rounded-[1.75rem] p-px transition-[translate,box-shadow] duration-500 hover:-translate-y-1',
              popular ? 'bg-gradient-to-b from-gold-200 via-gold-500/70 to-gold-300/10 shadow-glow xl:-translate-y-3 xl:hover:-translate-y-4' : dark ? 'bg-white/10' : 'bg-gold-200/90 hover:shadow-lift',
            )}
          >
            {popular ? (
              <span className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-b from-gold-100 to-gold-300 px-4 py-1 text-xs font-semibold tracking-wide whitespace-nowrap text-night-900 shadow-[0_8px_20px_-8px_rgba(184,137,43,0.8)]">
                {t('home.pricing.popular')}
              </span>
            ) : null}
            <div
              className={cn(
                'spotlight flex h-full flex-col rounded-[calc(1.75rem-1px)] p-7',
                popular ? 'bg-gradient-to-b from-brand-700 to-brand-900 text-ivory' : dark ? 'bg-night-800 text-ivory' : 'bg-white text-ink',
              )}
            >
              <h3 className="font-display text-2xl">{plan.name}</h3>
              {plan.description ? <p className={cn('mt-2 min-h-12 text-sm leading-relaxed', onDark ? 'text-ivory/75' : 'text-stone-600')}>{plan.description}</p> : null}
              <p className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl tracking-tight">{plan.priceMinor === 0 ? '₹0' : formatInr(plan.priceMinor)}</span>
              </p>
              <p className={cn('mt-1 text-sm', onDark ? 'text-ivory/70' : 'text-stone-500')}>
                {plan.priceMinor === 0 ? t('home.pricing.free') : plan.interval === 'YEAR' ? t('home.pricing.yearly') : t('home.pricing.oneTime')}
              </p>
              <div className={cn('my-6 h-px', onDark ? 'bg-white/10' : 'bg-gold-200/80')} />
              <ul className="flex-1 space-y-3 text-sm">
                {planFeatureLines(plan, t).map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span aria-hidden className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full', popular ? 'bg-gold-300 text-brand-900' : onDark ? 'bg-gold-300/15 text-gold-200' : 'bg-gold-100 text-gold-700')}>
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className={onDark ? 'text-ivory/85' : 'text-stone-700'}>{line}</span>
                  </li>
                ))}
              </ul>
              <AuthAwareLink
                signedOutHref={plan.priceMinor === 0 ? '/signup' : `/signup?plan=${plan.key}`}
                signedInHref="/dashboard"
                className={cn(
                  'group/cta mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,color,border-color,box-shadow] duration-300',
                  popular
                    ? 'bg-gradient-to-b from-gold-200 to-gold-300 text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:from-gold-100 hover:to-gold-200'
                    : dark
                      ? 'border border-white/20 text-ivory hover:border-transparent hover:bg-ivory hover:text-night-900'
                      : 'border border-night-900/15 text-ink hover:border-transparent hover:bg-night-900 hover:text-ivory',
                )}
              >
                {plan.priceMinor === 0 ? t('home.pricing.start') : t('home.pricing.choose', { plan: plan.name })}
                <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
              </AuthAwareLink>
            </div>
          </div>
        );
      })}
    </SpotlightGrid>
  );
}
