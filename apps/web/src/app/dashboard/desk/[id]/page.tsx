'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCheck,
  Copy,
  ExternalLink,
  Eye,
  Hand,
  Link2,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
  RefreshCcw,
  RotateCcw,
  Send,
  StickyNote,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { Translator } from '@bulava/localization';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useMe } from '@/lib/queries';
import { inr, OPEN_STATUSES, PREVIEW_KINDS, type DeskActivity, type DeskDetail, type DeskItem, type PreviewKind } from '@/lib/previews';
import { cardPreview, posterPreview } from '@/lib/template-previews';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/components/dashboard/notification-text';
import { DeskError, DeskHeader, GOLD_BUTTON, HEADER_BUTTON, KIND_ICON, shortDate, StatusBadge, Wants } from '@/components/desk/desk-ui';
import { NewPreview } from '@/components/desk/new-preview';
import { Alert, Input, Select, Spinner, Textarea } from '@/components/ui/primitives';

const ENDED = ['OWNED', 'CLOSED', 'CANCELLED'];

/** A titled clay panel of the request page. */
function Panel({ title, hint, action, children, className }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('clay rounded-[1.75rem] p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl">{title}</h2>
          {hint ? <p className="mt-1 text-sm leading-relaxed text-stone-600">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-[0.12em] text-stone-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

/** "WhatsApp and email" */
function channels(t: Translator, message: { whatsapp: boolean; email: boolean }): string {
  return [message.whatsapp ? t('desk.channel.whatsapp') : null, message.email ? t('desk.channel.email') : null].filter(Boolean).join(t('desk.channel.and'));
}

/** One line of the timeline. */
function activityText(t: Translator, a: DeskActivity): string {
  const actor = a.actor ?? t('desk.someone');
  const kind = typeof a.meta.kind === 'string' && (PREVIEW_KINDS as readonly string[]).includes(a.meta.kind) ? t(`desk.kind.${a.meta.kind as PreviewKind}`) : '';
  switch (a.kind) {
    case 'TAKEN':
    case 'RELEASED':
    case 'NOTE':
    case 'OFFER':
    case 'WITHDRAWN':
    case 'LINK_REPLACED':
      return t(`desk.act.${a.kind}`, { actor });
    case 'ASSIGNED':
      return t('desk.act.ASSIGNED', { actor, name: String(a.meta.name ?? '') || t('desk.someone') });
    case 'STATUS':
      return t('desk.act.STATUS', { actor, status: typeof a.meta.to === 'string' ? t(`desk.status.${a.meta.to as DeskDetail['status']}`).toLowerCase() : '' });
    case 'ITEM_ADDED':
    case 'SHARED':
    case 'ITEM_REMOVED':
      return t(`desk.act.${a.kind}`, { actor, kind });
    case 'CREATED':
    case 'ASKED_AGAIN':
    case 'VIEWED':
    case 'CHANGES':
    case 'REPLIED':
    case 'OWNED':
    case 'BOUGHT_AGAIN':
      return t(`desk.act.${a.kind}`);
    default:
      return a.kind;
  }
}

export default function DeskRequestPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const me = useMe();
  const manage = Boolean(me.data?.platformPermissions?.includes('preview.manage'));
  const detail = useQuery({ queryKey: ['desk', id], queryFn: () => apiGet<DeskDetail>(`/desk/requests/${id}`), refetchInterval: 30_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const [offerKey, setOfferKey] = useState<string | null | undefined>(undefined);
  const [coupon, setCoupon] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  if (detail.isPending) return <Spinner label={t('common.loading')} />;
  if (detail.isError) return <DeskError error={detail.error} onRetry={() => void detail.refetch()} retrying={detail.isFetching} />;
  const d = detail.data;
  const ended = ENDED.includes(d.status);
  const mine = d.mine;
  const open = !d.assignee && OPEN_STATUSES.includes(d.status);

  /** Runs a desk action; a returned request replaces the one on screen. */
  const act = async <T,>(key: string, run: () => Promise<T>, after?: (result: T) => void) => {
    setBusy(key);
    setNotice(null);
    try {
      const result = await run();
      if (result && typeof result === 'object' && 'reference' in result && 'items' in result) client.setQueryData(['desk', id], result as unknown as DeskDetail);
      else await detail.refetch();
      void client.invalidateQueries({ queryKey: ['desk', 'summary'] });
      void client.invalidateQueries({ queryKey: ['desk', 'list'] });
      after?.(result);
    } catch (error) {
      setNotice({ tone: 'danger', text: errorMessage(t, error) });
      void detail.refetch();
    } finally {
      setBusy(null);
    }
  };

  const shared = (result: DeskDetail) => {
    const m = result.message;
    if (!m) return;
    setNotice(
      m.whatsapp || m.email
        ? { tone: 'success', text: t('desk.share.sent', { channels: channels(t, m) }) }
        : m.queued
          ? { tone: 'info', text: t('desk.share.queued') }
          : { tone: 'info', text: t('desk.share.none') },
    );
  };

  const copy = async () => {
    if (!d.link) return;
    try {
      await navigator.clipboard.writeText(d.link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(t('desk.link.copy'), d.link.url);
    }
  };

  const phoneDigits = d.customer.phone.replace(/[^\d]/g, '');
  const firstName = d.customer.name.trim().split(/\s+/)[0] ?? d.customer.name;
  const waShare = d.link && mine ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(t('desk.link.whatsappText', { name: firstName, url: d.link.url }))}` : null;
  const made = new Set(d.items.filter((i) => i.status !== 'WITHDRAWN').map((i) => i.kind));
  const startKind = d.wants.find((k) => !made.has(k)) ?? d.wants[0] ?? 'WEBSITE';
  const currentOffer = offerKey === undefined ? d.offer.planKey : offerKey;
  const currentCoupon = coupon === undefined ? (d.offer.couponCode ?? '') : coupon;
  const details = d.celebration.details ?? {};

  return (
    <div className="space-y-6">
      <Link href="/dashboard/desk" className="group inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-700">
        <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-0.5" />
        {t('desk.back')}
      </Link>

      <DeskHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono tracking-wider">{d.reference}</span>
            <StatusBadge status={d.status} className="tracking-normal normal-case" />
            <span className="tracking-normal text-ivory/60 normal-case">{t(`desk.source.${d.source}`)}</span>
          </span>
        }
        title={d.celebration.title}
        actions={
          <>
            {open ? (
              <button type="button" disabled={busy !== null} onClick={() => void act('take', () => apiPost<DeskDetail>(`/desk/requests/${id}/take`))} className={GOLD_BUTTON}>
                <Hand aria-hidden className="size-4" />
                {t('desk.take')}
              </button>
            ) : null}
            {mine && d.assignee && !ended ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (window.confirm(t('desk.releaseConfirm'))) void act('release', () => apiPost(`/desk/requests/${id}/release`), () => router.push('/dashboard/desk'));
                }}
                className={HEADER_BUTTON}
              >
                <Undo2 aria-hidden className="size-4" />
                {t('desk.release')}
              </button>
            ) : null}
            {manage && d.status !== 'OWNED' ? (
              ended ? (
                <button type="button" disabled={busy !== null} onClick={() => void act('reopen', () => apiPatch<DeskDetail>(`/desk/requests/${id}/status`, { status: 'NEW' }))} className={HEADER_BUTTON}>
                  <RotateCcw aria-hidden className="size-4" />
                  {t('desk.status.reopen')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (window.confirm(t('desk.status.closeConfirm'))) void act('close', () => apiPatch<DeskDetail>(`/desk/requests/${id}/status`, { status: 'CLOSED' }));
                    }}
                    className={HEADER_BUTTON}
                  >
                    <CheckCheck aria-hidden className="size-4" />
                    {t('desk.status.close')}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (window.confirm(t('desk.status.closeConfirm'))) void act('cancel', () => apiPatch<DeskDetail>(`/desk/requests/${id}/status`, { status: 'CANCELLED' }));
                    }}
                    className={HEADER_BUTTON}
                  >
                    <Ban aria-hidden className="size-4" />
                    {t('desk.status.cancel')}
                  </button>
                </>
              )
            ) : null}
          </>
        }
      >
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ivory/70">
          <span>{d.celebration.eventTypeName}</span>
          {d.celebration.date ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4 text-gold-200/80" />
              {shortDate(d.celebration.date)}
            </span>
          ) : null}
          {d.celebration.city ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4 text-gold-200/80" />
              {d.celebration.city}
            </span>
          ) : null}
          <span>{d.assignee ? d.assignee.name : t('desk.unassigned')}</span>
        </p>
      </DeskHeader>

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel
            title={t('desk.previews')}
            hint={t('desk.previews.hint')}
            action={
              mine && !ended ? (
                <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="btn-3d min-h-10 rounded-full px-4 text-sm">
                  {adding ? <XCircle aria-hidden className="size-4" /> : <Palette aria-hidden className="size-4" />}
                  {adding ? t('common.cancel') : t('desk.add')}
                </button>
              ) : null
            }
          >
            {adding ? (
              <div className="mb-5">
                <NewPreview
                  eventTypeKey={d.celebration.eventTypeKey}
                  liked={d.template?.key ?? null}
                  start={startKind}
                  busy={busy === 'add'}
                  onCreate={(kind, templateKey) => void act('add', () => apiPost<DeskDetail>(`/desk/requests/${id}/items`, { kind, templateKey }), () => setAdding(false))}
                />
              </div>
            ) : null}
            {d.items.length ? (
              <ul className="grid gap-3">
                {d.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    busy={busy}
                    ended={ended}
                    onShare={() => void act(`share-${item.id}`, () => apiPost<DeskDetail>(`/desk/requests/${id}/items/${item.id}/share`), shared)}
                    onWithdraw={() => void act(`withdraw-${item.id}`, () => apiPost<DeskDetail>(`/desk/requests/${id}/items/${item.id}/withdraw`))}
                    onRemove={() => {
                      if (window.confirm(t('desk.item.removeConfirm'))) void act(`remove-${item.id}`, () => apiDelete<DeskDetail>(`/desk/requests/${id}/items/${item.id}`));
                    }}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-gold-300 bg-white/50 px-5 py-8 text-center text-sm text-stone-600">{t('desk.previews.empty')}</p>
            )}
          </Panel>

          {d.link ? (
            <Panel title={t('desk.link')} hint={t('desk.link.hint')}>
              <div className="clay-inset flex items-center gap-2 rounded-2xl p-2 pl-4">
                <Link2 aria-hidden className="size-4 shrink-0 text-gold-600" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-stone-700">{d.link.url}</span>
                <button type="button" onClick={() => void copy()} className="btn-3d btn-3d-light min-h-9 shrink-0 rounded-xl px-3 text-xs">
                  <Copy aria-hidden className="size-3.5" />
                  {copied ? t('common.copied') : t('desk.link.copy')}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={d.link.path} target="_blank" rel="noreferrer" className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm">
                  <Eye aria-hidden className="size-4" />
                  {t('desk.link.open')}
                </a>
                {waShare ? (
                  <a href={waShare} target="_blank" rel="noopener noreferrer" className="btn-3d btn-3d-green min-h-10 rounded-full px-4 text-sm">
                    <MessageCircle aria-hidden className="size-4" />
                    {t('desk.customer.whatsapp')}
                  </a>
                ) : null}
                {!ended ? (
                  <>
                    <button
                      type="button"
                      disabled={busy !== null || !d.items.some((i) => i.status === 'SHARED')}
                      onClick={() =>
                        void act('send', () => apiPost<DeskDetail>(`/desk/requests/${id}/send`), (r) =>
                          setNotice(r.message && (r.message.whatsapp || r.message.email) ? { tone: 'success', text: t('desk.link.sent', { channels: channels(t, r.message) }) } : { tone: 'info', text: t('desk.share.none') }),
                        )
                      }
                      className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm disabled:opacity-50"
                    >
                      {busy === 'send' ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
                      {t('desk.link.send')}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (window.confirm(t('desk.link.rotateConfirm'))) void act('rotate', () => apiPost<DeskDetail>(`/desk/requests/${id}/link/rotate`));
                      }}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-stone-600 hover:bg-sand hover:text-ink"
                    >
                      <RefreshCcw aria-hidden className="size-4" />
                      {t('desk.link.rotate')}
                    </button>
                  </>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-stone-500">{d.views ? (d.views === 1 ? t('desk.viewedOnce') : t('desk.viewed', { count: d.views })) : t('desk.notViewed')}</p>
            </Panel>
          ) : null}

          <Panel title={t('desk.activity')}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                void act('note', () => apiPost<DeskDetail>(`/desk/requests/${id}/notes`, { text: note.trim() }), () => setNote(''));
              }}
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <Textarea aria-label={t('desk.note.placeholder')} placeholder={t('desk.note.placeholder')} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
              <button type="submit" disabled={!note.trim() || busy !== null} className="btn-3d btn-3d-light min-h-11 shrink-0 rounded-xl px-4 text-sm disabled:opacity-50">
                <StickyNote aria-hidden className="size-4" />
                {t('desk.note.save')}
              </button>
            </form>
            <ol className="mt-5 space-y-0">
              {d.activity.map((a) => (
                <li key={a.id} className="relative flex gap-3 pb-5 pl-1 last:pb-0">
                  <span aria-hidden className="absolute top-6 bottom-0 left-[0.9rem] w-px bg-gold-200 last:hidden" />
                  <span aria-hidden className={cn('relative mt-1 grid size-7 shrink-0 place-items-center rounded-full ring-1', a.actor ? 'bg-white text-stone-500 ring-gold-200' : 'bg-brand-50 text-brand-700 ring-brand-100')}>
                    <span className="size-2 rounded-full bg-current" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{activityText(t, a)}</p>
                    {a.text ? <p className="mt-1 rounded-xl bg-white/70 px-3 py-2 text-sm whitespace-pre-line text-stone-700 ring-1 ring-gold-200/70">{a.text}</p> : null}
                    <p className="mt-0.5 text-xs text-stone-500">{relativeTime(a.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={t('desk.customer')}>
            <p className="font-display text-2xl leading-tight">{d.customer.name}</p>
            <p className="mt-1 font-mono text-sm text-stone-700">{d.customer.phone}</p>
            {d.customer.email ? <p className="text-sm break-all text-stone-700">{d.customer.email}</p> : null}
            {mine ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="btn-3d btn-3d-green min-h-10 rounded-full px-4 text-sm">
                  <MessageCircle aria-hidden className="size-4" />
                  {t('desk.customer.whatsapp')}
                </a>
                <a href={`tel:${d.customer.phone}`} className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm">
                  <Phone aria-hidden className="size-4" />
                  {t('desk.customer.call')}
                </a>
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">{t('desk.customer.hidden')}</p>
            )}
          </Panel>

          <Panel title={t('desk.celebration')}>
            <dl className="grid gap-3">
              <Row label={t('desk.wants')}>
                <Wants wants={d.wants} />
              </Row>
              {d.celebration.detailsSchemaKey === 'couple' ? (
                <>
                  <Row label={t('event.field.partnerOne')}>{details.partnerOne || '—'}</Row>
                  <Row label={t('event.field.partnerTwo')}>{details.partnerTwo || '—'}</Row>
                </>
              ) : d.celebration.detailsSchemaKey === 'honoree' ? (
                <Row label={t('event.field.honoree')}>{details.name || '—'}</Row>
              ) : null}
              {d.celebration.date ? <Row label={t('previewReq.date')}>{shortDate(d.celebration.date)}</Row> : null}
              {d.celebration.venue || d.celebration.city ? <Row label={t('previewReq.venue')}>{[d.celebration.venue, d.celebration.city].filter(Boolean).join(', ')}</Row> : null}
              <Row label={t('desk.functions')}>
                {d.celebration.functions.length ? (
                  <ul className="mt-1 space-y-1.5">
                    {d.celebration.functions.map((fn, i) => (
                      <li key={`${fn.name}-${i}`} className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-gold-200/70">
                        <span className="font-medium">{fn.name}</span>
                        <span className="block text-xs text-stone-600">{[shortDate(fn.date ?? null), fn.time, fn.venue].filter(Boolean).join(' · ') || '—'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-stone-500">{t('desk.noFunctions')}</span>
                )}
              </Row>
              {d.template ? (
                <Row label={t('desk.liked')}>
                  <span className="mt-1 flex items-center gap-3">
                    {cardPreview(d.template.key) ? <img src={cardPreview(d.template.key)!} alt="" className="h-16 w-10 rounded-md object-cover object-top ring-1 ring-gold-200" /> : null}
                    <Link href={`/templates/${d.template.key}`} target="_blank" className="font-medium text-brand-700 hover:underline">
                      {d.template.name}
                    </Link>
                  </span>
                </Row>
              ) : null}
              {d.notes ? (
                <Row label={t('desk.notes')}>
                  <span className="block rounded-xl bg-white/70 px-3 py-2 whitespace-pre-line ring-1 ring-gold-200/70">{d.notes}</span>
                </Row>
              ) : null}
            </dl>
          </Panel>

          {mine && d.status !== 'OWNED' ? (
            <Panel title={t('desk.offer')} hint={t('desk.offer.hint')}>
              <div className="space-y-3">
                <Select aria-label={t('desk.offer')} value={currentOffer ?? ''} onChange={(e) => setOfferKey(e.target.value || null)}>
                  <option value="">{t('desk.offer.cards')}</option>
                  {d.offer.plans.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} · {inr(p.priceMinor)}
                      {p.visibility === 'HIDDEN' ? ` (${t('desk.offer.hidden')})` : ''}
                    </option>
                  ))}
                </Select>
                {manage ? (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-stone-700">{t('desk.offer.coupon')}</span>
                    <Input value={currentCoupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} maxLength={40} autoComplete="off" spellCheck={false} className="uppercase" />
                    <span className="mt-1 block text-xs text-stone-500">{t('desk.offer.couponHint')}</span>
                  </label>
                ) : d.offer.couponCode ? (
                  <p className="text-sm text-stone-600">
                    {t('desk.offer.coupon')}: <span className="font-mono font-semibold">{d.offer.couponCode}</span>
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void act('offer', () => apiPut<DeskDetail>(`/desk/requests/${id}/offer`, { planKey: currentOffer ?? null, ...(manage ? { couponCode: currentCoupon.trim() || null } : {}) }), () => {
                      setOfferKey(undefined);
                      setCoupon(undefined);
                      setNotice({ tone: 'success', text: t('desk.offer.saved') });
                    })
                  }
                  className="btn-3d btn-3d-light min-h-10 w-full rounded-full px-4 text-sm"
                >
                  {t('desk.offer.save')}
                </button>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** One preview: what and which design, where it stands, and what can be done with it. */
function ItemRow({ item, busy, ended, onShare, onWithdraw, onRemove }: { item: DeskItem; busy: string | null; ended: boolean; onShare: () => void; onWithdraw: () => void; onRemove: () => void }) {
  const t = useT();
  const Icon = KIND_ICON[item.kind];
  // A film's picture is its poster; websites and cards, their gallery preview.
  const image = item.kind === 'FILM' ? (posterPreview(item.templateKey) ?? cardPreview(item.templateKey)) : cardPreview(item.templateKey);
  const working = busy === `share-${item.id}` || busy === `withdraw-${item.id}` || busy === `remove-${item.id}`;
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/70 p-3 ring-1 ring-gold-200/80">
      <span className="relative block aspect-[3/5] w-14 shrink-0 overflow-hidden rounded-lg bg-sand ring-1 ring-gold-200">
        {image ? <img src={image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover object-top" /> : null}
        <span aria-hidden className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-md bg-night-900/85 text-gold-200">
          <Icon className="size-3.5" />
        </span>
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">{t(`look.kind.${item.kind}`)}</p>
        <p className="truncate font-display text-xl leading-tight text-ink">{item.templateName}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span className={cn('rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset', item.status === 'SHARED' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : item.status === 'DRAFT' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-stone-100 text-stone-600 ring-stone-200')}>
            {t(`desk.item.${item.status}`)}
          </span>
          {item.sharedAt ? <span>{t('desk.item.sharedAt', { when: relativeTime(item.sharedAt) })}</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.edit && !ended ? (
          <Link href={item.edit} className="btn-3d min-h-10 rounded-full px-4 text-sm">
            <Palette aria-hidden className="size-4" />
            {t('desk.item.edit')}
          </Link>
        ) : null}
        {item.view ? (
          <a href={item.view} target="_blank" rel="noreferrer" className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm">
            <ExternalLink aria-hidden className="size-4" />
            {t('desk.item.view')}
          </a>
        ) : null}
        {!ended && item.edit ? (
          item.status === 'SHARED' ? (
            <>
              <button type="button" disabled={working} onClick={onShare} className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm">
                <Send aria-hidden className="size-4" />
                {t('desk.item.reshare')}
              </button>
              <button type="button" disabled={working} onClick={onWithdraw} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-600 hover:bg-sand hover:text-ink">
                <Undo2 aria-hidden className="size-4" />
                {t('desk.item.withdraw')}
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={working} onClick={onShare} className="btn-3d btn-3d-green min-h-10 rounded-full px-4 text-sm">
                {working ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
                {t('desk.item.share')}
              </button>
              {item.status === 'DRAFT' ? (
                <button type="button" disabled={working} onClick={onRemove} className="grid size-10 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-700" aria-label={t('desk.item.remove')} title={t('desk.item.remove')}>
                  <Trash2 aria-hidden className="size-4" />
                </button>
              ) : null}
            </>
          )
        ) : null}
      </div>
    </li>
  );
}
