'use client';

import { ArrowRight, ArrowUpRight, CalendarDays, LayoutGrid, Plus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { formatEventDate } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine';
import { useT } from '@/lib/i18n';
import { useEvents, useMe } from '@/lib/queries';
import { Badge, Spinner } from '@/components/ui/primitives';

const GOLD_CTA =
  'group/cta inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-6 font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_14px_30px_-14px_rgba(227,197,133,0.8)] transition-colors duration-300 hover:from-gold-100 hover:to-gold-200';

export default function DashboardPage() {
  const t = useT();
  const me = useMe();
  const events = useEvents();

  return (
    <div className="space-y-10">
      <section className="grain relative isolate overflow-hidden rounded-[2rem] bg-night-900 px-6 py-10 text-ivory shadow-lift sm:px-10 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-48 -right-24 h-[520px] w-[720px] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.75),transparent)]" />
          <div className="absolute -bottom-40 left-10 h-[360px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(184,137,43,0.18),transparent)]" />
        </div>
        <Mandala className="pointer-events-none absolute -top-32 -right-24 -z-10 w-[420px] animate-spin-slow text-gold-300 opacity-[0.12]" />
        <p className="eyebrow bg-white/5 text-gold-200 ring-1 ring-white/10">{t('dashboard.title')}</p>
        <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">{t('dash.greeting', { name: me.data?.name?.split(' ')[0] ?? '' })}</h1>
        <p className="mt-3 max-w-xl text-ivory/70">{t('dash.home.subtitle')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard/events/new" className={GOLD_CTA}>
            <Plus aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:rotate-90" />
            {t('dashboard.createEvent')}
          </Link>
          <Link href="/templates" className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-medium text-ivory ring-1 ring-white/20 transition-[background-color,box-shadow] duration-300 hover:bg-white/5 hover:ring-gold-300/40">
            <LayoutGrid aria-hidden className="size-4" />
            {t('home.hero.browse')}
          </Link>
        </div>
      </section>

      {events.isPending ? (
        <Spinner label={t('common.loading')} />
      ) : events.data?.length ? (
        <section aria-labelledby="events-title">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="events-title" className="font-display text-3xl tracking-tight">
              {t('dash.home.events')}
            </h2>
            <span className="text-sm text-stone-500">{events.data.length}</span>
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {events.data.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-gold-200/80 bg-white p-6 shadow-soft transition-[translate,box-shadow,border-color] duration-500 hover:-translate-y-1 hover:border-gold-300 hover:shadow-lift"
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-gold-300 via-gold-500 to-brand-700 transition-transform duration-500 group-hover:scale-x-100" />
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-gold-600 uppercase">{event.typeKey.replace(/_/g, ' ')}</p>
                    <Badge tone={event.status === 'ACTIVE' ? 'success' : 'neutral'}>{t(`event.status.${event.status}`)}</Badge>
                  </div>
                  <h3 className="mt-3 font-display text-[1.7rem] leading-tight text-ink transition-colors duration-300 group-hover:text-brand-700">{event.title}</h3>
                  <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                    <CalendarDays aria-hidden className="size-4 text-gold-600" />
                    {event.startDate ? formatEventDate(event.startDate, { language: 'en', timeZone: event.timezone }) : t('dash.event.noDate')}
                  </p>
                  <div className="mt-auto flex items-center gap-5 border-t border-gold-100 pt-4 text-sm">
                    <span className="flex items-center gap-1.5 text-stone-500">
                      <CalendarDays aria-hidden className="size-4 text-stone-400" />
                      <span className="font-display text-xl text-brand-700">{event.counts.functions}</span> {t('function.title').toLowerCase()}
                    </span>
                    <span className="flex items-center gap-1.5 text-stone-500">
                      <UsersRound aria-hidden className="size-4 text-stone-400" />
                      <span className="font-display text-xl text-brand-700">{event.counts.guests}</span> {t('guest.title').toLowerCase()}
                    </span>
                    <ArrowUpRight aria-hidden className="ml-auto size-5 text-stone-400 transition-[translate,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-700" />
                  </div>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/dashboard/events/new"
                className="group flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-gold-300 bg-white/40 p-6 text-center transition-[border-color,background-color] duration-300 hover:border-gold-500 hover:bg-white"
              >
                <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-gold-200 shadow-[0_12px_24px_-12px_rgba(91,14,27,0.8)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-90">
                  <Plus aria-hidden className="size-6" />
                </span>
                <span className="font-display text-xl text-ink">{t('dashboard.createEvent')}</span>
                <span className="text-sm text-stone-500">{t('dash.home.newHint')}</span>
              </Link>
            </li>
          </ul>
        </section>
      ) : (
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-gold-200/80 bg-white px-6 py-16 text-center shadow-soft">
          <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[520px] -translate-x-1/2 -translate-y-1/2 text-gold-300 opacity-[0.12]" />
          <p className="mx-auto max-w-md font-display text-3xl leading-tight">{t('dashboard.empty')}</p>
          <p className="mt-2 text-stone-500">{t('dash.home.newHint')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/events/new"
              className="group/cta inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-700 px-6 font-semibold text-ivory shadow-[0_10px_24px_-12px_rgba(91,14,27,0.8)] transition-colors duration-300 hover:bg-brand-800"
            >
              <Plus aria-hidden className="size-4" />
              {t('dashboard.createEvent')}
            </Link>
            <Link href="/templates" className="group/more inline-flex min-h-12 items-center gap-2 rounded-full border border-gold-300 px-6 font-medium text-brand-700 transition-colors duration-300 hover:bg-gold-100/60">
              {t('home.hero.browse')}
              <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/more:translate-x-0.5" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
