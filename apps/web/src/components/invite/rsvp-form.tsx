'use client';

import { useState, type FormEvent } from 'react';
import { apiPost } from '@/lib/api';
import { errorMessage, useI18n } from '@/lib/i18n';
import type { GuestInvitationView } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, Button, Input, Select, Textarea } from '@/components/ui/primitives';

type Choice = 'ATTENDING' | 'DECLINED' | 'MAYBE';
export type AnswerValue = string | number | boolean | string[];
interface Draft {
  status: Choice | null;
  attendeeCount: number;
  answers: Record<string, AnswerValue>;
}
export type Question = GuestInvitationView['functions'][number]['questions'][number];

const EVENT_KEY = 'EVENT';

function initialDrafts(view: GuestInvitationView): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const fn of view.functions) {
    drafts[fn.id] = {
      status: fn.rsvp && fn.rsvp.status !== 'PENDING' ? (fn.rsvp.status as Choice) : null,
      attendeeCount: Math.max(1, fn.rsvp?.attendeeCount ?? 1),
      answers: (fn.rsvp?.answers as Record<string, AnswerValue>) ?? {},
    };
  }
  drafts[EVENT_KEY] = {
    status: view.eventRsvp && view.eventRsvp.status !== 'PENDING' ? (view.eventRsvp.status as Choice) : null,
    attendeeCount: Math.max(1, view.eventRsvp?.attendeeCount ?? 1),
    answers: {},
  };
  return drafts;
}

function ChoiceButtons({ value, onChange, name }: { value: Choice | null; onChange: (c: Choice) => void; name: string }) {
  const { t } = useI18n();
  const options: Array<{ value: Choice; label: string; active: string }> = [
    { value: 'ATTENDING', label: t('rsvp.attending'), active: 'border-[var(--t-primary,#5b0e1b)] bg-[var(--t-primary,#5b0e1b)] text-[var(--t-bg,#fff)]' },
    { value: 'MAYBE', label: t('rsvp.maybe'), active: 'border-[var(--t-primary,#5b0e1b)] bg-[var(--t-primary,#5b0e1b)] text-[var(--t-bg,#fff)]' },
    { value: 'DECLINED', label: t('rsvp.declined'), active: 'border-stone-600 bg-stone-600 text-white' },
  ];
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-12 rounded-xl border px-4 text-left text-base font-medium transition-colors',
            value === o.value ? o.active : 'border-[var(--t-secondary,#d6d3d1)]/60 bg-white text-stone-800 hover:bg-stone-50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-stone-700">{label}</p>
      <div className="flex items-center gap-3">
        <Button variant="secondary" aria-label="−" disabled={value <= 1} onClick={() => onChange(value - 1)} className="w-12">
          −
        </Button>
        <output className="w-8 text-center text-xl font-semibold" aria-live="polite">
          {value}
        </output>
        <Button variant="secondary" aria-label="+" disabled={value >= max} onClick={() => onChange(value + 1)} className="w-12">
          +
        </Button>
        <span className="text-sm text-stone-500">{t('rsvp.attendeeLimit', { count: max })}</span>
      </div>
    </div>
  );
}

export function QuestionInput({ q, value, onChange }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void }) {
  const { t } = useI18n();
  const label = `${q.label}${q.required ? ' *' : ''}`;
  switch (q.type) {
    case 'SINGLE_CHOICE':
      return (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
          <Select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {q.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      );
    case 'MULTI_CHOICE': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-stone-700">{label}</legend>
          {q.options.map((o) => (
            <label key={o.value} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-brand-700"
                checked={selected.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      );
    }
    case 'BOOLEAN':
      return (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
          <Select
            value={value === true ? 'yes' : value === false ? 'no' : ''}
            onChange={(e) => onChange(e.target.value === 'yes')}
          >
            <option value="">—</option>
            <option value="yes">{t('common.yes')}</option>
            <option value="no">{t('common.no')}</option>
          </Select>
        </label>
      );
    case 'NUMBER':
      return (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
          <Input
            type="number"
            inputMode="numeric"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </label>
      );
    default:
      return (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
          <Input value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
  }
}

export function RsvpForm({
  token,
  view,
  onSaved,
  bare = false,
}: {
  token: string;
  view: GuestInvitationView;
  onSaved: (view: GuestInvitationView) => void;
  /** Render without the card and heading (inside a template section that has its own). */
  bare?: boolean;
}) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState(() => initialDrafts(view));
  const [message, setMessage] = useState(view.message ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openFunctions = view.functions.filter((f) => f.rsvpOpen);
  const useEventLevel = view.functions.length === 0 && view.eventRsvpOpen;
  if (openFunctions.length === 0 && !useEventLevel) return null;

  const hasPrevious = view.functions.some((f) => f.rsvp) || view.eventRsvp !== null;
  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [key]: { ...d[key]!, ...patch } }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const keys = useEventLevel ? [EVENT_KEY] : openFunctions.map((f) => f.id);
    const responses = keys
      .filter((k) => drafts[k]?.status)
      .map((k) => ({
        functionId: k === EVENT_KEY ? null : k,
        status: drafts[k]!.status!,
        attendeeCount: drafts[k]!.status === 'DECLINED' ? 0 : drafts[k]!.attendeeCount,
        answers: drafts[k]!.status === 'DECLINED' ? {} : drafts[k]!.answers,
      }));
    // The API validates everything (RSVPSubmitSchema); the guest bundle stays free of zod.
    if (responses.length === 0) {
      setError(t('rsvp.chooseOne'));
      return;
    }
    setSubmitting(true);
    try {
      const next = await apiPost<GuestInvitationView>(`/public/invitations/${token}/rsvp`, {
        responses,
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      onSaved(next);
      setDrafts(initialDrafts(next));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  };

  const section = (key: string, title: string | null, limit: number, questions: Question[]) => {
    const d = drafts[key]!;
    return (
      <div key={key} className="space-y-3 border-b border-stone-100 pb-5 last:border-0 last:pb-0">
        {title ? <h3 className="font-display text-xl">{title}</h3> : null}
        <ChoiceButtons name={title ?? t('rsvp.title')} value={d.status} onChange={(status) => update(key, { status })} />
        {d.status && d.status !== 'DECLINED' ? (
          <>
            {limit > 1 ? (
              <Stepper
                label={t('rsvp.attendeeCount')}
                value={Math.min(d.attendeeCount, limit)}
                max={limit}
                onChange={(attendeeCount) => update(key, { attendeeCount })}
              />
            ) : null}
            {questions.map((q) => (
              <QuestionInput
                key={q.id}
                q={q}
                value={d.answers[q.key]}
                onChange={(v) => update(key, { answers: { ...d.answers, [q.key]: v } })}
              />
            ))}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <section aria-labelledby="rsvp-heading" className={bare ? 'mx-auto max-w-md' : 'rounded-2xl bg-white p-5 shadow-sm'}>
      <h2 id="rsvp-heading" className={bare ? 'sr-only' : 'mb-4 text-center font-display text-2xl text-brand-700'}>
        {t('rsvp.title')}
      </h2>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {useEventLevel
          ? section(EVENT_KEY, null, 1, [])
          : openFunctions.map((fn) => section(fn.id, fn.name, fn.attendeeLimit, fn.questions))}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">
            {t('rsvp.message')} <span className="font-normal text-stone-500">({t('common.optional')})</span>
          </span>
          <Textarea value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
        </label>
        {error ? <Alert>{error}</Alert> : null}
        {saved ? <Alert tone="success">{t('rsvp.thanks')}</Alert> : null}
        <Button type="submit" size="lg" className="btn-3d-template w-full rounded-full" disabled={submitting}>
          {submitting ? t('common.saving') : hasPrevious ? t('rsvp.update') : t('rsvp.submit')}
        </Button>
      </form>
    </section>
  );
}
