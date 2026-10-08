'use client';

import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Check,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  ContactRound,
  ExternalLink,
  Images,
  LayoutDashboard,
  MailOpen,
  Megaphone,
  Palette,
  Rocket,
  ScanLine,
  Settings,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { formatEventDate, type MessageKey } from '@bulava/localization';
// The single module: every event page shares this layout, and the package entry would bring the whole template engine.
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { errorMessage, useT } from '@/lib/i18n';
import { can, canOpenSection } from '@/lib/permissions';
import { useDesign, useEvent } from '@/lib/queries';
import { progressOf, type SetupStepKey } from '@/lib/setup-steps';
import type { EventSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { NoAccess } from '@/components/dashboard/no-access';
import { NextStepBar } from '@/components/events/next-step-bar';
import { PublishProvider, usePublish } from '@/components/events/publish-dialog';
import { useSetupSteps } from '@/components/events/use-setup-steps';
import { Alert, Spinner } from '@/components/ui/primitives';

type Tab = { href: string; label: MessageKey; icon: LucideIcon; step?: SetupStepKey };

const GROUPS: Array<{ label: MessageKey; tabs: Tab[] }> = [
  {
    label: 'dash.navGroup.setup',
    tabs: [
      { href: '', label: 'dashboard.nav.overview', icon: LayoutDashboard },
      { href: '/design', label: 'dash.nav.design', icon: Palette, step: 'design' },
      { href: '/functions', label: 'dashboard.nav.functions', icon: CalendarDays, step: 'functions' },
    ],
  },
  {
    label: 'dash.navGroup.guests',
    tabs: [
      { href: '/groups', label: 'dashboard.nav.groups', icon: UsersRound },
      { href: '/guests', label: 'dashboard.nav.guests', icon: ContactRound, step: 'guests' },
      { href: '/invitations', label: 'dashboard.nav.invitations', icon: MailOpen, step: 'share' },
      { href: '/rsvps', label: 'dashboard.nav.rsvps', icon: ClipboardCheck, step: 'rsvps' },
      { href: '/registrations', label: 'dash.nav.registrations', icon: ClipboardList },
      { href: '/logistics', label: 'dash.nav.logistics', icon: BedDouble },
    ],
  },
  {
    label: 'dash.navGroup.celebrate',
    tabs: [
      { href: '/updates', label: 'dash.nav.updates', icon: Megaphone },
      { href: '/photos', label: 'dash.nav.photos', icon: Images },
      { href: '/video', label: 'dash.nav.video', icon: Clapperboard },
      { href: '/checkin', label: 'dash.nav.checkin', icon: ScanLine },
    ],
  },
  {
    label: 'dash.navGroup.manage',
    tabs: [{ href: '/settings', label: 'dash.nav.settings', icon: Settings }],
  },
];

/** The groups and sections this member's role can use (a photographer sees only Photos). */
function visibleGroups(event: EventSummary | undefined) {
  return GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((tab) => canOpenSection(event, tab.href)) })).filter((g) => g.tabs.length);
}

/** A status chip on the dark event header. */
function Chip({ children, dot, icon: Icon }: { children: ReactNode; dot?: string; icon?: LucideIcon }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-ivory/85">
      {dot ? <span aria-hidden className={cn('size-1.5 rounded-full', dot)} /> : null}
      {Icon ? <Icon aria-hidden className="size-3.5 text-gold-200/80" /> : null}
      {children}
    </span>
  );
}

const HEADER_BUTTON = 'inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium text-ivory ring-1 ring-white/20 transition-[background-color,box-shadow] duration-300 hover:bg-white/5 hover:ring-gold-300/40';
const GOLD_BUTTON =
  'inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-5 text-sm font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_-12px_rgba(227,197,133,0.8)] transition-colors duration-300 hover:from-gold-100 hover:to-gold-200';

export default function EventLayout({ children }: { children: ReactNode }) {
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const t = useT();
  if (event.isPending) return <Spinner label={t('common.loading')} />;
  if (event.isError) return <Alert>{errorMessage(t, event.error)}</Alert>;
  return (
    <PublishProvider event={event.data} enabled={can(event.data, 'event.publish')}>
      <EventFrame event={event.data}>{children}</EventFrame>
    </PublishProvider>
  );
}

function EventFrame({ event, children }: { event: EventSummary; children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const design = useDesign(event.id);
  const publish = usePublish();
  const canEdit = can(event, 'event.update');
  const steps = useSetupSteps(canEdit ? event : undefined);
  const base = `/dashboard/events/${event.id}`;
  const rest = pathname.slice(base.length);
  const section = rest ? `/${rest.split('/')[1]}` : '';
  const groups = visibleGroups(event);
  const first = groups[0]?.tabs[0] ?? null;
  const allowedHere = canOpenSection(event, section);
  const overview = section === '';

  // A role without the overview (a photographer) starts in its first section.
  useEffect(() => {
    if (section === '' && !allowedHere && first) router.replace(`${base}${first.href}`);
  }, [section, allowedHere, first, base, router]);

  const tier = design.data?.entitlements['templates.maxTier'];
  const paid = tier?.source === 'EVENT_PURCHASE' || tier?.source === 'SUBSCRIPTION';
  const planName = !tier ? '' : paid ? t('dash.plan.paid', { plan: tier.limit === 2 ? 'Premium' : 'Standard' }) : t('dash.plan.free');
  const status = event.status;
  const doneSteps = new Set(steps?.filter((s) => s.done).map((s) => s.key));
  const progress = steps ? progressOf(steps) : null;

  const tabLink = (tab: Tab, compact: boolean) => {
    const href = `${base}${tab.href}`;
    const active = tab.href === '' ? pathname === base : pathname.startsWith(href);
    const done = tab.step ? doneSteps.has(tab.step) : false;
    const Icon = tab.icon;
    return (
      <li key={tab.href}>
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex items-center gap-3 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-300',
            compact ? 'min-h-10 rounded-full px-4' : 'min-h-9 rounded-xl px-3',
            active ? 'bg-white text-ink shadow-soft ring-1 ring-gold-200/80' : 'text-stone-600 hover:bg-white/70 hover:text-ink',
          )}
        >
          <Icon aria-hidden className={cn('size-4 shrink-0 transition-colors duration-300', active ? 'text-brand-700' : 'text-stone-400 group-hover:text-gold-600')} />
          <span className="flex-1">{t(tab.label)}</span>
          {done ? (
            <span className="grid size-4 place-items-center rounded-full bg-emerald-600 text-white" title={t('next.state.done')}>
              <Check aria-hidden className="size-2.5" strokeWidth={3.5} />
              <span className="sr-only">{t('next.state.done')}</span>
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <div>
      <div className={cn('grain relative isolate mb-6 overflow-hidden rounded-[2rem] bg-night-900 text-ivory shadow-lift', overview ? 'px-6 py-7 sm:px-8 sm:py-8' : 'px-6 py-5 sm:px-8 sm:py-6')}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-24 h-[420px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.7),transparent)]" />
          <div className="absolute -bottom-40 -left-20 h-[320px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(184,137,43,0.16),transparent)]" />
        </div>
        <Mandala className="pointer-events-none absolute -top-28 -right-20 -z-10 w-80 animate-spin-slow text-gold-300 opacity-[0.1]" />
        <Link href="/dashboard/events" className="group/back inline-flex items-center gap-1.5 text-sm text-ivory/70 transition-colors hover:text-ivory">
          <ArrowLeft aria-hidden className="size-4 transition-transform duration-300 group-hover/back:-translate-x-0.5" />
          {t('dash.nav.events')}
        </Link>
        <div className={cn('flex flex-wrap items-end justify-between gap-5', overview ? 'mt-3' : 'mt-2')}>
          <div className="min-w-0">
            <h1 className={cn('font-display leading-[1.05] tracking-tight text-balance', overview ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl')}>{event.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip dot={status === 'ACTIVE' ? 'bg-emerald-400' : status === 'DRAFT' ? 'bg-amber-300' : 'bg-stone-400'}>{t(`event.status.${status}`)}</Chip>
              {event.startDate ? <Chip icon={CalendarDays}>{formatEventDate(event.startDate, { language: 'en', timeZone: event.timezone })}</Chip> : null}
              {planName ? <Chip dot={paid ? 'bg-gold-300' : undefined}>{planName}</Chip> : null}
              {/* Before publishing nothing is open to guests; the mode is chosen when publishing. */}
              {status !== 'DRAFT' ? <Chip>{t(`access.short.${event.accessMode}`)}</Chip> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* The watermarked preview: works before publishing, whatever the access mode. */}
            <a href={`/preview/${event.previewToken}`} target="_blank" rel="noreferrer" className={HEADER_BUTTON}>
              {t('dash.nav.preview')}
              <ExternalLink aria-hidden className="size-4" />
            </a>
            {(event.accessMode === 'PUBLIC' || event.accessMode === 'PRIVATE_LINK') && can(event, 'invitation.read') && status === 'ACTIVE' ? (
              <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className={HEADER_BUTTON}>
                {t('dash.nav.viewSite')}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : null}
            {!paid && can(event, 'payment.read') ? (
              <Link href={`${base}/upgrade`} className={status === 'DRAFT' && publish ? HEADER_BUTTON : GOLD_BUTTON}>
                <Sparkles aria-hidden className="size-4" />
                {t('dash.nav.upgrade')}
              </Link>
            ) : null}
            {status === 'DRAFT' && publish ? (
              <button type="button" onClick={publish} className={GOLD_BUTTON}>
                <Rocket aria-hidden className="size-4" />
                {t('publish.open')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        {/* Phones and tablets: one scrolling row of pills. Positioned, so the pills' screen-reader labels scroll with it instead of widening the page. */}
        <nav aria-label={t('dash.nav.sections')} className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden">
          <ul className="flex min-w-max gap-1.5 pb-1">{groups.flatMap((g) => g.tabs).map((tab) => tabLink(tab, true))}</ul>
        </nav>
        {/* Desktop: a sticky sidebar, grouped, with the setup's progress on top. */}
        <nav aria-label={t('dash.nav.sections')} className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] space-y-4 overflow-y-auto rounded-[1.5rem] border border-gold-200/60 bg-sand/40 p-3 [scrollbar-width:thin]">
            {progress ? (
              <div className="rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-gold-200/70">
                <p className="flex items-center justify-between text-[11px] font-semibold tracking-[0.14em] text-stone-500 uppercase">
                  {t('next.setup')}
                  <span className="text-brand-700">
                    {progress.done}/{progress.total}
                  </span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gold-100" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label={t('next.setup')}>
                  <div className="h-full rounded-full bg-gradient-to-r from-gold-300 to-brand-700 transition-[width] duration-700" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              </div>
            ) : null}
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.22em] text-stone-500 uppercase">{t(group.label)}</p>
                <ul className="space-y-0.5">{group.tabs.map((tab) => tabLink(tab, false))}</ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0">
          {allowedHere ? (
            <>
              {children}
              {/* The overview has the full checklist; every other page ends with the way forward. */}
              {!overview && canEdit ? <NextStepBar event={event} section={section} /> : null}
            </>
          ) : section === '' && first ? (
            <Spinner label={t('common.loading')} />
          ) : (
            <NoAccess role={event.role} next={first ? { href: `${base}${first.href}`, label: t(first.label) } : null} />
          )}
        </div>
      </div>
    </div>
  );
}
