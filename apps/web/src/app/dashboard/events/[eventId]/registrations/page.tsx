'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { formatEventDateWithWeekday, utcToZonedWallTime, zonedWallTimeToUtcIso } from '@bulava/localization';
import { cleanField, emptyField, FieldEditor, type FieldDraft } from '@/components/events/field-builder';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Spinner } from '@/components/ui/primitives';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useEvent, useInvalidateEvent } from '@/lib/queries';

type RegStatus = 'PENDING' | 'CONFIRMED' | 'WAITLISTED' | 'REJECTED' | 'CANCELLED';
type Decision = 'CONFIRM' | 'WAITLIST' | 'REJECT' | 'CANCEL';

interface RegistrationState {
  settings: {
    enabled: boolean;
    fields: FieldDraft[];
    maxRegistrations: number | null;
    approvalRequired: boolean;
    waitlistEnabled: boolean;
    closesAt: string | null;
  };
  available: boolean;
  accessMode: string;
  slug: string;
  counts: Partial<Record<RegStatus, number>>;
}

interface RegistrationRow {
  id: string;
  status: RegStatus;
  answers: Record<string, unknown>;
  createdAt: string;
  guest: { id: string; name: string; email: string | null; phone: string | null };
}

const STATUSES: RegStatus[] = ['PENDING', 'CONFIRMED', 'WAITLISTED', 'REJECTED', 'CANCELLED'];
const TONE = { PENDING: 'warning', CONFIRMED: 'success', WAITLISTED: 'brand', REJECTED: 'danger', CANCELLED: 'neutral' } as const;
const ACTIONS: Record<RegStatus, Decision[]> = {
  PENDING: ['CONFIRM', 'WAITLIST', 'REJECT'],
  WAITLISTED: ['CONFIRM', 'REJECT'],
  CONFIRMED: ['CANCEL'],
  REJECTED: [],
  CANCELLED: [],
};

export default function RegistrationsPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const state = useQuery({ queryKey: ['events', eventId, 'registration'], queryFn: () => apiGet<RegistrationState>(`/events/${eventId}/registration`) });
  const [filter, setFilter] = useState<RegStatus | ''>('');
  const list = useQuery({
    queryKey: ['events', eventId, 'registrations', filter],
    queryFn: () => apiGet<RegistrationRow[]>(`/events/${eventId}/registrations${filter ? `?status=${filter}` : ''}`),
  });

  if (state.isPending || event.isPending) return <Spinner label={t('common.loading')} />;
  if (!state.data || !event.data) return <Alert>{errorMessage(t, state.error ?? event.error)}</Alert>;
  const timeZone = event.data.timezone;
  const total = Object.values(state.data.counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-3xl">{t('reg.title')}</h2>
          <p className="mt-1 text-stone-600">{t('reg.subtitle')}</p>
        </div>
        {!state.data.available ? (
          <Alert tone="info">
            {t('reg.notAvailable')}{' '}
            <Link href={`/dashboard/events/${eventId}/settings`} className="font-medium underline">
              {t('dash.nav.settings')}
            </Link>
          </Alert>
        ) : null}
        <SettingsForm key={JSON.stringify(state.data.settings)} eventId={eventId} state={state.data} timeZone={timeZone} published={event.data.status !== 'DRAFT'} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">{t('reg.list')}</h2>
        <div role="tablist" className="flex flex-wrap gap-2">
          {(['', ...STATUSES] as const).map((s) => (
            <button
              key={s || 'all'}
              type="button"
              role="tab"
              aria-selected={filter === s}
              onClick={() => setFilter(s)}
              className={`min-h-9 rounded-full border px-3 text-sm ${filter === s ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
            >
              {s ? t(`reg.status.${s}`) : t('reg.filter.all')} ({s ? (state.data.counts[s] ?? 0) : total})
            </button>
          ))}
        </div>
        {list.isPending ? (
          <Spinner label={t('common.loading')} />
        ) : list.data?.length ? (
          <ul className="space-y-3">
            {list.data.map((row) => (
              <RegistrationCard key={row.id} eventId={eventId} row={row} timeZone={timeZone} language={event.data.language} />
            ))}
          </ul>
        ) : (
          <EmptyState>{t('reg.empty')}</EmptyState>
        )}
      </section>
    </div>
  );
}

function SettingsForm({ eventId, state, timeZone, published }: { eventId: string; state: RegistrationState; timeZone: string; published: boolean }) {
  const t = useT();
  const invalidate = useInvalidateEvent(eventId);
  const s = state.settings;
  const [enabled, setEnabled] = useState(s.enabled);
  const [max, setMax] = useState(s.maxRegistrations ? String(s.maxRegistrations) : '');
  const [approval, setApproval] = useState(s.approvalRequired);
  const [waitlist, setWaitlist] = useState(s.waitlistEnabled);
  const [closesAt, setClosesAt] = useState(s.closesAt ? utcToZonedWallTime(s.closesAt, timeZone) : '');
  const [fields, setFields] = useState<FieldDraft[]>(s.fields);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const pageUrl = `${origin}/e/${state.slug}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiPut(`/events/${eventId}/registration`, {
        enabled,
        fields: fields.map(cleanField),
        maxRegistrations: max ? Number(max) : null,
        approvalRequired: approval,
        waitlistEnabled: waitlist,
        closesAt: closesAt ? zonedWallTimeToUtcIso(closesAt, timeZone) : null,
      });
      setMessage({ tone: 'success', text: t('reg.saved') });
      await invalidate();
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 rounded-3xl">
      <form onSubmit={save} className="space-y-4">
        <h3 className="font-semibold">{t('reg.settings')}</h3>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        <Checkbox label={t('reg.enabled')} checked={enabled} disabled={!state.available && !enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {enabled && !published ? <p className="rounded-xl bg-gold-100/60 p-3 text-sm text-stone-700">{t('reg.linkAfterPublish')}</p> : null}
        {enabled && published ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gold-100/60 p-3 text-sm">
            <span className="font-medium">{t('reg.pageLink')}:</span>
            <a href={pageUrl} target="_blank" rel="noreferrer" className="break-all text-brand-700 underline">
              {pageUrl}
            </a>
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(pageUrl)}>
              {t('reg.copyLink')}
            </Button>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('reg.max')} hint={t('reg.maxHint')}>
            {(p) => <Input {...p} type="number" min={1} max={100000} value={max} onChange={(e) => setMax(e.target.value)} />}
          </Field>
          <Field label={t('reg.closesAt')} hint={t('reg.closesAtHint')}>
            {(p) => <Input {...p} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />}
          </Field>
        </div>
        <Checkbox label={t('reg.approval')} checked={approval} onChange={(e) => setApproval(e.target.checked)} />
        <Checkbox label={t('reg.waitlist')} checked={waitlist} onChange={(e) => setWaitlist(e.target.checked)} />

        <div className="space-y-3">
          <div>
            <h4 className="font-semibold">{t('reg.fields')}</h4>
            <p className="text-sm text-stone-500">{t('reg.fieldsHint')}</p>
          </div>
          {fields.map((f, i) => (
            <FieldEditor
              key={i}
              value={f}
              onChange={(next) => setFields((all) => all.map((x, j) => (j === i ? next : x)))}
              onRemove={() => setFields((all) => all.filter((_, j) => j !== i))}
            />
          ))}
          <Button variant="secondary" size="sm" disabled={fields.length >= 20} onClick={() => setFields((all) => [...all, emptyField(all.map((x) => x.key))])}>
            + {t('fields.add')}
          </Button>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? t('common.saving') : t('reg.save')}
        </Button>
      </form>
    </Card>
  );
}

function RegistrationCard({ eventId, row, timeZone, language }: { eventId: string; row: RegistrationRow; timeZone: string; language: string }) {
  const t = useT();
  const invalidate = useInvalidateEvent(eventId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answers = Object.entries(row.answers ?? {});

  async function decide(decision: Decision) {
    if (decision === 'CANCEL' && !window.confirm(t('reg.confirmCancel'))) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/events/${eventId}/registrations/${row.id}/decision`, { decision });
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{row.guest.name}</p>
          <p className="text-sm break-all text-stone-500">{[row.guest.email, row.guest.phone].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-stone-500">{t('reg.registeredAt', { date: formatEventDateWithWeekday(row.createdAt, { language, timeZone }) })}</p>
        </div>
        <Badge tone={TONE[row.status]}>{t(`reg.status.${row.status}`)}</Badge>
      </div>
      {answers.length ? (
        <dl className="mt-3 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {answers.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="font-mono text-xs text-stone-500">{key}</dt>
              <dd>{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? t('common.yes') : t('common.no')) : String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {ACTIONS[row.status].length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIONS[row.status].map((d) => (
            <Button key={d} size="sm" variant={d === 'CONFIRM' ? 'primary' : d === 'REJECT' || d === 'CANCEL' ? 'danger' : 'secondary'} disabled={busy} onClick={() => decide(d)}>
              {t(`reg.action.${d}`)}
            </Button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
