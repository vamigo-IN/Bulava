'use client';

import { ArrowUpRight, CalendarDays, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { formatEventDate } from '@bulava/localization';
import { useT } from '@/lib/i18n';
import { occasionIcon } from '@/lib/occasions';
import { progressOf, setupSteps, summaryFacts } from '@/lib/setup-steps';
import { cardPreview } from '@/lib/template-previews';
import type { EventSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_DOT: Record<EventSummary['status'], string> = {
  DRAFT: 'bg-amber-400',
  ACTIVE: 'bg-emerald-500',
  COMPLETED: 'bg-sky-500',
  ARCHIVED: 'bg-stone-400',
  CANCELLED: 'bg-red-500',
};

/** Days from today to an event's first day (0 = today), or null when it has passed or has no date. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const start = new Date(iso);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

/**
 * An event's chosen design as a cover: the preview softly blurred behind, and
 * the invitation itself as a small phone rising from the bottom edge (a plain
 * crop of a tall preview would show only its top). The occasion's icon until a
 * design is chosen.
 */
export function DesignCover({ templateKey, typeKey, className }: { templateKey: string | null; typeKey: string; className?: string }) {
  const src = templateKey ? cardPreview(templateKey) : null;
  const Icon = occasionIcon(typeKey);
  return (
    <div className={cn('relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-night-900', className)}>
      {src ? (
        <>
          <img src={src} alt="" aria-hidden loading="lazy" decoding="async" className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-2xl" />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-night-900/30" />
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute top-[14%] left-1/2 h-[120%] -translate-x-1/2 rounded-[1.1rem] object-cover object-top shadow-[0_18px_40px_-12px_rgba(28,10,12,0.55)] ring-[5px] ring-white/80 transition-transform duration-700 group-hover:-translate-y-1.5"
            style={{ aspectRatio: '390 / 780' }}
          />
        </>
      ) : (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <span className="grid size-20 place-items-center rounded-[1.6rem] bg-white/10 text-gold-200 ring-1 ring-white/15 backdrop-blur-sm">
            <Icon className="size-9" strokeWidth={1.5} />
          </span>
        </span>
      )}
    </div>
  );
}

/** An event in a grid: its design as the cover, status, date, and how far the setup has come. */
export function EventCard({ event, typeName }: { event: EventSummary; typeName?: string }) {
  const t = useT();
  const Icon = occasionIcon(event.typeKey);
  const { done, total } = progressOf(setupSteps(summaryFacts(event)));
  const days = daysUntil(event.startDate);
  return (
    <Link href={`/dashboard/events/${event.id}`} className="clay clay-lift group flex h-full flex-col overflow-hidden rounded-[1.75rem]">
      <div className="relative h-44">
        <DesignCover templateKey={event.design?.templateKey ?? null} typeKey={event.typeKey} className="absolute inset-0" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm backdrop-blur">
          <span aria-hidden className={cn('size-1.5 rounded-full', STATUS_DOT[event.status])} />
          {t(`event.status.${event.status}`)}
        </span>
        {days !== null ? (
          <span className="absolute right-3 bottom-3 rounded-full bg-night-900/75 px-2.5 py-1 text-xs font-semibold text-gold-100 backdrop-blur">
            {days === 0 ? t('home.today') : days === 1 ? t('home.tomorrow') : t('home.inDays', { count: days })}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">
          <Icon aria-hidden className="size-3.5" />
          {typeName ?? event.typeKey.replace(/_/g, ' ')}
        </p>
        <h3 className="mt-2 font-display text-[1.55rem] leading-tight text-ink transition-colors duration-300 group-hover:text-brand-700">{event.title}</h3>
        <p className="mt-1.5 flex items-center gap-2 text-sm text-stone-600">
          <CalendarDays aria-hidden className="size-4 text-gold-600" />
          {event.startDate ? formatEventDate(event.startDate, { language: 'en', timeZone: event.timezone }) : t('dash.event.noDate')}
        </p>
        <div className="mt-auto pt-5">
          {event.status === 'DRAFT' ? (
            <div>
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>{t('home.setup', { done, total })}</span>
                <span className="font-semibold text-brand-700">{Math.round((done / total) * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gold-100">
                <div className="h-full rounded-full bg-gradient-to-r from-gold-300 to-brand-700" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-5 border-t border-gold-100 pt-4 text-sm text-stone-500">
              <span className="flex items-center gap-1.5">
                <CalendarDays aria-hidden className="size-4 text-stone-400" />
                <span className="font-display text-lg text-brand-700">{event.counts.functions}</span> {t('function.title').toLowerCase()}
              </span>
              <span className="flex items-center gap-1.5">
                <UsersRound aria-hidden className="size-4 text-stone-400" />
                <span className="font-display text-lg text-brand-700">{event.counts.guests}</span> {t('guest.title').toLowerCase()}
              </span>
              <ArrowUpRight aria-hidden className="ml-auto size-5 text-stone-400 transition-[translate,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-700" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
