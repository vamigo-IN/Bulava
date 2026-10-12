import { ArrowRight, Check, FileText, Link2, Minus, Video } from 'lucide-react';
import { SpotlightGrid } from '@/components/effects/spotlight-grid';
import { AuthAwareLink } from './account-links';
import type { Translator } from '@bulava/localization';
import { planFeatureLines, planFormats } from '@/lib/plan-features';
import type { Plan } from '@/lib/server-api';
import { OfferPrice } from '@/components/ui/offer-price';
import { cn } from '@/lib/utils';

/** Clay slabs for the plan cards: the ribboned plan in maroon, the others dark on the pricing band. */
const MAROON_SLAB =
  'bg-[linear-gradient(165deg,#a33441,#7a1d27_50%,#4a0b16)] text-ivory shadow-[inset_0_3px_2px_rgba(255,255,255,0.2),inset_4px_0_3px_rgba(255,255,255,0.08),inset_0_-6px_10px_rgba(30,2,8,0.45),inset_-4px_0_8px_rgba(30,2,8,0.3),8px_26px_50px_-16px_rgba(30,4,10,0.55)] ring-1 ring-gold-300/40';
const DARK_SLAB =
  'bg-[linear-gradient(165deg,#26111b,#160910)] text-ivory shadow-[inset_0_2px_1px_rgba(255,255,255,0.08),inset_3px_0_3px_rgba(255,255,255,0.03),inset_0_-4px_6px_rgba(0,0,0,0.4),8px_26px_50px_-18px_rgba(0,0,0,0.7)]';

/**
 * Plan cards (ADR-062): one-time tiers, each led by what it shares (the live
 * link, the PDF, the MP4 video), its price "pay once", and the lines of a
 * celebration. The plan with a ribbon (the console's choice) is a maroon slab
 * with a gold 3D button; a soft light follows the pointer across the row.
 * `headingLevel` follows the page outline: 2 directly under a page's h1, 3
 * inside a section.
 */
export function PricingCards({ plans, t, dark = false, headingLevel = 3 }: { plans: Plan[]; t: Translator; dark?: boolean; headingLevel?: 2 | 3 }) {
  const paid = plans.filter((p) => p.priceMinor > 0 && p.interval === 'ONE_TIME');
  if (!paid.length) return null;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <SpotlightGrid className={cn('grid gap-5 sm:grid-cols-2', paid.length >= 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'xl:grid-cols-4')}>
      {paid.map((plan) => {
        const popular = Boolean(plan.badge);
        const onDark = popular || dark;
        const formats = planFormats(plan);
        const format = (on: boolean, Icon: typeof Link2, label: string) => (
          <li className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-semibold', on ? (onDark ? 'bg-gold-300/15 text-gold-100' : 'bg-gold-100 text-gold-800') : onDark ? 'text-ivory/40 line-through' : 'text-stone-400 line-through')}>
            {on ? <Icon aria-hidden className="size-3" /> : <Minus aria-hidden className="size-3" />}
            <span className="sr-only">{on ? '' : `${t('pricing.compare.no')}: `}</span>
            {label}
          </li>
        );
        return (
          <div key={plan.key} className={cn('relative rounded-[1.75rem] transition-[translate] duration-500 hover:-translate-y-1', popular && 'xl:-translate-y-3 xl:hover:-translate-y-4')}>
            {plan.badge ? (
              <span className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-b from-gold-100 to-gold-300 px-4 py-1 text-xs font-semibold tracking-wide whitespace-nowrap text-night-900 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_8px_18px_-8px_rgba(120,80,16,0.8)]">
                {plan.badge}
              </span>
            ) : null}
            <div className={cn('spotlight flex h-full flex-col rounded-[1.75rem] p-6', popular ? MAROON_SLAB : dark ? DARK_SLAB : 'clay text-ink')}>
              <Heading className="font-display text-2xl">{plan.name}</Heading>
              {plan.tagline ? <p className={cn('mt-1 text-sm font-semibold', onDark ? 'text-gold-200' : 'text-brand-700')}>{plan.tagline}</p> : null}
              <OfferPrice className="mt-4" priceMinor={plan.priceMinor} listPriceMinor={plan.listPriceMinor} currency={plan.currency} t={t} onDark={onDark} />
              <p className={cn('mt-0.5 text-sm', onDark ? 'text-ivory/70' : 'text-stone-500')}>{t('home.pricing.oneTime')}</p>
              <ul className="mt-4 flex flex-wrap gap-1" aria-label={t('pricing.compare.feature')}>
                {format(formats.link, Link2, t('plan.format.link'))}
                {format(formats.pdf, FileText, t('plan.format.pdf'))}
                {format(formats.video, Video, t('plan.format.video'))}
              </ul>
              <div className={cn('my-5 h-px', onDark ? 'bg-white/10' : 'bg-gold-200/80')} />
              <ul className="flex-1 space-y-2.5 text-sm">
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
                // The plan's checkout, through sign-in when needed (which comes back to it).
                signedOutHref={`/login?next=${encodeURIComponent(`/dashboard/checkout?plan=${plan.key}`)}`}
                signedInHref={`/dashboard/checkout?plan=${plan.key}`}
                className={cn('btn-3d group/cta mt-7 min-h-12 w-full rounded-2xl', popular ? 'btn-3d-gold' : 'btn-3d-light')}
              >
                {t('home.pricing.unlock')}
                <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
              </AuthAwareLink>
            </div>
          </div>
        );
      })}
    </SpotlightGrid>
  );
}
