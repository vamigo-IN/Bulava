'use client';

import { useParams } from 'next/navigation';
import { useT } from '@/lib/i18n';
import { useEvent, useRsvps, useRsvpSummary } from '@/lib/queries';
import { RemindersCard } from '@/components/events/reminders-card';
import { RsvpQuestions } from '@/components/events/rsvp-questions';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui/primitives';

const TONE = { ATTENDING: 'success', DECLINED: 'danger', MAYBE: 'warning', PENDING: 'neutral' } as const;

export default function RsvpsPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const summary = useRsvpSummary(eventId);
  const rsvps = useRsvps(eventId);
  const event = useEvent(eventId);

  if (summary.isPending || rsvps.isPending) return <Spinner label={t('common.loading')} />;

  return (
    <div className="space-y-5">
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="mb-2 font-semibold">
          {t('rsvp.summary.title')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.data?.functions.map((fn) => (
            <Card key={fn.functionId}>
              <h3 className="font-medium">{fn.name}</h3>
              <p className="mt-2 text-3xl font-semibold text-brand-700">{fn.headcount}</p>
              <p className="text-xs text-stone-500">{t('rsvp.summary.headcount')}</p>
              <dl className="mt-3 grid grid-cols-2 gap-1 text-sm">
                <dt className="text-stone-500">{t('rsvp.summary.invited')}</dt>
                <dd>{fn.invited}</dd>
                <dt className="text-stone-500">{t('rsvp.status.ATTENDING')}</dt>
                <dd>{fn.attending}</dd>
                <dt className="text-stone-500">{t('rsvp.status.DECLINED')}</dt>
                <dd>{fn.declined}</dd>
                <dt className="text-stone-500">{t('rsvp.status.MAYBE')}</dt>
                <dd>{fn.maybe}</dd>
                <dt className="text-stone-500">{t('rsvp.status.PENDING')}</dt>
                <dd>{fn.pending}</dd>
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t('dashboard.nav.rsvps')}</h2>
        {rsvps.data?.length ? (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {rsvps.data.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{r.guest.name}</span>
                  <Badge tone={TONE[r.status]}>{t(`rsvp.status.${r.status}`)}</Badge>
                </div>
                <p className="text-sm text-stone-600">
                  {r.function?.name ?? t('invitation.scope.event')} · {r.attendeeCount}
                  {Object.keys(r.answers).length
                    ? ` · ${Object.entries(r.answers)
                        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                        .join(' · ')}`
                    : ''}
                </p>
                {r.message ? <p className="mt-1 text-sm italic text-stone-500">“{r.message}”</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{t('rsvp.status.PENDING')}</EmptyState>
        )}
      </section>

      {event.data ? <RemindersCard eventId={eventId} timeZone={event.data.timezone} language={event.data.language} /> : null}
      <RsvpQuestions eventId={eventId} />
    </div>
  );
}
