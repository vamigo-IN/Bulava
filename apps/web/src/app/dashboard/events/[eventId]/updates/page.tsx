'use client';

import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiDelete, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useAnnouncements, useFunctions, useGroups, useInvalidateEvent } from '@/lib/queries';
import { Alert, Button, Card, Checkbox, EmptyState, Field, Input, Select, Spinner, Textarea } from '@/components/ui/primitives';

type AudienceKind = 'all' | 'function' | 'group';

export default function UpdatesPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const list = useAnnouncements(eventId);
  const functions = useFunctions(eventId);
  const groups = useGroups(eventId);
  const invalidate = useInvalidateEvent(eventId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<AudienceKind>('all');
  const [target, setTarget] = useState('');
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const functionName = new Map(functions.data?.map((f) => [f.id, f.name]));
  const groupName = new Map(groups.data?.map((g) => [g.id, g.name]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const audience = kind === 'all' ? { all: true } : kind === 'function' ? { functionIds: [target] } : { groupIds: [target] };
    try {
      const res = await apiPost<{ recipients: number }>(`/events/${eventId}/announcements`, { title, body, audience, publish: true, notifyByEmail: email });
      setMessage({ tone: 'success', text: t('updates.sent', { count: res.recipients }) });
      setTitle('');
      setBody('');
      await invalidate();
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-3xl">{t('updates.title')}</h2>
          <p className="mt-1 text-stone-600">{t('updates.subtitle')}</p>
        </div>
        {list.isPending ? (
          <Spinner label={t('common.loading')} />
        ) : list.data?.length ? (
          <ul className="space-y-3">
            {list.data.map((a) => (
              <li key={a.id} className="rounded-2xl border-l-4 border-gold-500 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl">{a.title}</p>
                    <p className="text-xs text-stone-500">
                      {a.audience.all
                        ? t('updates.audience.all')
                        : a.audience.functionIds
                          ? a.audience.functionIds.map((id) => functionName.get(id)).join(', ')
                          : a.audience.groupIds?.map((id) => groupName.get(id)).join(', ')}
                      {a.publishedAt ? ` · ${new Date(a.publishedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => apiDelete(`/events/${eventId}/announcements/${a.id}`).then(invalidate)}>
                    {t('common.delete')}
                  </Button>
                </div>
                <p className="mt-2 text-sm whitespace-pre-line text-stone-700">{a.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{t('updates.empty')}</EmptyState>
        )}
      </section>

      <Card className="rounded-3xl xl:sticky xl:top-24 xl:self-start">
        <h3 className="mb-4 font-display text-2xl">{t('updates.new')}</h3>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('updates.field.title')}>{(p) => <Input {...p} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Venue changed" />}</Field>
          <Field label={t('updates.field.body')}>{(p) => <Textarea {...p} rows={5} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />}</Field>
          <Field label={t('updates.audience')}>
            {(p) => (
              <Select
                {...p}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as AudienceKind);
                  setTarget('');
                }}
              >
                <option value="all">{t('updates.audience.all')}</option>
                <option value="function">{t('updates.audience.function')}</option>
                <option value="group">{t('updates.audience.group')}</option>
              </Select>
            )}
          </Field>
          {kind !== 'all' ? (
            <Select aria-label={t('updates.audience')} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">—</option>
              {(kind === 'function' ? functions.data : groups.data)?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Checkbox label={t('updates.email')} checked={email} onChange={(e) => setEmail(e.target.checked)} />
          {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
          <Button type="submit" className="w-full rounded-full" disabled={busy || !title.trim() || !body.trim() || (kind !== 'all' && !target)}>
            {t('updates.send')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
