'use client';

import { Download } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MessageKey } from '@bulava/localization';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useEvent, useInvalidateEvent, useLanguages } from '@/lib/queries';
import type { AccessMode, EventSummary } from '@/lib/types';
import { AccessOptions } from '@/components/events/access-options';
import { TeamCard } from '@/components/events/team-card';
import { DomainCard } from '@/components/events/domain-card';
import { Alert, Button, Card, Checkbox, Field, Input, Select, Spinner } from '@/components/ui/primitives';

const EXPORTS = ['guests', 'rsvps', 'invitations', 'attendance', 'media'] as const;

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const client = useQueryClient();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const invalidate = useInvalidateEvent(eventId);
  const [pin, setPin] = useState('');
  const [cloneTitle, setCloneTitle] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  if (!event.data) return <Spinner label={t('common.loading')} />;
  const e = event.data;

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setMessage(null);
    try {
      await fn();
      await invalidate();
      if (success) setMessage({ tone: 'success', text: success });
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="font-display text-3xl">{t('settings.title')}</h2>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <GeneralCard event={e} run={run} />

      <Card className="space-y-4 rounded-3xl">
        <div>
          <h3 className="font-display text-2xl">{t('settings.access')}</h3>
          <p className="mt-1 text-sm text-stone-600">{e.status === 'DRAFT' ? t('settings.access.draft') : t('settings.access.live')}</p>
        </div>
        <AccessCard event={e} run={run} />
        <Checkbox label={t('settings.otp')} checked={e.requireOtp} onChange={(ev) => run(() => apiPatch(`/events/${eventId}`, { requireOtp: ev.target.checked }), t('common.save'))} />
        {e.accessMode === 'PUBLIC' ? (
          <Checkbox label={t('settings.visibility')} checked={e.visibility === 'LISTED'} onChange={(ev) => run(() => apiPatch(`/events/${eventId}`, { visibility: ev.target.checked ? 'LISTED' : 'UNLISTED' }))} />
        ) : null}
        {e.accessMode === 'PRIVATE_LINK' ? (
          <div className="rounded-2xl bg-sand/60 p-4">
            <p className="text-sm font-semibold">{t('settings.pin')}</p>
            {e.hasPin ? <p className="text-sm text-stone-600">{t('settings.pin.active')}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Input className="max-w-40" value={pin} onChange={(ev) => setPin(ev.target.value.trim())} maxLength={12} placeholder="4321" aria-label={t('settings.pin')} />
              <Button className="rounded-full" disabled={pin.length < 4} onClick={() => run(() => apiPatch(`/events/${eventId}`, { pin }).then(() => setPin('')), t('settings.pin.active'))}>
                {t('settings.pin.set')}
              </Button>
              {e.hasPin ? (
                <Button variant="ghost" onClick={() => run(() => apiPatch(`/events/${eventId}`, { pin: null }))}>
                  {t('settings.pin.remove')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {e.accessMode === 'PUBLIC' || e.accessMode === 'PRIVATE_LINK' ? (
          <p className="text-sm">
            {t('settings.publicLink')}:{' '}
            <a className="font-medium text-brand-700 underline" href={`/e/${e.slug}`} target="_blank" rel="noreferrer">
              /e/{e.slug}
            </a>
          </p>
        ) : null}
      </Card>

      <Card className="rounded-3xl">
        <h3 className="font-display text-2xl">{t('settings.exports')}</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {EXPORTS.map((kind) => (
            <li key={kind}>
              <a href={`/api/v1/events/${eventId}/exports/${kind}.csv`} className="flex min-h-11 items-center justify-between rounded-xl border border-gold-200 px-4 text-sm hover:border-gold-500">
                {t(`settings.export.${kind}` as MessageKey)}
                <Download aria-hidden className="size-4 text-gold-600" />
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 rounded-3xl">
        <h3 className="font-display text-2xl">{t('settings.status')}</h3>
        <div className="flex flex-wrap gap-2">
          {e.status !== 'COMPLETED' ? (
            <Button variant="secondary" className="rounded-full" onClick={() => run(() => apiPatch(`/events/${eventId}`, { status: 'COMPLETED' }))}>
              {t('settings.complete')}
            </Button>
          ) : null}
          {e.status !== 'ARCHIVED' ? (
            <Button variant="secondary" className="rounded-full" onClick={() => run(() => apiPatch(`/events/${eventId}`, { status: 'ARCHIVED' }))}>
              {t('settings.archive')}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 rounded-3xl">
        <h3 className="font-display text-2xl">{t('settings.clone')}</h3>
        <p className="text-sm text-stone-600">{t('settings.clone.body')}</p>
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-sm" value={cloneTitle} onChange={(ev) => setCloneTitle(ev.target.value)} placeholder={`${e.title} (copy)`} aria-label={t('settings.clone.title')} />
          <Button
            className="rounded-full"
            onClick={() =>
              run(async () => {
                const res = await apiPost<{ id: string }>(`/events/${eventId}/clone`, { title: cloneTitle.trim() || `${e.title} (copy)` });
                await client.invalidateQueries({ queryKey: ['events'] });
                router.push(`/dashboard/events/${res.id}`);
              })
            }
          >
            {t('settings.clone')}
          </Button>
        </div>
      </Card>

      <TeamCard eventId={eventId} myRole={event.data.role ?? 'OWNER'} />
      <DomainCard eventId={eventId} />

      <Card className="space-y-3 rounded-3xl border-red-200">
        <h3 className="font-display text-2xl text-red-800">{t('settings.danger')}</h3>
        <p className="text-sm text-stone-600">{t('settings.delete.body')}</p>
        <Input value={confirm} onChange={(ev) => setConfirm(ev.target.value)} placeholder={e.title} aria-label={t('settings.delete.confirm')} />
        <Button
          variant="danger"
          className="rounded-full"
          disabled={confirm !== e.title}
          onClick={() =>
            run(async () => {
              await apiDelete(`/events/${eventId}`);
              await client.invalidateQueries({ queryKey: ['events'] });
              router.replace('/dashboard');
            })
          }
        >
          {t('settings.delete')}
        </Button>
      </Card>
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, success?: string) => Promise<void>;

/** The event's name and the language of its invitation. */
function GeneralCard({ event, run }: { event: EventSummary; run: Run }) {
  const t = useT();
  const languages = useLanguages();
  const [title, setTitle] = useState(event.title);
  const [language, setLanguage] = useState(event.language);
  useEffect(() => {
    setTitle(event.title);
    setLanguage(event.language);
  }, [event.title, event.language]);
  const dirty = title.trim() !== event.title || language !== event.language;
  return (
    <Card className="space-y-4 rounded-3xl">
      <h3 className="font-display text-2xl">{t('settings.general')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('event.field.title')}>{(p) => <Input {...p} maxLength={160} value={title} onChange={(ev) => setTitle(ev.target.value)} />}</Field>
        <Field label={t('event.field.language')}>
          {(p) => (
            <Select {...p} value={language} onChange={(ev) => setLanguage(ev.target.value)}>
              {languages.data?.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} ({l.name})
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Button className="rounded-2xl" disabled={!dirty || !title.trim()} onClick={() => run(() => apiPatch(`/events/${event.id}`, { title: title.trim(), language }), t('common.saved'))}>
        {t('common.save')}
      </Button>
    </Card>
  );
}

/** Who can open the invitation: chosen when publishing, and changed here afterwards. */
function AccessCard({ event, run }: { event: EventSummary; run: Run }) {
  const t = useT();
  const [mode, setMode] = useState<AccessMode>(event.accessMode);
  useEffect(() => setMode(event.accessMode), [event.accessMode]);
  return (
    <div className="space-y-3">
      <AccessOptions value={mode} onChange={setMode} />
      {mode !== event.accessMode ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-2xl" onClick={() => run(() => apiPatch(`/events/${event.id}`, { accessMode: mode }), t('settings.access.saved'))}>
            {t('settings.access.save')}
          </Button>
          <Button variant="ghost" className="rounded-2xl" onClick={() => setMode(event.accessMode)}>
            {t('common.cancel')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
