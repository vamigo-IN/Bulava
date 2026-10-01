'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { cleanField, emptyField, FieldEditor, type FieldDraft, type FieldType } from '@/components/events/field-builder';
import { Alert, Button, Card, EmptyState, Spinner } from '@/components/ui/primitives';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useFunctions, useInvalidateEvent } from '@/lib/queries';

interface RsvpQuestion {
  id: string;
  key: string;
  label: Record<string, string>;
  type: FieldType;
  options: Array<{ value: string; label: Record<string, string> }>;
  required: boolean;
  functionId: string | null;
  sortOrder: number;
}

/** Host editor for custom RSVP questions (meal preference, travel, etc.). */
export function RsvpQuestions({ eventId }: { eventId: string }) {
  const t = useT();
  const questions = useQuery({ queryKey: ['events', eventId, 'rsvp-questions'], queryFn: () => apiGet<RsvpQuestion[]>(`/events/${eventId}/rsvp-questions`) });
  const functions = useFunctions(eventId);
  const [draft, setDraft] = useState<FieldDraft | null>(null);
  const invalidate = useInvalidateEvent(eventId);
  const [error, setError] = useState<string | null>(null);
  const fnList = functions.data?.map((f) => ({ id: f.id, name: f.name })) ?? [];

  async function create() {
    if (!draft) return;
    setError(null);
    try {
      await apiPost(`/events/${eventId}/rsvp-questions`, { ...cleanField(draft), functionId: draft.functionId ?? null, sortOrder: questions.data?.length ?? 0 });
      setDraft(null);
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  return (
    <Card className="space-y-4 rounded-3xl">
      <div>
        <h2 className="font-display text-2xl">{t('rsvpq.title')}</h2>
        <p className="text-sm text-stone-600">{t('rsvpq.subtitle')}</p>
      </div>
      {questions.isPending ? <Spinner label={t('common.loading')} /> : null}
      {questions.data && !questions.data.length && !draft ? <EmptyState>{t('fields.empty')}</EmptyState> : null}
      {questions.data?.map((q) => (
        <ExistingQuestion key={`${q.id}-${JSON.stringify(q)}`} eventId={eventId} question={q} functions={fnList} />
      ))}
      {draft ? (
        <div className="space-y-2">
          <FieldEditor value={draft} onChange={setDraft} functions={fnList} onRemove={() => setDraft(null)} />
          {error ? <Alert>{error}</Alert> : null}
          <Button onClick={create} disabled={!draft.label.en?.trim()}>
            {t('rsvpq.save')}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setDraft(emptyField(questions.data?.map((q) => q.key) ?? []))}>
          + {t('fields.add')}
        </Button>
      )}
    </Card>
  );
}

function ExistingQuestion({ eventId, question, functions }: { eventId: string; question: RsvpQuestion; functions: Array<{ id: string; name: string }> }) {
  const t = useT();
  const invalidate = useInvalidateEvent(eventId);
  const [value, setValue] = useState<FieldDraft>({ ...question });
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const changed = JSON.stringify(cleanField(value)) !== JSON.stringify(cleanField({ ...question }));

  async function save() {
    setMessage(null);
    try {
      const { key: _key, ...rest } = cleanField(value);
      await apiPatch(`/events/${eventId}/rsvp-questions/${question.id}`, { ...rest, functionId: value.functionId ?? null });
      setMessage({ tone: 'success', text: t('rsvpq.saved') });
      await invalidate();
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    }
  }

  async function remove() {
    if (!window.confirm(t('rsvpq.confirmRemove'))) return;
    try {
      await apiDelete(`/events/${eventId}/rsvp-questions/${question.id}`);
      await invalidate();
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    }
  }

  return (
    <div className="space-y-2">
      <FieldEditor value={value} onChange={setValue} keyEditable={false} functions={functions} onRemove={remove} />
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {changed ? (
        <Button size="sm" onClick={save}>
          {t('rsvpq.save')}
        </Button>
      ) : null}
    </div>
  );
}
