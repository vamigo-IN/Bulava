import type { Translator } from '@bulava/localization';
import { cn } from '@/lib/utils';

const inr = (minor: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);

/** How much an offer takes off, in whole percent (0 when there is no offer). */
export function percentOff(priceMinor: number, listPriceMinor: number | null | undefined): number {
  if (!listPriceMinor || listPriceMinor <= priceMinor) return 0;
  return Math.round((1 - priceMinor / listPriceMinor) * 100);
}

/**
 * A plan's price as an offer (ADR-067): the usual price struck through, the
 * price, and what is saved ("50% off"); just the price when there is no offer.
 * The struck price is read out as "Usual price ₹599", the saving as text.
 * Plain markup: server and client components may use it.
 */
export function OfferPrice({
  priceMinor,
  listPriceMinor,
  currency = 'INR',
  t,
  size = 'lg',
  onDark = false,
  className,
}: {
  priceMinor: number;
  listPriceMinor?: number | null;
  currency?: string;
  t: Translator;
  size?: 'md' | 'lg';
  onDark?: boolean;
  className?: string;
}) {
  const off = percentOff(priceMinor, listPriceMinor);
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      {off ? (
        <span className={cn('tabular-nums line-through decoration-2', size === 'lg' ? 'text-lg' : 'text-base', onDark ? 'text-ivory/55 decoration-ivory/50' : 'text-stone-400 decoration-stone-400')}>
          <span className="sr-only">{t('pricing.offer.was')} </span>
          {inr(listPriceMinor!, currency)}
        </span>
      ) : null}
      <span className={cn('font-display tracking-tight tabular-nums', size === 'lg' ? 'text-4xl xl:text-[2.6rem]' : 'text-3xl')}>{inr(priceMinor, currency)}</span>
      {off ? (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tracking-wide whitespace-nowrap', onDark ? 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/40' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200')}>
          {t('pricing.offer.off', { percent: off })}
        </span>
      ) : null}
    </p>
  );
}
