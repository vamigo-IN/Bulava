'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, GalleryVerticalEnd, Inbox, PenLine, Send, Sparkles, UserRound, Wand2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { myPreviewState, type DeskSummary, type MyPreview } from '@/lib/previews';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { shortDate, Wants } from '@/components/desk/desk-ui';

const STATE_TONE = {
  waiting: 'bg-amber-50 text-amber-900 ring-amber-200',
  ready: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  owned: 'bg-gold-100 text-gold-800 ring-gold-300',
  ended: 'bg-stone-100 text-stone-600 ring-stone-200',
} as const;

/** Previews a designer made for this account (ADR-076), asked for while signed in or for its confirmed number. */
export function MyPreviewsSection() {
  const t = useT();
  const previews = useQuery({ queryKey: ['previews', 'mine'], queryFn: () => apiGet<MyPreview[]>('/previews/mine'), staleTime: 60_000 });
  const list = previews.data ?? [];
  if (!list.length) return null;
  return (
    <section aria-labelledby="my-previews" className="clay rounded-[2rem] p-5 sm:p-6">
      <h2 id="my-previews" className="flex items-center gap-2 font-display text-2xl tracking-tight">
        <Sparkles aria-hidden className="size-5 text-gold-600" />
        {t('myPreviews.title')}
      </h2>
      <ul className="mt-4 grid gap-3">
        {list.slice(0, 5).map((p) => {
          const state = myPreviewState(p);
          const href = state === 'owned' && p.eventId ? `/dashboard/events/${p.eventId}` : p.link;
          return (
            <li key={p.reference}>
              <Link href={href} className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white/70 p-4 ring-1 ring-gold-200/80 transition-[background-color,box-shadow] hover:bg-white hover:shadow-soft">
                <span className="min-w-0 flex-1 basis-56">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATE_TONE[state])}>{t(`myPreviews.state.${state}`)}</span>
                    <span className="font-mono text-xs text-stone-500">{p.reference}</span>
                  </span>
                  <span className="mt-1 block truncate font-display text-xl text-ink group-hover:text-brand-700">{p.title}</span>
                  {p.date ? <span className="block text-sm text-stone-600">{shortDate(p.date)}</span> : null}
                </span>
                <Wants wants={p.shared.length ? p.shared : p.wants} />
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                  {state === 'owned' && p.eventId ? t('myPreviews.openEvent') : t('myPreviews.open')}
                  <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Let our designers make it": the way to ask for a free preview (`wide`: one row on wider screens). */
export function AskPreviewCard({ wide = false }: { wide?: boolean }) {
  const t = useT();
  return (
    <section className={cn('clay relative overflow-hidden rounded-[1.75rem] p-5', wide && 'sm:flex sm:items-center sm:gap-5 sm:p-6')}>
      <span aria-hidden className="icon-3d size-11 shrink-0 rounded-xl">
        <Wand2 className="size-5" />
      </span>
      <div className={cn('mt-3 min-w-0', wide && 'sm:mt-0 sm:flex-1')}>
        <h2 className="font-display text-xl">{t('myPreviews.ask')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('myPreviews.askBody')}</p>
      </div>
      <div className={cn('mt-4 flex flex-wrap gap-2', wide && 'sm:mt-0 sm:shrink-0')}>
        <Link href="/get-preview" className="btn-3d min-h-10 rounded-full px-4 text-sm">
          <Sparkles aria-hidden className="size-4" />
          {t('previewReq.cta')}
        </Link>
        <Link href="/dashboard/cards" className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm">
          <GalleryVerticalEnd aria-hidden className="size-4" />
          {t('dash.nav.myCards')}
        </Link>
      </div>
    </section>
  );
}

/** For preview providers: where their desk stands, one tap from home. */
export function DeskGlance() {
  const t = useT();
  const me = useMe();
  const desk = Boolean(me.data?.platformPermissions?.includes('preview.work'));
  const summary = useQuery({ queryKey: ['desk', 'summary'], queryFn: () => apiGet<DeskSummary>('/desk/summary'), enabled: desk, refetchInterval: 60_000, retry: false });
  if (!desk || !summary.data) return null;
  const tiles: Array<{ label: string; value: number; icon: LucideIcon; href: string }> = [
    { label: t('desk.stat.mine'), value: summary.data.mine, icon: UserRound, href: '/dashboard/desk' },
    { label: t('desk.stat.open'), value: summary.data.open, icon: Inbox, href: '/dashboard/desk?scope=open' },
    { label: t('desk.stat.changes'), value: summary.data.changes, icon: PenLine, href: '/dashboard/desk?status=CHANGES_REQUESTED' },
    { label: t('desk.stat.sent'), value: summary.data.sent, icon: Send, href: '/dashboard/desk?status=SENT' },
  ];
  return (
    <section aria-labelledby="desk-glance" className="clay rounded-[1.75rem] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="desk-glance" className="font-display text-xl">
          {t('dash.nav.desk')}
        </h2>
        <Link href="/dashboard/desk" className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          {t('desk.back')}
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <li key={label}>
            <Link href={href} className="clay-inset block rounded-2xl p-3.5 transition-colors hover:bg-white/60">
              <Icon aria-hidden className="size-4 text-gold-600" />
              <span className="mt-2 block font-display text-3xl leading-none text-ink">{value}</span>
              <span className="mt-1 block text-xs text-stone-500">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
