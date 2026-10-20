'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, HeartHandshake, History, IdCard, LoaderCircle, Palette, Plus, ReceiptText, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { apiDelete, apiGet } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { cardPreview } from '@/lib/template-previews';
import { cn } from '@/lib/utils';
import { LoadError } from '@/components/dashboard/load-error';
import { relativeTime } from '@/components/dashboard/notification-text';
import { DeskHeader } from '@/components/desk/desk-ui';
import { Alert, Spinner } from '@/components/ui/primitives';

// The card engine loads with the first card to draw.
const CardThumb = dynamic(() => import('@/components/previews/card-thumb').then((m) => m.CardThumb), { ssr: false, loading: () => <div className="skeleton aspect-[9/16] w-full" /> });

interface SavedCard {
  id: string;
  templateKey: string;
  templateName: string;
  format: string;
  eventType: string;
  design: unknown;
  photos: Record<string, string>;
  status: 'DRAFT' | 'DOWNLOADED' | 'BOUGHT';
  fromDesigner: { reference: string } | null;
  bought: Array<{ reference: string; paidAt: string | null; orderToken: string; current: boolean }>;
  downloads: number;
  planCards: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BoughtOrder {
  reference: string;
  paidAt: string | null;
  templateKey: string;
  templateName: string;
  design: unknown;
  orderToken: string;
}

interface CardHistory {
  id: string;
  createdAt: string;
  events: Array<{ type: string; at: string }>;
}

const STATUS_TONE: Record<SavedCard['status'], string> = {
  DRAFT: 'bg-amber-50 text-amber-900 ring-amber-200',
  DOWNLOADED: 'bg-sky-50 text-sky-800 ring-sky-200',
  BOUGHT: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

const KNOWN_EVENTS = new Set([
  'CARD_CUSTOMIZED',
  'FREE_DOWNLOAD_COMPLETED',
  'PLAN_DOWNLOAD_COMPLETED',
  'PAID_DOWNLOAD_COMPLETED',
  'PAYMENT_SUCCEEDED',
  'EMAIL_SENT',
  'FREE_CARD_GENERATED',
  'PLAN_CARD_GENERATED',
  'PAID_CARD_GENERATED',
]);

/**
 * My cards (ADR-077): every card designed while signed in, on any device,
 * with what became of it (downloaded, bought, emailed). A bought card's
 * order page downloads it; drafts open in the editor again.
 */
export default function MyCardsPage() {
  const t = useT();
  const client = useQueryClient();
  const cards = useQuery({ queryKey: ['cards', 'mine'], queryFn: () => apiGet<{ cards: SavedCard[]; orders: BoughtOrder[] }>('/cards/mine') });
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const remove = async (card: SavedCard) => {
    if (!window.confirm(t('myCards.deleteConfirm'))) return;
    setRemoving(card.id);
    setProblem(null);
    try {
      await apiDelete(`/cards/mine/${card.id}`);
      await client.invalidateQueries({ queryKey: ['cards', 'mine'] });
    } catch (error) {
      setProblem(errorMessage(t, error));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      <DeskHeader
        eyebrow={t('myCards.eyebrow')}
        title={t('myCards.title')}
        actions={
          <Link href="/cards" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-5 text-sm font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_-12px_rgba(227,197,133,0.8)] transition-colors hover:from-gold-100 hover:to-gold-200">
            <Plus aria-hidden className="size-4" />
            {t('myCards.new')}
          </Link>
        }
      >
        <p className="mt-2 max-w-2xl text-ivory/70">{t('myCards.subtitle')}</p>
      </DeskHeader>

      {problem ? <Alert>{problem}</Alert> : null}

      {cards.isPending ? (
        <Spinner label={t('common.loading')} />
      ) : cards.isError ? (
        <LoadError error={cards.error} onRetry={() => void cards.refetch()} retrying={cards.isFetching} />
      ) : !cards.data.cards.length && !cards.data.orders.length ? (
        <section className="clay mx-auto max-w-xl rounded-[2rem] p-8 text-center">
          <span aria-hidden className="icon-3d mx-auto size-14 rounded-2xl">
            <IdCard className="size-7" />
          </span>
          <h2 className="mt-5 font-display text-3xl">{t('myCards.empty.title')}</h2>
          <p className="mt-2 leading-relaxed text-stone-600">{t('myCards.empty.body')}</p>
          <Link href="/cards" className="btn-3d mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-6">
            <Palette aria-hidden className="size-4" />
            {t('myCards.new')}
          </Link>
        </section>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {cards.data.cards.map((card) => (
              <CardTile key={card.id} card={card} removing={removing === card.id} onRemove={() => void remove(card)} />
            ))}
          </ul>
          {cards.data.orders.length ? (
            <section className="clay rounded-[1.75rem] p-5 sm:p-6">
              <h2 className="font-display text-2xl">{t('myCards.orders')}</h2>
              <p className="mt-1 text-sm text-stone-600">{t('myCards.ordersBody')}</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {cards.data.orders.map((order) => (
                  <li key={order.reference}>
                    <Link href={`/cards/order#${order.orderToken}`} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-gold-200 transition-colors hover:bg-white">
                      <span className="relative block aspect-[3/5] w-10 shrink-0 overflow-hidden rounded-md bg-sand ring-1 ring-gold-200">
                        {cardPreview(order.templateKey) ? <img src={cardPreview(order.templateKey)!} alt="" loading="lazy" className="absolute inset-0 size-full object-cover object-top" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{order.templateName}</span>
                        <span className="block text-xs text-stone-500">
                          {order.reference}
                          {order.paidAt ? ` · ${t('myCards.bought', { when: relativeTime(order.paidAt) })}` : ''}
                        </span>
                      </span>
                      <ReceiptText aria-hidden className="size-4 text-gold-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

/** One saved card: the card itself, where it stands, and what can be done with it. */
function CardTile({ card, removing, onRemove }: { card: SavedCard; removing: boolean; onRemove: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const order = card.bought.find((o) => o.current) ?? card.bought[0] ?? null;
  return (
    <li className="clay flex flex-col rounded-[1.6rem] p-2.5">
      <Link href={`/cards/editor/${card.templateKey}?card=${card.id}`} className="group relative block overflow-hidden rounded-[1.2rem] bg-sand ring-1 ring-gold-200/70" aria-label={`${t('myCards.open')}: ${card.templateName}`}>
        {card.design ? (
          <CardThumb design={card.design} photos={card.photos} watermark={null} className="transition-transform duration-500 group-hover:scale-[1.02]" />
        ) : cardPreview(card.templateKey) ? (
          <img src={cardPreview(card.templateKey)!} alt="" loading="lazy" className="block aspect-[9/16] w-full object-cover object-top" />
        ) : null}
        <span className={cn('absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', STATUS_TONE[card.status])}>{t(`myCards.status.${card.status}`)}</span>
        {card.fromDesigner ? (
          <span className="absolute right-2 bottom-2 left-2 inline-flex items-center justify-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-brand-700 shadow-sm">
            <HeartHandshake aria-hidden className="size-3" />
            {t('myCards.fromDesigner')}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1">
        <p className="truncate font-display text-lg leading-tight text-ink">{card.templateName}</p>
        <p className="mt-0.5 text-xs text-stone-500">
          {t('myCards.edited', { when: relativeTime(card.updatedAt) })}
          {card.downloads ? ` · ${card.downloads === 1 ? t('myCards.downloadsOnce') : t('myCards.downloads', { count: card.downloads })}` : ''}
        </p>
        {order && !order.current ? <p className="mt-1 text-[11px] text-amber-800">{t('myCards.changedSince')}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Link href={`/cards/editor/${card.templateKey}?card=${card.id}`} className="btn-3d min-h-9 flex-1 rounded-full px-3 text-xs">
            <Palette aria-hidden className="size-3.5" />
            {t('myCards.open')}
          </Link>
          {order ? (
            <Link href={`/cards/order#${order.orderToken}`} className="btn-3d btn-3d-light min-h-9 rounded-full px-3 text-xs">
              <Download aria-hidden className="size-3.5" />
              {t('myCards.order')}
            </Link>
          ) : null}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="grid size-9 place-items-center rounded-full text-stone-500 hover:bg-sand hover:text-ink" aria-label={t('myCards.history')} title={t('myCards.history')}>
            <History aria-hidden className="size-4" />
          </button>
          {card.status !== 'BOUGHT' ? (
            <button type="button" onClick={onRemove} disabled={removing} className="grid size-9 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-700" aria-label={t('myCards.delete')} title={t('myCards.delete')}>
              {removing ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
            </button>
          ) : null}
        </div>
        {open ? <CardStory id={card.id} /> : null}
      </div>
    </li>
  );
}

/** A saved card's story, newest first (loaded when asked for). */
function CardStory({ id }: { id: string }) {
  const t = useT();
  const story = useQuery({ queryKey: ['cards', 'mine', id, 'history'], queryFn: () => apiGet<CardHistory>(`/cards/mine/${id}/history`) });
  if (story.isPending) return <p className="mt-3 text-xs text-stone-500">{t('common.loading')}</p>;
  if (story.isError) return <p className="mt-3 text-xs text-red-700">{errorMessage(t, story.error)}</p>;
  const events = story.data.events.filter((e) => KNOWN_EVENTS.has(e.type));
  return (
    <div className="mt-3 rounded-xl bg-white/70 p-3 ring-1 ring-gold-200/70">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-stone-500 uppercase">{t('myCards.historyTitle')}</p>
      <ol className="mt-2 space-y-1.5">
        {events.map((e, i) => (
          <li key={`${e.type}-${i}`} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-ink">{t(`myCards.ev.${e.type}` as Parameters<typeof t>[0])}</span>
            <span className="shrink-0 text-stone-500">{relativeTime(e.at)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-ink">{t('myCards.historyMade')}</span>
          <span className="shrink-0 text-stone-500">{relativeTime(story.data.createdAt)}</span>
        </li>
      </ol>
    </div>
  );
}
