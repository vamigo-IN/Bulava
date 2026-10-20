'use client';

import { ArrowRight, BadgeCheck, CalendarDays, Clapperboard, Clock3, Globe2, HeartHandshake, IdCard, MessageCircle, Play, RefreshCcw, Sparkles, type LucideIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createTranslator, formatEventDate } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { lookApi, type LookItem, type LookView, type PreviewKind } from '@/lib/previews';
import { cardPreview, posterPreview } from '@/lib/template-previews';
import { cn } from '@/lib/utils';
import { OwnBar } from './own-bar';

const t = createTranslator('en');
// The card engine loads only when there is a card to draw.
const CardThumb = dynamic(() => import('./card-thumb').then((m) => m.CardThumb), { ssr: false, loading: () => <div className="skeleton aspect-[9/16] w-full" /> });

const KIND_ICON: Record<PreviewKind, LucideIcon> = { WEBSITE: Globe2, CARD: IdCard, FILM: Clapperboard };

/** The dark band at the top of every preview page: who it is for, and who made it. */
export function LookHeader({ view, compact = false }: { view: LookView; compact?: boolean }) {
  return (
    <header data-header-tone="dark" className={cn('grain relative isolate overflow-hidden rounded-b-[2.25rem] bg-night-900 px-5 text-ivory shadow-lift sm:px-8', compact ? 'pt-6 pb-7' : 'pt-10 pb-12 sm:pt-14 sm:pb-16')}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-48 -right-24 h-[520px] w-[720px] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.75),transparent)]" />
        <div className="absolute -bottom-40 left-10 h-[360px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(184,137,43,0.2),transparent)]" />
      </div>
      <Mandala className="pointer-events-none absolute -top-36 left-1/2 -z-10 w-[520px] -translate-x-1/2 animate-spin-slow text-gold-300 opacity-[0.12]" />
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow justify-center bg-white/5 text-gold-200 ring-1 ring-white/10 animate-fade-in-up">
          <Sparkles aria-hidden className="size-3.5" />
          {t('look.eyebrow')}
        </p>
        <h1 className={cn('mt-5 font-display leading-[1.04] tracking-tight text-balance animate-settle-up', compact ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-7xl')}>{view.title}</h1>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-ivory/70 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          {view.date ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4 text-gold-200/80" />
              {formatEventDate(view.date, { language: 'en', timeZone: 'UTC' })}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <HeartHandshake aria-hidden className="size-4 text-gold-200/80" />
            {view.designer ? t('look.by', { name: view.designer }) : t('look.byTeam')}
          </span>
          <span className="font-mono text-xs tracking-wider text-ivory/50">{t('look.reference', { reference: view.reference })}</span>
        </p>
      </div>
    </header>
  );
}

/**
 * A picture that never shows a template's sample names: the website's own
 * opening when it is drawn (`thumb`), else the design's colours blurred under
 * the customer's names.
 */
function Stand({ item, title, index }: { item: LookItem; title: string; index: number }) {
  const Icon = KIND_ICON[item.kind];
  const image = item.kind === 'FILM' ? (posterPreview(item.templateKey) ?? cardPreview(item.templateKey)) : cardPreview(item.templateKey);
  return (
    <span className="relative grid aspect-[9/16] w-full place-items-center overflow-hidden bg-night-900 text-ivory">
      {image ? <img src={image} alt="" loading={index > 1 ? 'lazy' : 'eager'} decoding="async" className="absolute inset-0 size-full scale-125 object-cover object-top opacity-60 blur-xl" /> : null}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-night-900/30 via-night-900/10 to-night-900/70" />
      <span className="relative px-4 text-center">
        <Icon aria-hidden className="mx-auto size-6 text-gold-200" />
        <span className="mt-3 block font-display text-2xl leading-tight text-balance">{title}</span>
      </span>
    </span>
  );
}

/** One preview: its picture on a stage, what it is, and where it opens. */
function PreviewTile({ item, index, title, thumb }: { item: LookItem; index: number; title: string; thumb?: ReactNode }) {
  const Icon = KIND_ICON[item.kind];
  const body = (
    <>
      <span className="relative block overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-sand to-gold-100/60 p-5 ring-1 ring-gold-200/70">
        <span
          className={cn(
            'relative mx-auto block overflow-hidden shadow-[0_24px_50px_-24px_rgba(28,25,23,0.55)] ring-1 ring-black/5 transition-transform duration-500 group-hover:-translate-y-1',
            item.kind === 'WEBSITE' ? (thumb ? 'w-fit rounded-[1.4rem] border-[5px] border-night-900 bg-white' : 'w-[62%] rounded-[1.4rem] border-[5px] border-night-900') : 'w-[72%] rounded-md',
          )}
        >
          {item.kind === 'CARD' && item.design ? <CardThumb design={item.design} photos={item.photos} watermark={item.watermark ?? null} /> : item.kind === 'WEBSITE' && thumb ? thumb : <Stand item={item} title={title} index={index} />}
          {item.kind === 'WEBSITE' && thumb ? (
            // The website's own opening, marked as the preview it is.
            <span aria-hidden className="absolute top-3 right-3 rounded-full bg-night-900/80 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-gold-200 uppercase">
              {t('preview.badge')}
            </span>
          ) : null}
          {item.kind === 'FILM' ? (
            <span aria-hidden className="absolute inset-x-0 bottom-6 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-white/90 text-night-900 shadow-lift">
                <Play className="ml-1 size-6" fill="currentColor" />
              </span>
            </span>
          ) : null}
        </span>
      </span>
      <span className="mt-4 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">
        <Icon aria-hidden className="size-3.5" />
        {t(`look.kind.${item.kind}`)}
      </span>
      <span className="mt-1 block font-display text-2xl leading-tight text-ink">{item.templateName}</span>
      {item.href ? (
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
          {t(`look.open.${item.kind}`)}
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      ) : (
        <span className="mt-3 block text-sm text-stone-600">{t('look.yours.WEBSITE')}</span>
      )}
    </>
  );
  return (
    <li className="animate-fade-in-up" style={{ animationDelay: `${120 + index * 90}ms` }}>
      {item.href ? (
        <Link href={item.href} className="group clay clay-lift block h-full rounded-[2rem] p-3 pb-5 sm:p-4 sm:pb-6" data-cursor="view">
          {body}
        </Link>
      ) : (
        <div className="clay block h-full rounded-[2rem] p-3 pb-5 sm:p-4 sm:pb-6">{body}</div>
      )}
    </li>
  );
}

/** A state with nothing to show yet, or no more. */
function Panel({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children?: React.ReactNode }) {
  return (
    <section className="clay mx-auto max-w-xl rounded-[2rem] p-7 text-center sm:p-10">
      <span className="icon-3d mx-auto size-14 rounded-2xl">
        <Icon aria-hidden className="size-7" />
      </span>
      <h2 className="mt-5 font-display text-3xl leading-tight">{title}</h2>
      <p className="mt-3 leading-relaxed text-stone-600">{body}</p>
      {children}
    </section>
  );
}

/**
 * The customer's preview page (ADR-076): every preview shared with them as a
 * tile (the website opens on its preview link, the card and the film here),
 * reassurance, and the bar to make it theirs or ask for changes. Read again
 * in the browser so "yours" knows who is signed in.
 */
export function LookPage({ token, initial, thumbs = {} }: { token: string; initial: LookView; thumbs?: Record<string, ReactNode> }) {
  const [view, setView] = useState(initial);
  const refresh = useCallback(() => {
    lookApi
      .get(token)
      .then(setView)
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    refresh();
    void lookApi.view(token);
  }, [token, refresh]);

  return (
    <div className="min-h-dvh bg-ivory">
      <LookHeader view={view} />
      <main className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-10">
        {view.state === 'waiting' ? (
          <Panel icon={Clock3} title={t('look.waiting.title')} body={t('look.waiting.body')}>
            <button type="button" onClick={refresh} className="btn-3d btn-3d-light mt-6 min-h-11 rounded-full px-5 text-sm">
              <RefreshCcw aria-hidden className="size-4" />
              {t('payment.action.check')}
            </button>
          </Panel>
        ) : view.state === 'ended' ? (
          <Panel icon={Clock3} title={t('look.ended.title')} body={t('look.ended.body')}>
            <Link href="/get-preview" className="btn-3d mt-6 min-h-12 rounded-full px-6">
              {t('look.ended.cta')}
            </Link>
          </Panel>
        ) : view.state === 'owned' && view.ownedByYou ? (
          <Panel icon={BadgeCheck} title={t('look.owned.title')} body={t('look.owned.body')}>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className="btn-3d min-h-12 rounded-full px-6">
                {t('look.owned.cta')}
              </Link>
              {view.items.some((i) => i.kind === 'CARD') ? (
                <Link href="/dashboard/cards" className="btn-3d btn-3d-light min-h-12 rounded-full px-6">
                  {t('look.owned.cards')}
                </Link>
              ) : null}
            </div>
          </Panel>
        ) : view.state === 'owned' ? (
          <Panel icon={BadgeCheck} title={t('look.owned.title')} body={t('look.owned.other')} />
        ) : (
          <>
            <p className="text-center text-lg text-stone-700 animate-fade-in-up">{t('look.hello', { name: view.customerName })}</p>
            <ul className={cn('mx-auto mt-8 grid gap-5', view.items.length === 1 ? 'max-w-sm' : view.items.length === 2 ? 'max-w-3xl sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
              {view.items.map((item, i) => (
                <PreviewTile key={item.id} item={item} index={i} title={view.title} thumb={thumbs[item.id]} />
              ))}
            </ul>
            <p className="mt-5 text-center text-sm text-stone-500">{t('look.sample')}</p>
            <ul className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                { icon: BadgeCheck, text: t('look.trust.once') },
                { icon: Sparkles, text: t('look.trust.yours') },
                { icon: RefreshCcw, text: t('look.trust.changes') },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="clay flex min-h-14 items-center gap-3 rounded-2xl px-4 text-sm font-medium text-stone-700">
                  <Icon aria-hidden className="size-4.5 shrink-0 text-brand-700" />
                  {text}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-2 pb-10 text-center text-sm text-stone-500">
          <MessageCircle aria-hidden className="size-4 shrink-0 text-emerald-600" />
          {t('look.help')}
        </p>
      </main>
      <OwnBar token={token} view={view} onOwned={refresh} />
    </div>
  );
}
