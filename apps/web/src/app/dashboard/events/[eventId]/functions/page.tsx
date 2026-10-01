'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { formatEventDateWithWeekday, formatEventTime } from '@bulava/localization';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useEvent, useFunctions, useGroups, useInvalidateEvent } from '@/lib/queries';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui/primitives';
import { FunctionForm, type FunctionPayload } from '@/components/events/function-form';

export default function FunctionsPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const functions = useFunctions(eventId);
  const groups = useGroups(eventId);
  const invalidate = useInvalidateEvent(eventId);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!event.data || functions.isPending || groups.isPending) return <Spinner label={t('common.loading')} />;
  const timeZone = event.data.timezone;
  const groupName = new Map(groups.data?.map((g) => [g.id, g.name]));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await invalidate();
      setEditing(null);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const create = (payload: FunctionPayload) => run(() => apiPost(`/events/${eventId}/functions`, payload));
  const update = (id: string, payload: FunctionPayload) => run(() => apiPatch(`/events/${eventId}/functions/${id}`, payload));
  const remove = (id: string) => run(() => apiDelete(`/events/${eventId}/functions/${id}`));

  return (
    <div className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      {functions.data?.length ? (
        <ul className="space-y-3">
          {functions.data.map((fn) => (
            <li key={fn.id}>
              <Card>
                {editing === fn.id ? (
                  <FunctionForm
                    initial={fn}
                    groups={groups.data ?? []}
                    timeZone={timeZone}
                    submitting={busy}
                    onSubmit={(p) => update(fn.id, p)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{fn.name}</h2>
                        <Badge tone="brand">{t(`access.short.${fn.effectiveAccessMode}`)}</Badge>
                        {fn.status === 'CANCELLED' || fn.status === 'POSTPONED' ? (
                          <Badge tone="warning">{t(`function.status.${fn.status}`)}</Badge>
                        ) : null}
                      </div>
                      {fn.startsAt ? (
                        <p className="mt-1 text-sm text-stone-600">
                          {formatEventDateWithWeekday(fn.startsAt, { language: 'en', timeZone })} ·{' '}
                          {formatEventTime(fn.startsAt, { language: 'en', timeZone })}
                        </p>
                      ) : null}
                      {fn.venue ? <p className="text-sm text-stone-600">{fn.venue.name}</p> : null}
                      <p className="mt-2 text-xs text-stone-500">
                        {t('function.field.audienceGroups')}:{' '}
                        {fn.audienceGroupIds.length
                          ? fn.audienceGroupIds.map((id) => groupName.get(id)).join(', ')
                          : t('common.none')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(fn.id)}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="danger" size="sm" disabled={busy} onClick={() => remove(fn.id)}>
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{t('function.empty')}</EmptyState>
      )}

      {editing === 'new' ? (
        <Card>
          <FunctionForm
            groups={groups.data ?? []}
            timeZone={timeZone}
            submitting={busy}
            onSubmit={create}
            onCancel={() => setEditing(null)}
          />
        </Card>
      ) : (
        <Button onClick={() => setEditing('new')}>{t('function.add')}</Button>
      )}
    </div>
  );
}
