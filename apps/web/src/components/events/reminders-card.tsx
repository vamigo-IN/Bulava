'use client';

import { BellRing, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatEventDateWithWeekday, formatEventTime, utcToZonedWallTime, zonedWallTimeToUtcIso, type MessageKey } from '@bulava/localization';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner } from '@/components/ui/primitives';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';

interface ReminderState {
  rsvpReminderAt: string | null;
  rsvpReminderSentAt: string | null;
  rsvpReminderRecipients: number | null;
  functionReminderHours: number | null;
  pendingGuests: number;
  /** Where reminders go: WhatsApp is on when the platform and the event's plan allow it. */
  channels?: { email: boolean; whatsapp: boolean };
  upcoming: Array<{ functionId: string; name: string; startsAt: string; remindAt: string | null; sent: boolean }>;
}

const HOUR_CHOICES = [3, 12, 24, 48] as const;

type Message = { tone: 'success' | 'danger'; text: string } | null;

/** Automatic email reminders: nudge guests who have not replied, and remind guests before each function. */
export function RemindersCard({ eventId, timeZone, language }: { eventId: string; timeZone: string; language: string }) {
  const t = useT();
  const state = useQuery({ queryKey: ['events', eventId, 'reminders'], queryFn: () => apiGet<ReminderState>(`/events/${eventId}/reminders`) });
  // Kept here so the confirmation survives the editor remounting with fresh data.
  const [message, setMessage] = useState<Message>(null);
  if (state.isPending) return <Spinner label={t('common.loading')} />;
  if (!state.data) return <Alert>{errorMessage(t, state.error)}</Alert>;
  return (
    <Editor
      key={JSON.stringify(state.data)}
      eventId={eventId}
      state={state.data}
      timeZone={timeZone}
      language={language}
      message={message}
      setMessage={setMessage}
      onSaved={() => void state.refetch()}
    />
  );
}

function Editor({
  eventId,
  state,
  timeZone,
  language,
  message,
  setMessage,
  onSaved,
}: {
  eventId: string;
  state: ReminderState;
  timeZone: string;
  language: string;
  message: Message;
  setMessage: (m: Message) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [at, setAt] = useState(state.rsvpReminderAt && !state.rsvpReminderSentAt ? utcToZonedWallTime(state.rsvpReminderAt, timeZone) : '');
  const [hours, setHours] = useState(state.functionReminderHours ? String(state.functionReminderHours) : '');
  const [busy, setBusy] = useState(false);
  const when = (iso: string) => `${formatEventDateWithWeekday(iso, { language, timeZone })}, ${formatEventTime(iso, { language, timeZone })}`;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'success', text: success });
      onSaved();
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  }

  const save = (rsvpAt: string, reminderHours: string) =>
    run(
      () =>
        apiPut(`/events/${eventId}/reminders`, {
          // Keep an already-sent reminder's time unless the host picks a new one.
          rsvpReminderAt: rsvpAt ? zonedWallTimeToUtcIso(rsvpAt, timeZone) : state.rsvpReminderSentAt ? state.rsvpReminderAt : null,
          functionReminderHours: reminderHours ? Number(reminderHours) : null,
        }),
      t('rem.saved'),
    );

  const scheduled = state.rsvpReminderAt && !state.rsvpReminderSentAt;

  return (
    <Card className="space-y-5 rounded-3xl">
      <div>
        <h2 className="flex items-center gap-2.5 font-display text-2xl">
          <BellRing aria-hidden className="size-5 text-gold-600" />
          {t('rem.title')}
        </h2>
        <p className="text-sm text-stone-600">{t('rem.subtitle')}</p>
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <section className="space-y-3">
        <h3 className="font-semibold">{t('rem.rsvp.title')}</h3>
        <p className="text-sm text-stone-600">
          {t(state.channels?.whatsapp ? 'rem.rsvp.pendingWhatsApp' : 'rem.rsvp.pending', { count: state.pendingGuests })}
        </p>
        {state.channels?.whatsapp ? <p className="text-xs text-stone-500">{t('rem.whatsappNote')}</p> : null}
        {state.rsvpReminderSentAt ? (
          <p className="text-sm">
            <Badge tone="success">
              <Check aria-hidden className="size-3" strokeWidth={3} />
              {t('rem.rsvp.sent', { when: when(state.rsvpReminderSentAt), count: state.rsvpReminderRecipients ?? 0 })}</Badge>
          </p>
        ) : scheduled ? (
          <p className="text-sm">
            <Badge tone="brand">⏰ {t('rem.rsvp.scheduled', { when: when(state.rsvpReminderAt!) })}</Badge>
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('rem.rsvp.at')}>
            {(p) => <Input {...p} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="w-auto" />}
          </Field>
          <Button disabled={busy} onClick={() => void save(at, hours)}>
            {t('rem.rsvp.schedule')}
          </Button>
          {scheduled ? (
            <Button variant="ghost" disabled={busy} onClick={() => void save('', hours).then(() => setAt(''))}>
              {t('rem.rsvp.cancel')}
            </Button>
          ) : null}
          <Button variant="secondary" disabled={busy || state.pendingGuests === 0} onClick={() => void run(() => apiPost(`/events/${eventId}/reminders/rsvp/send-now`), t('rem.rsvp.queued'))}>
            {t('rem.rsvp.now')}
          </Button>
        </div>
      </section>

      <section className="space-y-3 border-t border-gold-100 pt-4">
        <h3 className="font-semibold">{t('rem.fn.title')}</h3>
        <label className="flex max-w-xs flex-col gap-1 text-sm">
          {t('rem.fn.when')}
          <Select
            value={hours}
            disabled={busy}
            onChange={(e) => {
              setHours(e.target.value);
              void save(at, e.target.value);
            }}
          >
            <option value="">{t('rem.fn.off')}</option>
            {HOUR_CHOICES.map((h) => (
              <option key={h} value={h}>
                {t(`rem.fn.h${h}` as MessageKey)}
              </option>
            ))}
          </Select>
        </label>
        {state.functionReminderHours && state.upcoming.length ? (
          <ul className="space-y-1 text-sm text-stone-600">
            {state.upcoming.map((f) => (
              <li key={f.functionId}>
                <span className="font-medium text-stone-800">{f.name}</span> · {f.sent ? `✓ ${t('rem.fn.sent')}` : f.remindAt ? t('rem.fn.at', { when: when(f.remindAt) }) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <p className="text-xs text-stone-500">{t('rem.note')}</p>
    </Card>
  );
}
