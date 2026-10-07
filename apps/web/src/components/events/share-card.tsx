'use client';

import { CalendarClock, Check, Copy, ExternalLink, KeyRound, Link2, RefreshCw, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { createTranslator, formatEventDate, type MessageKey } from '@bulava/localization';
import { apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { useInvalidateEvent, useShareLink } from '@/lib/queries';
import type { EventSummary } from '@/lib/types';
import { whatsappLink } from '@/lib/utils';
import { Alert, Button, Card, Input, Spinner } from '@/components/ui/primitives';

/** The date input's value for an ISO time, in the browser's calendar. */
function dateValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * What a host shares. Public, private-link and secret-link events have one
 * link for everyone (copy, WhatsApp, open), with registration so guests need
 * not be added first; secret links show when they stop working and can be
 * replaced. Invite-only and group-only events point to adding guests and
 * sending personal invitations instead.
 */
export function ShareCard({ event, compact = false, linkOnly = false }: { event: EventSummary; compact?: boolean; linkOnly?: boolean }) {
  const t = useT();
  const share = useShareLink(event.id);
  const invalidate = useInvalidateEvent(event.id);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/dashboard/events/${event.id}`;
  const canEdit = can(event, 'event.update');

  if (share.isPending) return <Spinner label={t('common.loading')} />;
  if (share.isError) return <Alert>{errorMessage(t, share.error)}</Alert>;
  const info = share.data;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await invalidate();
      setEditing(false);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (info.kind === 'PERSONAL') {
    if (linkOnly) return null;
    return (
      <Card className="min-w-0 rounded-3xl">
        <div className="flex items-start gap-4">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight">{t('share.title')}</h2>
            <p className="mt-1 text-sm text-stone-600">{t('share.subtitle.PERSONAL', { mode: t(`access.short.${info.mode}` as MessageKey) })}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {can(event, 'guest.write') ? (
                <Link href={`${base}/guests`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-semibold text-ivory transition-colors hover:bg-brand-800">
                  <UserPlus aria-hidden className="size-4" />
                  {t('share.addGuests')}
                </Link>
              ) : null}
              <Link href={`${base}/invitations`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold-300 px-4 text-sm font-medium text-brand-700 transition-colors hover:bg-gold-100/60">
                {t('share.personalInvites')}
              </Link>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const url = info.url ?? '';
  const guestT = createTranslator(event.language);
  const expiresLabel = info.expiresAt ? formatEventDate(info.expiresAt, { language: 'en', timeZone: event.timezone }) : null;

  return (
    <Card className="min-w-0 rounded-3xl">
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-gold-200 shadow-[0_10px_20px_-10px_rgba(91,14,27,0.8)]">
          <Link2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight">{t('share.title')}</h2>
          {compact ? null : <p className="mt-1 text-sm text-stone-600">{t('share.subtitle.LINK')}</p>}

          {info.eventStatus === 'DRAFT' ? (
            <div className="mt-3">
              <Alert tone="info">{t('share.draft')}</Alert>
            </div>
          ) : null}
          {error ? (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-gold-200 bg-ivory/70 py-2 pr-2 pl-4">
            <p className={`min-w-0 flex-1 truncate font-mono text-sm ${info.expired ? 'text-stone-400 line-through' : 'text-ink'}`} title={url}>
              {url}
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied ? t('common.copied') : t('share.copy')}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="whatsapp"
              disabled={info.expired}
              onClick={() => window.open(whatsappLink(null, guestT('share.whatsappMessage', { eventTitle: event.title, url })), '_blank', 'noopener,noreferrer')}
            >
              {t('share.whatsapp')}
            </Button>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-sand/80 hover:text-ink">
              <ExternalLink aria-hidden className="size-4" />
              {t('share.open')}
            </a>
          </div>

          <ul className="mt-4 space-y-1.5 text-sm text-stone-600">
            {info.hasPin ? (
              <li className="flex items-center gap-2">
                <KeyRound aria-hidden className="size-4 text-gold-600" />
                {t('share.pin')}
              </li>
            ) : null}
            <li className="flex flex-wrap items-center gap-x-2">
              <Check aria-hidden className={`size-4 ${info.registrationOpen ? 'text-emerald-700' : 'text-stone-400'}`} />
              {info.registrationOpen ? t('share.registration.on') : t('share.registration.off')}
              {can(event, 'guest.read') ? (
                <Link href={`${base}/registrations`} className="font-medium text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
                  {t('share.registration.manage')}
                </Link>
              ) : null}
            </li>
          </ul>

          {info.mode === 'SECRET_TOKEN' ? (
            <div className="mt-4 rounded-2xl border border-gold-200/80 bg-sand/40 p-4">
              <p className={`flex items-center gap-2 text-sm font-medium ${info.expired ? 'text-red-700' : 'text-ink'}`}>
                <CalendarClock aria-hidden className="size-4" />
                {info.expired ? t('share.expired', { date: expiresLabel ?? '' }) : t('share.expires', { date: expiresLabel ?? '' })}
              </p>
              {canEdit ? (
                editing ? (
                  <form
                    className="mt-3 flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!date) return;
                      const end = new Date(`${date}T23:59:59`);
                      void run(() => apiPut(`/events/${event.id}/share-link/expiry`, { expiresAt: end.toISOString() }));
                    }}
                  >
                    <label className="text-sm">
                      <span className="mb-1 block font-medium text-stone-700">{t('share.expiryLabel')}</span>
                      <Input type="date" value={date} min={dateValue(new Date(Date.now() + 86_400_000).toISOString())} onChange={(e) => setDate(e.target.value)} className="min-h-10" />
                    </label>
                    <Button type="submit" size="sm" disabled={busy || !date}>
                      {t('share.saveExpiry')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      {t('common.cancel')}
                    </Button>
                  </form>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setDate(dateValue(info.expiresAt));
                        setEditing(true);
                      }}
                    >
                      <CalendarClock aria-hidden className="size-4" />
                      {t('share.changeExpiry')}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm(t('share.confirmRotate')) && void run(() => apiPost(`/events/${event.id}/share-link/rotate`))}>
                      <RefreshCw aria-hidden className="size-4" />
                      {t('share.rotate')}
                    </Button>
                  </div>
                )
              ) : null}
            </div>
          ) : null}

          {compact ? null : <p className="mt-4 text-xs text-stone-500">{t('share.personalOptional')}</p>}
        </div>
      </div>
    </Card>
  );
}
