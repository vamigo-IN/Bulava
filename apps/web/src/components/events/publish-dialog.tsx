'use client';

import { ArrowRight, Check, Copy, ExternalLink, Loader2, Palette, PartyPopper, Rocket, ShieldCheck, Sparkles, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createTranslator } from '@bulava/localization';
import { apiPatch } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { isPlanLimit, unlockHref } from '@/lib/plan-limits';
import { keys, useMe, useShareLink } from '@/lib/queries';
import { LINK_MODES } from '@/lib/setup-steps';
import type { AccessMode, EventSummary } from '@/lib/types';
import { whatsappLink } from '@/lib/utils';
import { AccessOptions } from './access-options';
import { Alert } from '@/components/ui/primitives';

const PublishContext = createContext<(() => void) | null>(null);

/** Opens the publish dialog of the event page it is used in (null outside an event, or for members who cannot publish). */
export function usePublish(): (() => void) | null {
  return useContext(PublishContext);
}

/**
 * Publishing lives in one dialog for every page of an event (the header, the
 * overview and the next-step bar open it). It is also where the host decides
 * who can open the invitation: events start as one private link, and nothing
 * about access is asked while creating them.
 */
export function PublishProvider({ event, enabled, children }: { event: EventSummary; enabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);

  // Links from elsewhere (the home page's "next step") open it with ?publish=1, dropped from the address once read.
  useEffect(() => {
    if (!enabled || event.status !== 'DRAFT') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('publish') !== '1') return;
    setOpen(true);
    url.searchParams.delete('publish');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [enabled, event.status]);
  return (
    <PublishContext.Provider value={enabled ? show : null}>
      {children}
      {/* Mounted only while open: a closed dialog would still put its radio inputs on every event page. */}
      {open ? <PublishDialog event={event} onClose={() => setOpen(false)} /> : null}
    </PublishContext.Provider>
  );
}

function PublishDialog({ event, onClose }: { event: EventSummary; onClose: () => void }) {
  const t = useT();
  const me = useMe();
  const client = useQueryClient();
  const ref = useRef<HTMLDialogElement>(null);
  const [access, setAccess] = useState<AccessMode>(event.accessMode);
  const [busy, setBusy] = useState(false);
  /** `unlock`: where to unlock more when a plan stops publishing (the number of published events, or the design). */
  const [error, setError] = useState<{ text: string; unlock: string | null } | null>(null);
  const [live, setLive] = useState(event.status !== 'DRAFT');
  const base = `/dashboard/events/${event.id}`;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/events/${event.id}`, { status: 'ACTIVE', ...(access !== event.accessMode ? { accessMode: access } : {}) });
      await Promise.all([client.invalidateQueries({ queryKey: ['events', event.id] }), client.invalidateQueries({ queryKey: keys.events })]);
      setLive(true);
    } catch (err) {
      setError({ text: errorMessage(t, err), unlock: isPlanLimit(err) ? unlockHref(err, event.id) : null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself, outside the panel) closes it.
        if (e.target === ref.current && !busy) ref.current?.close();
      }}
      aria-labelledby="publish-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto rounded-[2rem] bg-transparent p-0 backdrop:bg-night-950/55 backdrop:backdrop-blur-sm"
    >
      <div className="clay relative rounded-[2rem] p-5 sm:p-8">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label={t('common.close')}
          className="absolute top-4 right-4 grid size-10 place-items-center rounded-full text-stone-500 transition-colors hover:bg-sand hover:text-ink"
        >
          <X aria-hidden className="size-5" />
        </button>
        {live ? <Published event={{ ...event, accessMode: access }} onDone={() => ref.current?.close()} /> : (
          <>
            <div className="flex items-start gap-4 pr-10">
              <span aria-hidden className="icon-3d size-12 shrink-0 rounded-2xl">
                <Rocket className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 id="publish-title" className="font-display text-3xl leading-tight">
                  {t('publish.title')}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('publish.subtitle')}</p>
              </div>
            </div>

            <h3 className="mt-7 text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase">{t('event.field.accessMode')}</h3>
            <div className="mt-3">
              <AccessOptions value={access} onChange={setAccess} disabled={busy} />
            </div>

            {!event.design || event.counts.readyFunctions === 0 ? (
              <ul className="mt-5 space-y-2">
                {!event.design ? (
                  <Warning icon={Palette} href={`${base}/design`} action={t('dash.step.design.action')} onNavigate={() => ref.current?.close()}>
                    {t('publish.warn.design')}
                  </Warning>
                ) : null}
                {event.counts.readyFunctions === 0 ? (
                  <Warning icon={TriangleAlert} href={`${base}/functions`} action={t('dash.step.functions.action')} onNavigate={() => ref.current?.close()}>
                    {t('publish.warn.functions')}
                  </Warning>
                ) : null}
              </ul>
            ) : null}

            {error ? (
              <div className="mt-5 space-y-3">
                <Alert>{error.text}</Alert>
                {error.unlock ? (
                  <Link href={error.unlock} onClick={() => ref.current?.close()} className="btn-3d btn-3d-gold min-h-11 rounded-2xl px-5 text-sm">
                    <Sparkles aria-hidden className="size-4" />
                    {t('unlock.cta')}
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-gold-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={() => ref.current?.close()} className="btn-3d btn-3d-light min-h-12 rounded-2xl px-6 text-sm">
                {t('common.cancel')}
              </button>
              {me.data?.provisional ? (
                // A WhatsApp-only account secures itself first; the API refuses to publish otherwise.
                <Link href={`/dashboard/claim?next=${encodeURIComponent(base)}`} className="btn-3d min-h-12 rounded-2xl px-6 text-sm">
                  <ShieldCheck aria-hidden className="size-4" />
                  {t('claim.banner.cta')}
                </Link>
              ) : (
                <button type="button" onClick={() => void publish()} disabled={busy} className="btn-3d min-h-12 rounded-2xl px-7 text-sm">
                  {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Rocket aria-hidden className="size-4" />}
                  {busy ? t('publish.publishing') : t('publish.cta')}
                </button>
              )}
            </div>
            {me.data?.provisional ? <p className="mt-3 text-right text-xs text-stone-500">{t('claim.publishFirst')}</p> : null}
          </>
        )}
      </div>
    </dialog>
  );
}

/** A soft warning before publishing, with the way to fix it. */
function Warning({ icon: Icon, href, action, onNavigate, children }: { icon: typeof Palette; href: string; action: string; onNavigate: () => void; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
      <Icon aria-hidden className="size-4 shrink-0 text-amber-700" />
      <span className="min-w-0 flex-1">{children}</span>
      <Link href={href} onClick={onNavigate} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
        {action}
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </li>
  );
}

/** After publishing: the link to share (one-link events), or the way to personal invitations. */
function Published({ event, onDone }: { event: EventSummary; onDone: () => void }) {
  const t = useT();
  const linkMode = LINK_MODES.has(event.accessMode);
  const share = useShareLink(event.id, linkMode);
  const [copied, setCopied] = useState(false);
  const base = `/dashboard/events/${event.id}`;
  const url = share.data?.kind === 'LINK' ? (share.data.url ?? '') : '';
  const guestT = useMemo(() => createTranslator(event.language), [event.language]);

  return (
    <div className="text-center">
      <span aria-hidden className="mx-auto grid size-20 animate-pop-in place-items-center rounded-[1.6rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 text-white shadow-[inset_0_2px_2px_rgba(255,255,255,0.35),inset_0_-8px_12px_-4px_rgba(0,0,0,0.3),4px_12px_24px_-8px_rgba(4,90,60,0.45)]">
        <PartyPopper className="size-10" strokeWidth={2} />
      </span>
      <h2 id="publish-title" className="mt-6 font-display text-3xl leading-tight sm:text-4xl">
        {t('publish.done.title')}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-600">{linkMode ? t('publish.done.link') : t('publish.done.personal')}</p>

      {linkMode ? (
        <div className="clay-inset mx-auto mt-6 max-w-lg rounded-2xl p-3 text-left">
          {share.isPending ? (
            <p className="flex items-center gap-2 px-1 py-2 text-sm text-stone-500">
              <Loader2 aria-hidden className="size-4 animate-spin" /> {t('common.loading')}
            </p>
          ) : url ? (
            <>
              <code className="block truncate rounded-xl bg-white px-3 py-2.5 font-mono text-xs text-stone-700">{url}</code>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard?.writeText(url).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1800);
                    })
                  }
                  className="btn-3d btn-3d-light min-h-10 flex-1 rounded-xl px-4 text-sm"
                >
                  {copied ? <Check aria-hidden className="size-4 text-emerald-700" /> : <Copy aria-hidden className="size-4" />}
                  {copied ? t('common.copied') : t('share.copy')}
                </button>
                <a href={whatsappLink(null, guestT('share.whatsappMessage', { eventTitle: event.title, url }))} target="_blank" rel="noopener noreferrer" className="btn-3d btn-3d-green min-h-10 flex-1 rounded-xl px-4 text-sm">
                  {t('share.whatsapp')}
                </a>
                <a href={url} target="_blank" rel="noreferrer" className="btn-3d btn-3d-light min-h-10 rounded-xl px-4 text-sm">
                  <ExternalLink aria-hidden className="size-4" />
                  <span className="sr-only">{t('share.open')}</span>
                </a>
              </div>
            </>
          ) : (
            <p className="px-1 py-2 text-sm text-stone-600">{t('share.subtitle.LINK')}</p>
          )}
        </div>
      ) : null}

      <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onDone} className="btn-3d btn-3d-light min-h-12 rounded-2xl px-6 text-sm">
          {t('publish.done.close')}
        </button>
        <Link href={`${base}/${linkMode ? 'invitations' : 'guests'}`} onClick={onDone} className="btn-3d min-h-12 rounded-2xl px-6 text-sm">
          {linkMode ? t('publish.done.next.link') : t('publish.done.next.personal')}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </div>
  );
}
