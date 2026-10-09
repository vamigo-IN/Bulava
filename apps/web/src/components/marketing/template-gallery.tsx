import { ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Translator } from '@bulava/localization';
import { forEvent, onePerLook } from '@/lib/template-looks';
import { cn } from '@/lib/utils';
import { filterItems, hrefFor, type ExplorerFilters, type ExplorerItem, type FilterKey, type FilterOption } from './template-explorer';
import { TrackedLink } from './tracked-link';

export interface FilterGroup {
  key: FilterKey;
  label: string;
  /** Without "All": the sidebar adds it. */
  options: FilterOption[];
  /** Options shown before the rest fold away (long lists). */
  visible?: number;
}

/** What the gallery shows for some filters: the matching templates, each design once. */
type View = (f: ExplorerFilters) => ExplorerItem[];

function GroupLinks({ group, view, current, t, basePath }: { group: FilterGroup; view: View; current: ExplorerFilters; t: Translator; basePath: string }) {
  const value = current[group.key] ?? '';
  // How many designs each choice would show, given the other filters.
  const count = (v: string) => view({ ...current, [group.key]: v }).length;
  const option = (o: FilterOption) => {
    const active = value === o.value;
    const n = count(o.value);
    const body = (
      <>
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className={cn('size-2 shrink-0 rotate-45 rounded-[2px] transition-colors duration-300', active ? 'bg-gradient-to-br from-gold-300 to-gold-600' : 'bg-stone-300 group-hover/opt:bg-gold-300')} />
          {o.label}
        </span>
        <span className={cn('min-w-7 rounded-full px-2 py-0.5 text-center text-xs tabular-nums', active ? 'bg-brand-700 text-ivory' : 'bg-white/80 text-stone-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_1px_2px_rgba(70,40,26,0.12)]')}>{n}</span>
      </>
    );
    const row = 'group/opt flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 py-1.5 text-[0.9375rem] transition-colors duration-300';
    return (
      <li key={o.value || 'all'}>
        {n === 0 && !active ? (
          <span className={cn(row, 'cursor-default text-stone-400')} aria-disabled="true">
            {body}
          </span>
        ) : (
          <TrackedLink
            href={hrefFor(basePath, { ...current }, group.key, o.value)}
            scroll={false}
            event="template_filter"
            properties={{ kind: group.key, value: o.value }}
            aria-current={active ? 'true' : undefined}
            className={cn(row, active ? 'bg-surface font-semibold text-brand-700 shadow-clay-sm' : 'text-stone-700 hover:bg-white/70 hover:text-ink')}
          >
            {body}
          </TrackedLink>
        )}
      </li>
    );
  };
  const all = [{ value: '', label: t('filter.all') }, ...group.options];
  const cut = group.visible ? group.visible + 1 : all.length;
  const shown = all.slice(0, cut);
  const folded = all.slice(cut);
  const activeFolded = folded.some((o) => o.value === value);
  return (
    <div>
      <h2 className="eyebrow px-3 text-brand-700">{group.label}</h2>
      <ul className="mt-2.5 space-y-0.5">{shown.map(option)}</ul>
      {folded.length ? (
        <details className="group/more" open={activeFolded}>
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 px-3 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
            <span className="group-open/more:hidden">{t('gallery.more', { count: folded.length })}</span>
            <span className="hidden group-open/more:inline">{t('gallery.fewer')}</span>
          </summary>
          <ul className="space-y-0.5">{folded.map(option)}</ul>
        </details>
      ) : null}
    </div>
  );
}

function Filters({ groups, view, current, t, basePath }: { groups: FilterGroup[]; view: View; current: ExplorerFilters; t: Translator; basePath: string }) {
  return (
    <div className="space-y-7">
      {groups.map((g) => (
        <GroupLinks key={g.key} group={g} view={view} current={current} t={t} basePath={basePath} />
      ))}
    </div>
  );
}

/** Words a gallery may use instead of the templates gallery's own. */
export interface GalleryLabels {
  showing?: (shown: number, total: number) => string;
  emptyTitle?: string;
  emptyBody?: string;
  more?: (count: number) => string;
}

/**
 * The template gallery: filters in a sticky sidebar (a fold-out panel on phones),
 * the active filters as removable chips, and the cards. Filtering happens on the
 * server from the URL, so every choice is a link and a page ships only its cards.
 * A design made for several occasions shows once (its version for the occasion
 * chosen). The digital card gallery uses it too, with its own path, words and a
 * search bar.
 */
export function TemplateGallery({
  items,
  groups,
  current,
  limit,
  moreHref,
  t,
  basePath = '/templates',
  labels = {},
  toolbar,
  gridClassName = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-6',
}: {
  /** Every template; the gallery filters them. */
  items: ExplorerItem[];
  groups: FilterGroup[];
  current: ExplorerFilters;
  limit: number;
  moreHref: string;
  t: Translator;
  /** Where the filter links point. */
  basePath?: string;
  labels?: GalleryLabels;
  /** Above the results (the card gallery's search and order). */
  toolbar?: ReactNode;
  /** The results grid (cards sit two to a row on phones). */
  gridClassName?: string;
}) {
  const view: View = (f) => onePerLook(filterItems(items, f), (i) => i.look, f.event ? forEvent(f.event) : undefined);
  const matching = view(current);
  const shown = matching.slice(0, limit);
  const active: Array<{ key: keyof ExplorerFilters; label: string }> = groups.flatMap((g) => {
    const value = current[g.key];
    const option = value ? g.options.find((o) => o.value === value) : undefined;
    return option ? [{ key: g.key, label: option.label }] : [];
  });
  if (current.q) active.push({ key: 'q', label: `“${current.q}”` });
  return (
    <div className="lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-10">
      <aside aria-label={t('gallery.filters')} className="hidden lg:block">
        <div className="clay sticky top-24 max-h-[calc(100dvh-7.5rem)] overflow-y-auto rounded-[1.75rem] p-4 [scrollbar-width:thin]" data-lenis-prevent>
          <Filters groups={groups} view={view} current={current} t={t} basePath={basePath} />
        </div>
      </aside>

      <div className="min-w-0">
        {toolbar ? <div className="mb-5">{toolbar}</div> : null}
        {/* Phones and tablets: the same filters, folded into a panel. */}
        <details className="group/filters mb-5 lg:hidden">
          <summary className="btn-3d btn-3d-light min-h-12 w-full cursor-pointer list-none justify-between rounded-2xl px-5 text-base [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2.5">
              <SlidersHorizontal aria-hidden className="size-4 text-brand-700" />
              {t('gallery.filters')}
              {active.length ? <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs text-ivory">{active.length}</span> : null}
            </span>
            <span aria-hidden="true" className="text-xl text-brand-700 transition-transform duration-300 group-open/filters:rotate-45">
              +
            </span>
          </summary>
          <div className="clay mt-3 rounded-[1.5rem] p-4">
            <Filters groups={groups} view={view} current={current} t={t} basePath={basePath} />
          </div>
        </details>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600" aria-live="polite">
            {labels.showing ? labels.showing(shown.length, matching.length) : t('gallery.showing', { shown: shown.length, total: matching.length })}
          </p>
          {active.length ? (
            <ul aria-label={t('gallery.active')} className="flex flex-wrap items-center gap-2">
              {active.map((a) => (
                <li key={a.key}>
                  <Link
                    href={hrefFor(basePath, current, a.key, '')}
                    scroll={false}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface py-1 pr-2.5 pl-3.5 text-sm font-medium text-brand-700 shadow-clay-sm transition-colors hover:text-brand-800"
                    aria-label={t('gallery.remove', { filter: a.label })}
                  >
                    {a.label}
                    <X aria-hidden className="size-3.5" />
                  </Link>
                </li>
              ))}
              <li>
                <Link href={basePath} scroll={false} className="px-2 text-sm font-semibold text-stone-600 underline decoration-gold-300 underline-offset-4 hover:text-brand-700">
                  {t('gallery.clear')}
                </Link>
              </li>
            </ul>
          ) : null}
        </div>

        {shown.length ? (
          <ul className={gridClassName}>
            {shown.map((i) => (
              <li key={i.key}>{i.node}</li>
            ))}
          </ul>
        ) : (
          <div className="clay-inset rounded-3xl px-6 py-14 text-center">
            <p className="font-display text-2xl text-ink">{labels.emptyTitle ?? t('gallery.emptyTitle')}</p>
            <p className="mt-2 text-stone-600">{labels.emptyBody ?? t('gallery.emptyBody')}</p>
            <Link href={basePath} scroll={false} className="btn-3d mt-6 min-h-11 rounded-xl px-5 text-sm">
              {t('gallery.clear')}
            </Link>
          </div>
        )}

        {matching.length > shown.length ? (
          <div className="mt-12 text-center">
            <Link href={moreHref} scroll={false} className="btn-3d group/more min-h-13 rounded-2xl px-7">
              {labels.more ? labels.more(matching.length - shown.length) : t('templates.showMore', { count: matching.length - shown.length })}
              <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/more:translate-x-1" />
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
