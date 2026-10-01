'use client';

import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CreateGroupSchema } from '@bulava/validation';
import { apiDelete, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useGroups, useInvalidateEvent } from '@/lib/queries';
import { Alert, Badge, Button, Card, Field, Input, Spinner } from '@/components/ui/primitives';

export default function GroupsPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const groups = useGroups(eventId);
  const invalidate = useInvalidateEvent(eventId);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!CreateGroupSchema.safeParse({ name }).success) return;
    void run(async () => {
      await apiPost(`/events/${eventId}/groups`, { name });
      setName('');
    });
  };

  if (groups.isPending) return <Spinner label={t('common.loading')} />;

  return (
    <div className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {groups.data?.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <span className="font-medium">{g.name}</span>{' '}
              {g.kind === 'SYSTEM' ? <Badge>{g.slug}</Badge> : null}
              <p className="text-sm text-stone-500">{t('group.memberCount', { count: g.memberCount })}</p>
            </div>
            {g.kind === 'CUSTOM' ? (
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => run(() => apiDelete(`/events/${eventId}/groups/${g.id}`))}
              >
                {t('common.delete')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Card>
        <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label={t('group.field.name')}>
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bride Family" />}
            </Field>
          </div>
          <Button type="submit" disabled={busy || !name.trim()}>
            {t('group.add')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
