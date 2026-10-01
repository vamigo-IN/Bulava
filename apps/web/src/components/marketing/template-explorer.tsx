import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrackedLink } from './tracked-link';

export interface ExplorerItem {
  key: string;
  tier: 'FREE' | 'STANDARD' | 'PREMIUM';
  tags: string[];
  eventTypes: string[];
  outputs: string[];
  node: ReactNode;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface ExplorerFilters {
  tag?: string;
  tier?: string;
  event?: string;
  format?: string;
}

type FilterKey = keyof ExplorerFilters;

/** Keeps only the templates matching every chosen filter. */
export function filterItems<T extends Omit<ExplorerItem, 'node'>>(items: T[], f: ExplorerFilters): T[] {
  return items.filter(
    (i) =>
      (!f.tag || i.tags.includes(f.tag)) &&
      (!f.tier || i.tier === f.tier) &&
      (!f.event || i.eventTypes.length === 0 || i.eventTypes.includes(f.event)) &&
      (!f.format || i.outputs.includes(f.format)),
  );
}

function hrefFor(basePath: string, current: ExplorerFilters, key: FilterKey, value: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, [key]: value })) if (v) next.set(k, v);
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function Chips({ label, options, filter, current, basePath }: { label: string; options: FilterOption[]; filter: FilterKey; current: ExplorerFilters; basePath: string }) {
  const value = current[filter] ?? '';
  return (
    <nav aria-label={label} className="flex flex-wrap justify-center gap-2">
      {options.map((o) => (
        <TrackedLink
          key={o.value}
          href={hrefFor(basePath, current, filter, o.value)}
          scroll={false}
          event="template_filter"
          properties={{ kind: filter, value: o.value }}
          aria-current={value === o.value ? 'true' : undefined}
          className={cn(
            'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-[color,background-color,border-color,box-shadow,translate] duration-300',
            value === o.value
              ? 'border-transparent bg-night-900 text-ivory shadow-[0_8px_20px_-10px_rgba(19,7,11,0.7)]'
              : 'border-gold-200 bg-white/80 text-stone-700 hover:-translate-y-0.5 hover:border-gold-300 hover:text-ink hover:shadow-soft',
          )}
        >
          {o.label}
        </TrackedLink>
      ))}
    </nav>
  );
}

/**
 * Template gallery with filters. Filtering happens on the server from the URL
 * (chips are links), so a page only renders and ships the cards it shows.
 * Each card is a live preview, which makes shipping every card expensive.
 */
export function TemplateExplorer({
  items,
  traditions,
  tiers,
  occasions,
  formats,
  current = {},
  basePath = '/templates',
  limit,
  phoneLimit,
  moreHref,
  moreLabel,
  moreKeepsScroll = false,
  emptyLabel,
}: {
  /** Already filtered by the caller (see `filterItems`). */
  items: ExplorerItem[];
  traditions: FilterOption[];
  tiers: FilterOption[];
  occasions?: FilterOption[];
  formats?: FilterOption[];
  current?: ExplorerFilters;
  /** Where chip links point: the gallery itself, or /templates from the homepage. */
  basePath?: string;
  limit?: number;
  /** On one-column phones, show only this many (the homepage keeps its teaser short). */
  phoneLimit?: number;
  moreHref?: string;
  moreLabel?: string;
  /** "Show more" on the gallery keeps the reader's place; links elsewhere start at the top. */
  moreKeepsScroll?: boolean;
  emptyLabel: string;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div>
      <div className="space-y-3">
        {occasions ? <Chips label="Occasion" options={occasions} filter="event" current={current} basePath={basePath} /> : null}
        <Chips label="Tradition" options={traditions} filter="tag" current={current} basePath={basePath} />
        <div className="flex flex-wrap justify-center gap-3">
          <Chips label="Plan" options={tiers} filter="tier" current={current} basePath={basePath} />
          {formats ? <Chips label="Format" options={formats} filter="format" current={current} basePath={basePath} /> : null}
        </div>
      </div>
      {shown.length ? (
        <ul className="mt-14 grid grid-cols-1 gap-x-6 gap-y-16 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((i, n) => (
            <li key={i.key} className={cn(phoneLimit !== undefined && n >= phoneLimit && 'max-[519px]:hidden')}>
              {i.node}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-12 rounded-3xl border border-dashed border-gold-300 bg-white/60 px-6 py-14 text-center text-stone-600">{emptyLabel}</p>
      )}
      {moreHref && limit && items.length > Math.min(limit, phoneLimit ?? limit) ? (
        <div className="mt-14 text-center">
          <Link
            href={moreHref}
            scroll={!moreKeepsScroll}
            className="group/more inline-flex min-h-12 items-center gap-2 rounded-full bg-night-900 px-7 font-semibold text-ivory shadow-[0_14px_30px_-14px_rgba(19,7,11,0.8)] transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-brand-700"
          >
            {moreLabel}
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/more:translate-x-1" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
