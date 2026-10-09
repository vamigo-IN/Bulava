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
  /** The occasion as the catalog names it (Wedding, Haldi…), for galleries that filter by it. */
  category?: string;
  /** Lower-case text a search matches (name, occasion, style and tags). */
  search?: string;
  /** The design's look: items sharing one are one design for different occasions, shown once (lib/template-looks). */
  look?: string | null;
  node: ReactNode;
}

export interface FilterOption {
  value: string;
  label: string;
}

/** Filters a gallery offers as groups of links. */
export type FilterKey = 'tag' | 'tier' | 'event' | 'format' | 'category' | 'style';

/** The gallery's state in its URL: the chosen filters, a search and an order. */
export type ExplorerFilters = Partial<Record<FilterKey | 'q' | 'sort', string>>;

/** Keeps only the templates matching every chosen filter (and the search). */
export function filterItems<T extends Omit<ExplorerItem, 'node'>>(items: T[], f: ExplorerFilters): T[] {
  const q = f.q?.trim().toLowerCase();
  return items.filter(
    (i) =>
      (!f.tag || i.tags.includes(f.tag)) &&
      (!f.style || i.tags.includes(f.style)) &&
      (!f.tier || i.tier === f.tier) &&
      (!f.event || i.eventTypes.length === 0 || i.eventTypes.includes(f.event)) &&
      (!f.category || i.category === f.category) &&
      (!f.format || i.outputs.includes(f.format)) &&
      (!q || (i.search ?? '').includes(q)),
  );
}

/** A gallery link with one filter changed (an empty value removes it). */
export function hrefFor(basePath: string, current: ExplorerFilters, key: keyof ExplorerFilters, value: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, [key]: value })) if (v) next.set(k, v);
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function Chips({ label, options, filter, current, basePath }: { label: string; options: FilterOption[]; filter: FilterKey; current: ExplorerFilters; basePath: string }) {
  const value = current[filter] ?? '';
  return (
    // On phones each group is one row that scrolls sideways (room below for the chips' shadows);
    // wider screens wrap and centre it.
    <nav aria-label={label} data-lenis-prevent className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:p-0">
      {options.map((o) => (
        <TrackedLink
          key={o.value}
          href={hrefFor(basePath, current, filter, o.value)}
          scroll={false}
          event="template_filter"
          properties={{ kind: filter, value: o.value }}
          aria-current={value === o.value ? 'true' : undefined}
          className={cn('btn-3d min-h-10 shrink-0 rounded-full px-4 text-sm font-medium', value === o.value ? null : 'btn-3d-light')}
        >
          {o.label}
        </TrackedLink>
      ))}
    </nav>
  );
}

/**
 * Template gallery with filters. Filtering happens on the server from the URL
 * (chips are links), so a page only renders and ships the cards it shows. The
 * grid fits as many 280px card columns as there is room for.
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
      <div className="space-y-1 sm:space-y-3">
        {occasions ? <Chips label="Occasion" options={occasions} filter="event" current={current} basePath={basePath} /> : null}
        <Chips label="Tradition" options={traditions} filter="tag" current={current} basePath={basePath} />
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
          <Chips label="Plan" options={tiers} filter="tier" current={current} basePath={basePath} />
          {formats ? <Chips label="Format" options={formats} filter="format" current={current} basePath={basePath} /> : null}
        </div>
      </div>
      {shown.length ? (
        <ul className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-6">
          {shown.map((i, n) => (
            // One card per row below the `sm` width: the homepage teaser stays short there.
            <li key={i.key} className={cn(phoneLimit !== undefined && n >= phoneLimit && 'max-sm:hidden')}>
              {i.node}
            </li>
          ))}
        </ul>
      ) : (
        <p className="clay-inset mt-12 rounded-3xl px-6 py-14 text-center text-stone-600">{emptyLabel}</p>
      )}
      {moreHref && limit && items.length > Math.min(limit, phoneLimit ?? limit) ? (
        <div className="mt-14 text-center">
          <Link href={moreHref} scroll={!moreKeepsScroll} className="btn-3d group/more min-h-13 rounded-2xl px-7">
            {moreLabel}
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/more:translate-x-1" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
