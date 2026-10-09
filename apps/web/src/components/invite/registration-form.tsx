'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { formatEventDateWithWeekday } from '@bulava/localization';
import { Alert, Button, Input } from '@/components/ui/primitives';
import { PhoneInput } from '@/components/ui/phone-input';
import { apiPost } from '@/lib/api';
import { errorMessage, I18nProvider, useI18n } from '@/lib/i18n';
import type { PublicRegistrationInfo } from '@/lib/types';
import { QuestionInput, type AnswerValue, type Question } from './rsvp-form';

type Result = { status: 'CONFIRMED' | 'PENDING' | 'WAITLISTED'; invitationUrl: string | null };

function localized(text: Record<string, string>, language: string): string {
  return text[language] ?? text[language.split('-')[0] ?? ''] ?? text.en ?? Object.values(text)[0] ?? '';
}

function RegistrationInner({ slug, info, timeZone }: { slug: string; info: PublicRegistrationInfo; timeZone: string }) {
  const { t, language } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Registration fields share the RSVP question renderer once their labels are resolved.
  const questions = useMemo<Question[]>(
    () =>
      info.fields.map((f) => ({
        id: f.key,
        key: f.key,
        label: localized(f.label, language),
        type: f.type,
        required: f.required,
        options: f.options.map((o) => ({ value: o.value, label: localized(o.label, language) })),
      })),
    [info.fields, language],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() && !phone.trim()) {
      setError(t('register.contactHint'));
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<Result>(`/public/events/${encodeURIComponent(slug)}/register`, {
        name,
        email: email.trim(),
        phone: phone.trim(),
        answers,
        preferredLanguage: language,
        consent,
      });
      setResult(res);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center" role="status">
        <p className="text-2xl [font-family:var(--t-heading)]">{t(`register.done.${result.status}`)}</p>
        {result.status === 'CONFIRMED' ? <p className="text-sm text-[var(--t-muted)]">{t('register.done.CONFIRMED.body')}</p> : null}
        {result.invitationUrl ? (
          <a
            href={result.invitationUrl}
            className="inline-flex min-h-12 items-center rounded-full bg-[var(--t-primary)] px-6 text-sm font-semibold text-[var(--t-bg)]"
          >
            {t('register.openInvitation')}
          </a>
        ) : null}
      </div>
    );
  }

  if (!info.open) {
    return <p className="mx-auto max-w-md text-center text-[var(--t-muted)]">{info.full ? t('register.full') : t('register.closed')}</p>;
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 text-left" noValidate>
      <p className="text-center text-sm text-[var(--t-muted)]">{t('register.intro')}</p>
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        {info.spotsLeft !== null && !info.full ? (
          <span className="rounded-full bg-[var(--t-surface)] px-3 py-1">{t('register.spotsLeft', { count: info.spotsLeft })}</span>
        ) : null}
        {info.closesAt ? (
          <span className="rounded-full bg-[var(--t-surface)] px-3 py-1">
            {t('register.closesAt', { date: formatEventDateWithWeekday(info.closesAt, { language, timeZone }) })}
          </span>
        ) : null}
      </div>
      {info.waitlist ? <Alert tone="info">{t('register.waitlistNote')}</Alert> : null}
      {info.approvalRequired ? <p className="text-center text-xs text-[var(--t-muted)]">{t('register.approvalNote')}</p> : null}
      {error ? <Alert>{error}</Alert> : null}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-700">{t('register.name')} *</span>
        <Input required autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-700">{t('register.email')}</span>
        <Input type="email" autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-700">{t('register.phone')}</span>
        <PhoneInput maxLength={20} value={phone} onChange={setPhone} placeholder="98765 43210" />
        <span className="mt-1 block text-xs text-stone-500">{t('register.contactHint')}</span>
      </label>

      {questions.map((q) => (
        <QuestionInput key={q.key} q={q} value={answers[q.key]} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
      ))}

      <label className="flex items-start gap-3 text-sm text-stone-700">
        <input type="checkbox" required className="mt-0.5 size-5 shrink-0 accent-brand-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{t('register.consent')}</span>
      </label>

      <Button type="submit" size="lg" className="btn-3d-template w-full" disabled={busy || !consent || !name.trim()}>
        {busy ? t('register.sending') : info.waitlist ? t('register.joinWaitlist') : t('register.submit')}
      </Button>
    </form>
  );
}

/** Public registration island, rendered in the template's RSVP slot on /e/[slug]. */
export function RegistrationIsland({ slug, info, language, timeZone }: { slug: string; info: PublicRegistrationInfo; language: string; timeZone: string }) {
  return (
    <I18nProvider language={language}>
      <RegistrationInner slug={slug} info={info} timeZone={timeZone} />
    </I18nProvider>
  );
}
