'use client';

import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarDays,
  CalendarHeart,
  Camera,
  Clapperboard,
  ClipboardCheck,
  LayoutGrid,
  MailOpen,
  Megaphone,
  Palette,
  PartyPopper,
  Plus,
  Rocket,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { formatEventDateWithWeekday } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { useT } from '@/lib/i18n';
import { occasionIcon } from '@/lib/occasions';
import { useEvents, useEventTypes, useMe, useNotifications, useTemplateList } from '@/lib/queries';
import { nextStep, progressOf } from '@/lib/setup-steps';
import { forEvent, onePerLook } from '@/lib/template-looks';
import { cardPreview } from '@/lib/template-previews';
import type { EventSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CountUp, ProgressRing } from '@/components/dashboard/count-up';
import { daysUntil, DesignCover, EventCard } from '@/components/dashboard/event-card';
import { notificationView, relativeTime } from '@/components/dashboard/notification-text';
import { useSetupSteps } from '@/components/events/use-setup-steps';
import { Spinner } from '@/components/ui/primitives';

const GOLD_CTA =
  'group/cta inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-6 font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_14px_30px_-14px_rgba(227,197,133,0.8)] transition-colors duration-300 hover:from-gold-100 hover:to-gold-200';
const GHOST_CTA = 'inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-medium text-ivory ring-1 ring-white/20 transition-[background-color,box-shadow] duration-300 hover:bg-white/5 hover:ring-gold-300/40';

/** Events still being planned or live, most recently touched first. */
function inProgress(events: EventSummary[]): EventSummary[] {
  return events.filter((e) => e.status === 'DRAFT' || e.status === 'ACTIVE').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The next celebration with a date ahead. */
function nextCelebration(events: EventSummary[]): EventSummary | null {
  return (
    events
      .filter((e) => (e.status === 'DRAFT' || e.status === 'ACTIVE') && daysUntil(e.startDate) !== null)
      .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0] ?? null
  );
}

/**
 * Home: a greeting with the next celebration's countdown, the event to pick up
 * where the host left off (with its next step), their events, numbers across
 * them, recent activity and shortcuts. Before the first event: occasions to
 * start from, how it works, and designs to browse.
 */
export default function HomePage() {
  const t = useT();
  const me = useMe();
  const events = useEvents();
  const types = useEventTypes();
  const typeName = useMemo(() => new Map((types.data ?? []).map((x) => [x.key, x.name])), [types.data]);

  if (events.isPending) return <Spinner label={t('common.loading')} />;
  const list = events.data ?? [];
  const active = inProgress(list);
  const focus = active[0] ?? null;
  const upcoming = nextCelebration(list);
  const firstName = me.data?.name?.split(' ')[0] ?? '';

  return (
    <div className="space-y-8">
      <section className="grain relative isolate overflow-hidden rounded-[2rem] bg-night-900 px-6 py-9 text-ivory shadow-lift sm:px-10 sm:py-11">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-48 -right-24 h-[520px] w-[720px] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.75),transparent)]" />
          <div className="absolute -bottom-40 left-10 h-[360px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(184,137,43,0.18),transparent)]" />
        </div>
        <Mandala className="pointer-events-none absolute -top-32 -right-24 -z-10 w-[420px] animate-spin-slow text-gold-300 opacity-[0.12]" />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow bg-white/5 text-gold-200 ring-1 ring-white/10">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">{t('dash.greeting', { name: firstName })}</h1>
            <p className="mt-3 max-w-xl text-ivory/70">
              {list.length
                ? t('home.summary', { drafts: list.filter((e) => e.status === 'DRAFT').length, live: list.filter((e) => e.status === 'ACTIVE').length })
                : t('home.summaryEmpty')}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/dashboard/events/new" className={GOLD_CTA}>
                <Plus aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:rotate-90" />
                {t('dashboard.createEvent')}
              </Link>
              <Link href="/templates" className={GHOST_CTA}>
                <LayoutGrid aria-hidden className="size-4" />
                {t('home.hero.browse')}
              </Link>
            </div>
          </div>
          {upcoming ? <Countdown event={upcoming} /> : null}
        </div>
      </section>

      {list.length ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-8">
            {focus ? <ContinueCard event={focus} typeName={typeName.get(focus.typeKey)} /> : null}

            <section aria-labelledby="home-events">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="home-events" className="font-display text-3xl tracking-tight">
                  {t('dash.home.events')}
                </h2>
                <Link href="/dashboard/events" className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                  {t('home.allEvents', { count: list.length })}
                  <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {(active.length ? active : list).slice(0, 4).map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} typeName={typeName.get(event.typeKey)} />
                  </li>
                ))}
              </ul>
            </section>

            <ExploreDesigns typeKey={focus?.typeKey} />
          </div>

          <div className="space-y-6">
            <AtAGlance events={list} />
            <Activity />
            {focus ? <Shortcuts event={focus} /> : null}
          </div>
        </div>
      ) : (
        <FirstSteps />
      )}
    </div>
  );
}

function Countdown({ event }: { event: EventSummary }) {
  const t = useT();
  const days = daysUntil(event.startDate) ?? 0;
  const Icon = occasionIcon(event.typeKey);
  return (
    <Link href={`/dashboard/events/${event.id}`} className="group w-full shrink-0 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.09] sm:w-80">
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-gold-200/80 uppercase">
        <Icon aria-hidden className="size-3.5" />
        {t('home.nextCelebration')}
      </p>
      <p className="mt-2 truncate font-display text-2xl leading-tight">{event.title}</p>
      <div className="mt-4 flex items-end gap-3">
        <span className="font-display text-6xl leading-none text-gold-200">{days === 0 ? '0' : <CountUp value={days} />}</span>
        <span className="pb-1.5 text-sm text-ivory/70">{days === 0 ? t('home.today') : days === 1 ? t('home.dayToGo') : t('home.daysToGo')}</span>
      </div>
      {event.startDate ? <p className="mt-3 text-sm text-ivory/70">{formatEventDateWithWeekday(event.startDate, { language: 'en', timeZone: event.timezone })}</p> : null}
    </Link>
  );
}

/** The event most recently worked on: how far its setup has come and the one thing to do next. */
function ContinueCard({ event, typeName }: { event: EventSummary; typeName?: string }) {
  const t = useT();
  const steps = useSetupSteps(event);
  const base = `/dashboard/events/${event.id}`;
  if (!steps) return null;
  const upNext = nextStep(steps);
  const { done, total } = progressOf(steps);
  // Publishing happens in the event's dialog, which opens from ?publish=1.
  const href = upNext ? (upNext.key === 'publish' ? `${base}?publish=1` : `${base}${upNext.section}`) : `${base}/rsvps`;
  return (
    <section aria-labelledby="continue-title" className="clay overflow-hidden rounded-[2rem]">
      <div className="grid sm:grid-cols-[200px_minmax(0,1fr)]">
        <DesignCover templateKey={event.design?.templateKey ?? null} typeKey={event.typeKey} className="h-48 sm:h-auto sm:min-h-full" />
        <div className="p-6 sm:p-7">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">{t('home.continue')}</p>
          <h2 id="continue-title" className="mt-2 font-display text-3xl leading-tight">
            <Link href={base} className="hover:text-brand-700">
              {event.title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {typeName ?? event.typeKey} · {t(`event.status.${event.status}`)}
          </p>
          <div className="mt-5 flex items-center gap-4">
            <div className="relative grid shrink-0 place-items-center">
              <ProgressRing done={done} total={total} size={56} />
              <span className="absolute font-display text-sm">
                {done}/{total}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{upNext ? `${t('next.eyebrow.todo')}: ${t(upNext.title)}` : t('next.done.title')}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-stone-600">{upNext ? t(upNext.body) : t('next.done.body')}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={href} className="btn-3d min-h-11 rounded-2xl px-5 text-sm">
              {upNext ? t(upNext.action) : t('dash.step.rsvps.action')}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href={base} className="btn-3d btn-3d-light min-h-11 rounded-2xl px-5 text-sm">
              {t('home.openEvent')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function AtAGlance({ events }: { events: EventSummary[] }) {
  const t = useT();
  const tiles: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: t('home.stat.events'), value: events.length, icon: CalendarHeart },
    { label: t('home.stat.live'), value: events.filter((e) => e.status === 'ACTIVE').length, icon: Rocket },
    { label: t('home.stat.functions'), value: events.reduce((s, e) => s + e.counts.functions, 0), icon: CalendarDays },
    { label: t('home.stat.guests'), value: events.reduce((s, e) => s + e.counts.guests, 0), icon: UsersRound },
  ];
  return (
    <section aria-labelledby="glance-title" className="clay rounded-[1.75rem] p-5">
      <h2 id="glance-title" className="font-display text-xl">
        {t('home.glance')}
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {tiles.map(({ label, value, icon: Icon }) => (
          <li key={label} className="clay-inset rounded-2xl p-3.5">
            <Icon aria-hidden className="size-4 text-gold-600" />
            <p className="mt-2 font-display text-3xl leading-none text-ink">
              <CountUp value={value} />
            </p>
            <p className="mt-1 text-xs text-stone-500">{label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Activity() {
  const t = useT();
  const list = useNotifications();
  const items = (list.data ?? []).slice(0, 6);
  return (
    <section aria-labelledby="activity-title" className="clay rounded-[1.75rem] p-5">
      <h2 id="activity-title" className="font-display text-xl">
        {t('home.activity')}
      </h2>
      {items.length ? (
        <ul className="mt-3 divide-y divide-gold-100">
          {items.map((n) => {
            const { icon: Icon, text, href } = notificationView(t, n);
            const body = (
              <>
                <span aria-hidden className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-1', n.readAt ? 'bg-sand text-stone-500 ring-gold-200' : 'bg-brand-50 text-brand-700 ring-brand-100')}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{text}</span>
                  <span className="block text-xs text-stone-500">{relativeTime(n.createdAt)}</span>
                </span>
              </>
            );
            return (
              <li key={n.id}>
                {href ? (
                  <Link href={href} className="-mx-2 flex gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-gold-100/40">
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-3 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-sand/50 px-4 py-8 text-center text-sm text-stone-500">
          <BellRing aria-hidden className="size-6 text-gold-500" />
          {t('home.activityEmpty')}
        </div>
      )}
    </section>
  );
}

/** Jumps into the event most recently worked on. */
function Shortcuts({ event }: { event: EventSummary }) {
  const t = useT();
  const base = `/dashboard/events/${event.id}`;
  const links: Array<{ href: string; label: string; icon: LucideIcon }> = [
    { href: `${base}/design`, label: t('dash.nav.design'), icon: Palette },
    { href: `${base}/guests`, label: t('dashboard.nav.guests'), icon: UsersRound },
    { href: `${base}/invitations`, label: t('dashboard.nav.invitations'), icon: MailOpen },
    { href: `${base}/rsvps`, label: t('dashboard.nav.rsvps'), icon: ClipboardCheck },
    { href: `${base}/photos`, label: t('dash.nav.photos'), icon: Camera },
    { href: `${base}/video`, label: t('dash.nav.video'), icon: Clapperboard },
    { href: `${base}/updates`, label: t('dash.nav.updates'), icon: Megaphone },
  ];
  return (
    <section aria-labelledby="shortcuts-title" className="clay rounded-[1.75rem] p-5">
      <h2 id="shortcuts-title" className="font-display text-xl">
        {t('home.shortcuts')}
      </h2>
      <p className="mt-0.5 truncate text-xs text-stone-500">{event.title}</p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="group flex min-h-11 items-center gap-2.5 rounded-xl bg-white/60 px-3 text-sm font-medium text-stone-700 ring-1 ring-gold-200/70 transition-[background-color,color] hover:bg-white hover:text-ink">
              <Icon aria-hidden className="size-4 text-gold-600 transition-colors group-hover:text-brand-700" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A few designs for the host's occasion, as pre-rendered previews. */
function ExploreDesigns({ typeKey }: { typeKey?: string }) {
  const t = useT();
  const templates = useTemplateList('WEBSITE', typeKey);
  const shown = onePerLook(templates.data ?? [], (tpl) => tpl.preview?.look, forEvent(typeKey))
    .filter((tpl) => cardPreview(tpl.key))
    .slice(0, 4);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="explore-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="explore-title" className="font-display text-3xl tracking-tight">
          {t('home.explore')}
        </h2>
        <Link href={typeKey ? `/templates?event=${typeKey}` : '/templates'} className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          {t('home.exploreAll')}
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {shown.map((tpl) => (
          <li key={tpl.key}>
            <Link href={`/templates/${tpl.key}`} className="group block">
              <span className="clay relative block aspect-[3/5] overflow-hidden rounded-[1.4rem] p-1.5">
                <span className="relative block size-full overflow-hidden rounded-[1.1rem]">
                  <img src={cardPreview(tpl.key)!} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
                </span>
              </span>
              <span className="mt-2.5 flex items-start justify-between gap-2 px-1">
                <span className="line-clamp-1 font-display text-lg text-ink group-hover:text-brand-700">{tpl.name}</span>
                <ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 text-stone-400 group-hover:text-brand-700" />
              </span>
              <span className="block px-1 text-xs text-stone-500">{t(`filter.tier.${tpl.tier}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Before the first event: start from an occasion, see how it works, browse designs. */
function FirstSteps() {
  const t = useT();
  const types = useEventTypes();
  const how: Array<{ icon: LucideIcon; title: string; body: string }> = [
    { icon: Sparkles, title: t('home.how.create'), body: t('home.how.create.body') },
    { icon: Palette, title: t('home.how.design'), body: t('home.how.design.body') },
    { icon: MailOpen, title: t('home.how.invite'), body: t('home.how.invite.body') },
    { icon: PartyPopper, title: t('home.how.celebrate'), body: t('home.how.celebrate.body') },
  ];
  return (
    <div className="space-y-10">
      <section aria-labelledby="occasions-title">
        <h2 id="occasions-title" className="font-display text-3xl tracking-tight">
          {t('home.startWith')}
        </h2>
        <p className="mt-1 text-stone-600">{t('home.startWithBody')}</p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(types.data ?? []).slice(0, 8).map((x) => {
            const Icon = occasionIcon(x.key);
            return (
              <li key={x.key}>
                <Link href={`/dashboard/events/new?type=${x.key}`} className="clay clay-lift flex h-full items-center gap-3 rounded-2xl p-4">
                  <span aria-hidden className="icon-3d size-11 shrink-0 rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-display text-lg leading-snug text-ink">{x.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/dashboard/events/new" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          {t('home.otherOccasion')}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>

      <section aria-labelledby="how-title" className="clay rounded-[2rem] p-6 sm:p-8">
        <h2 id="how-title" className="font-display text-3xl tracking-tight">
          {t('home.how')}
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {how.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <span aria-hidden className="icon-3d size-12 rounded-2xl">
                <Icon className="size-6" />
              </span>
              <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-gold-700 uppercase">{t('home.how.step', { n: i + 1 })}</p>
              <p className="mt-1 font-display text-xl text-ink">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <ExploreDesigns />
    </div>
  );
}
