'use client';

import { CalendarPlus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { MessageKey } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { useT } from '@/lib/i18n';
import { useEvents, useEventTypes } from '@/lib/queries';
import type { EventSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { EventCard } from '@/components/dashboard/event-card';
import { Spinner } from '@/components/ui/primitives';

const FILTERS: Array<{ key: 'all' | 'draft' | 'live' | 'past'; label: MessageKey; match: (e: EventSummary) => boolean }> = [
  { key: 'all', label: 'events.filter.all', match: () => true },
  { key: 'draft', label: 'events.filter.draft', match: (e) => e.status === 'DRAFT' },
  { key: 'live', label: 'events.filter.live', match: (e) => e.status === 'ACTIVE' },
  { key: 'past', label: 'events.filter.past', match: (e) => e.status === 'COMPLETED' || e.status === 'ARCHIVED' || e.status === 'CANCELLED' },
];

/** Every event the host owns or helps with, filtered by where it stands. */
export default function EventsPage() {
  const t = useT();
  const events = useEvents();
  const types = useEventTypes();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const typeName = useMemo(() => new Map((types.data ?? []).map((x) => [x.key, x.name])), [types.data]);

  if (events.isPending) return <Spinner label={t('common.loading')} />;
  const list = [...(events.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const current = FILTERS.find((f) => f.key === filter)!;
  const shown = list.filter(current.match);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{t('dash.nav.events')}</h1>
          <p className="mt-1 text-stone-600">{t('events.subtitle')}</p>
        </div>
        <Link href="/dashboard/events/new" className="btn-3d min-h-12 rounded-2xl px-6 text-sm">
          <Plus aria-hidden className="size-4" />
          {t('dashboard.createEvent')}
        </Link>
      </div>

      {list.length ? (
        <>
          <div className="clay-inset flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl p-1 [scrollbar-width:none]" role="group" aria-label={t('events.filter.label')}>
            {FILTERS.map((f) => {
              const count = list.filter(f.match).length;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-200',
                    filter === f.key ? 'bg-white text-ink shadow-clay-sm' : 'text-stone-600 hover:text-ink',
                  )}
                >
                  {t(f.label)}
                  <span className={cn('rounded-full px-1.5 text-xs', filter === f.key ? 'bg-brand-50 text-brand-700' : 'bg-white/60 text-stone-500')}>{count}</span>
                </button>
              );
            })}
          </div>

          {shown.length ? (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} typeName={typeName.get(event.typeKey)} />
                </li>
              ))}
              {filter === 'all' || filter === 'draft' ? (
                <li>
                  <Link
                    href="/dashboard/events/new"
                    className="group flex h-full min-h-72 flex-col items-center justify-center gap-3 rounded-[1.75rem] border-2 border-dashed border-gold-300 bg-white/40 p-6 text-center transition-[border-color,background-color] duration-300 hover:border-gold-500 hover:bg-white"
                  >
                    <span className="icon-3d size-14 rounded-2xl transition-transform duration-500 group-hover:scale-110">
                      <Plus aria-hidden className="size-6" />
                    </span>
                    <span className="font-display text-xl text-ink">{t('dashboard.createEvent')}</span>
                    <span className="text-sm text-stone-500">{t('dash.home.newHint')}</span>
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="clay-inset rounded-3xl px-6 py-12 text-center text-stone-600">{t('events.filter.none')}</p>
          )}
        </>
      ) : (
        <section className="clay relative isolate overflow-hidden rounded-[2rem] px-6 py-16 text-center">
          <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[520px] -translate-x-1/2 -translate-y-1/2 text-gold-300 opacity-[0.14]" />
          <span className="icon-3d mx-auto size-14 rounded-2xl">
            <CalendarPlus aria-hidden className="size-6" />
          </span>
          <p className="mx-auto mt-5 max-w-md font-display text-3xl leading-tight">{t('dashboard.empty')}</p>
          <p className="mt-2 text-stone-500">{t('dash.home.newHint')}</p>
          <Link href="/dashboard/events/new" className="btn-3d mt-8 min-h-12 rounded-2xl px-6 text-sm">
            <Plus aria-hidden className="size-4" />
            {t('dashboard.createEvent')}
          </Link>
        </section>
      )}
    </div>
  );
}
