import { Plus } from 'lucide-react';
import type { Translator } from '@bulava/localization';
import { addOnLine, planCompareRows } from '@/lib/plan-features';
import { formatInr, type Plan } from '@/lib/server-api';
import { cn } from '@/lib/utils';

/** Every plan side by side (ADR-062): what the cards leave out, such as published celebrations, videos and WhatsApp messages. */
export function PlanCompare({ plans, t }: { plans: Plan[]; t: Translator }) {
  const paid = plans.filter((p) => p.priceMinor > 0 && p.interval === 'ONE_TIME');
  if (!paid.length) return null;
  const rows = planCompareRows(paid, t);
  return (
    <div className="clay overflow-x-auto rounded-[2rem] [scrollbar-width:thin]">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">{t('pricing.compare.title')}</caption>
        <thead>
          <tr className="border-b border-gold-200/70">
            <th scope="col" className="sticky left-0 bg-surface/95 px-5 py-4 text-left font-semibold text-stone-600">
              {t('pricing.compare.feature')}
            </th>
            {paid.map((p) => (
              <th key={p.key} scope="col" className={cn('px-4 py-4 text-center', p.badge && 'bg-brand-50/60')}>
                <span className="block font-display text-xl text-ink">{p.name}</span>
                <span className="block text-xs font-normal text-stone-500">{formatInr(p.priceMinor)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-gold-100/70 last:border-0">
              <th scope="row" className="sticky left-0 bg-surface/95 px-5 py-3 text-left font-medium text-stone-700">
                {row.label}
              </th>
              {row.values.map((v, i) => (
                <td key={paid[i]!.key} className={cn('px-4 py-3 text-center', paid[i]!.badge && 'bg-brand-50/60', v === t('pricing.compare.no') ? 'text-stone-400' : 'text-ink')}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Add-ons: one thing more for a plan, paid once, and the plans each goes with. */
export function AddOnCards({ addOns, plans, t }: { addOns: Plan[]; plans: Plan[]; t: Translator }) {
  if (!addOns.length) return null;
  const nameOf = new Map(plans.map((p) => [p.key, p.name]));
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {addOns.map((a) => {
        const offered = (a.offeredTo ?? []).flatMap((k) => (nameOf.has(k) ? [nameOf.get(k)!] : []));
        const line = addOnLine(a, t);
        return (
          <li key={a.key} className="clay flex flex-col rounded-[1.5rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-xl leading-snug text-ink">{a.name}</h3>
              <span aria-hidden className="icon-3d grid size-9 shrink-0 place-items-center rounded-xl">
                <Plus className="size-4" />
              </span>
            </div>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-stone-600">{line ?? a.description}</p>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-2xl text-ink">+{formatInr(a.priceMinor)}</span>
              {a.stackable ? <span className="text-xs text-stone-500">{t('pricing.addons.each')}</span> : null}
            </p>
            <p className="mt-1 text-xs text-stone-500">{offered.length ? t('pricing.addons.with', { plans: offered.join(', ') }) : t('pricing.addons.withAll')}</p>
          </li>
        );
      })}
    </ul>
  );
}
