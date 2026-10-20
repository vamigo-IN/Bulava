'use client';

import { CalendarDays, CheckCircle2, Clapperboard, Globe2, IdCard, LayoutGrid, MapPin, Plus, Send, Sparkles, Trash2, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { PreviewRequestSchema } from '@bulava/validation';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { occasionIcon } from '@/lib/occasions';
import { PREVIEW_KINDS, type PreviewKind } from '@/lib/previews';
import { useEventTypes, useLanguages } from '@/lib/queries';
import { cardPreview } from '@/lib/template-previews';
import { track } from '@/lib/track';
import type { EventType, Language } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { PhoneInput } from '@/components/ui/phone-input';

const t = createTranslator('en');

const KIND_ICON: Record<PreviewKind, LucideIcon> = { WEBSITE: Globe2, CARD: IdCard, FILM: Clapperboard };
const LINK = 'font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700';

interface FunctionRow {
  id: number;
  name: string;
  date: string;
  time: string;
  venue: string;
}

/** Only same-site API errors carry a code the catalog knows; everything else gets the generic line. */
function message(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `error.${error.code}` as MessageKey;
    const translated = t(key);
    if (translated !== key) return translated;
    if (error.status < 500) return error.message;
  }
  return t('common.error');
}

/** A numbered part of the form. */
function Section({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-gold-200/70 pt-6 first:border-0 first:pt-0">
      <h2 className="flex items-center gap-3 font-display text-2xl tracking-tight text-ink">
        <span aria-hidden className="icon-3d size-10 shrink-0 rounded-xl">
          <Icon className="size-5" />
        </span>
        {title}
      </h2>
      {hint ? <p className="mt-2 text-sm leading-relaxed text-stone-600">{hint}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/**
 * The preview request form (ADR-076): what to make, the celebration as the
 * occasion describes it (the couple, the person celebrated, or a name), the
 * date, venue and functions, a design they liked, and where to send the
 * link. One unticked box agrees to the terms and to being contacted about it.
 */
export function PreviewRequestForm({ eventTypes: initialTypes, languages: initialLanguages }: { eventTypes: EventType[]; languages: Language[] }) {
  const params = useSearchParams();
  // Pre-rendered without the API (a build), the lists come from the browser.
  const typesQuery = useEventTypes();
  const languagesQuery = useLanguages();
  const eventTypes = initialTypes.length ? initialTypes : (typesQuery.data ?? []);
  const languages = initialLanguages.length ? initialLanguages : (languagesQuery.data ?? []);

  const askedTemplate = params.get('template');
  const [templateKey, setTemplateKey] = useState<string | null>(askedTemplate && /^[a-z0-9-]{1,80}$/.test(askedTemplate) ? askedTemplate : null);
  const [template, setTemplate] = useState<{ key: string; name: string; eventTypes: string[] } | null>(null);
  const askedWants = (params.get('want') ?? '').split(',').filter((k): k is PreviewKind => (PREVIEW_KINDS as readonly string[]).includes(k));
  const [wants, setWants] = useState<PreviewKind[]>(askedWants.length ? askedWants : ['WEBSITE', 'CARD']);
  const [typeKey, setTypeKey] = useState(params.get('event') ?? '');
  const [names, setNames] = useState({ partnerOne: '', partnerTwo: '', name: '' });
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [functions, setFunctions] = useState<FunctionRow[]>([]);
  const [language, setLanguage] = useState('en');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(false);
  // Never shown to people: a bot that fills it in is quietly turned away.
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ reference: string; name: string; phone: string } | null>(null);

  // The design they came from: its name and its occasion (summaries only; no definition).
  useEffect(() => {
    if (!templateKey) return setTemplate(null);
    apiGet<Array<{ key: string; name: string; eventTypes: string[] }>>(`/public/templates?keys=${encodeURIComponent(templateKey)}`)
      .then((list) => {
        const found = list.find((x) => x.key === templateKey) ?? null;
        setTemplate(found);
        if (!found) setTemplateKey(null);
        else if (found.eventTypes[0]) setTypeKey((current) => current || found.eventTypes[0]!);
      })
      .catch(() => undefined);
  }, [templateKey]);

  const type = eventTypes.find((x) => x.key === typeKey) ?? null;
  const couple = type?.detailsSchemaKey === 'couple';
  const honoree = type?.detailsSchemaKey === 'honoree';
  const suggestions = useMemo(() => (type?.defaultFunctions ?? []).filter((f) => !functions.some((x) => x.name.trim().toLowerCase() === f.name.toLowerCase())).slice(0, 8), [type, functions]);

  const addFunction = (fnName = '') => setFunctions((list) => (list.length >= 12 ? list : [...list, { id: Date.now() + list.length, name: fnName, date: '', time: '', venue: '' }]));
  const changeFunction = (id: number, patch: Partial<FunctionRow>) => setFunctions((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const toggleWant = (kind: PreviewKind) => setWants((list) => (list.includes(kind) ? list.filter((k) => k !== kind) : PREVIEW_KINDS.filter((k) => k === kind || list.includes(k))));
  const clear = (key: string) => setErrors(({ [key]: _gone, ...rest }) => rest);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const body = {
      name,
      phone,
      email,
      eventTypeKey: typeKey,
      details: couple ? { partnerOne: names.partnerOne, partnerTwo: names.partnerTwo } : honoree ? { name: names.name } : {},
      title,
      date,
      venue,
      city,
      functions: functions.filter((f) => f.name.trim()).map(({ name: fnName, date: fnDate, time, venue: fnVenue }) => ({ name: fnName, date: fnDate, time, venue: fnVenue })),
      wants,
      ...(templateKey ? { templateKey } : {}),
      language,
      notes,
      acceptTerms: terms,
      website,
    };
    const checked = PreviewRequestSchema.safeParse(body);
    const next: Record<string, string> = {};
    if (!typeKey) next.eventTypeKey = t('previewReq.occasionPick');
    if (couple && !names.partnerOne.trim()) next['details.partnerOne'] = t('previewReq.required');
    if (couple && !names.partnerTwo.trim()) next['details.partnerTwo'] = t('previewReq.required');
    if (honoree && !names.name.trim()) next['details.name'] = t('previewReq.required');
    if (type && !type.detailsSchemaKey && !title.trim()) next.title = t('previewReq.required');
    if (!checked.success) {
      for (const issue of checked.error.issues) {
        const path = issue.path.join('.');
        if (next[path]) continue;
        next[path] = path === 'acceptTerms' ? t('previewReq.consentRequired') : path === 'wants' ? t('previewReq.wantsRequired') : issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length) {
      // The first problem in view, for phones.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid]')?.focus());
      return;
    }
    setSending(true);
    try {
      const result = await apiPost<{ reference: string }>('/public/preview-requests', checked.data);
      track('preview_requested', { wants: wants.join(','), ...(templateKey ? { template: templateKey } : {}) });
      setDone({ reference: result.reference, name: name.trim().split(/\s+/)[0] ?? name.trim(), phone: checked.success ? checked.data!.phone : phone });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        const fields: Record<string, string> = {};
        for (const d of error.details as Array<{ path?: string; message?: string }>) if (d.path && d.message) fields[d.path] = d.message;
        setErrors(fields);
      }
      setProblem(message(error));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="clay mx-auto max-w-2xl rounded-[2rem] p-7 text-center sm:p-10">
        <span className="icon-3d mx-auto size-16 rounded-[1.4rem] animate-pop-in">
          <CheckCircle2 aria-hidden className="size-8" />
        </span>
        <h2 className="mt-6 font-display text-4xl tracking-tight">{t('previewReq.done.title', { name: done.name })}</h2>
        <p className="mx-auto mt-3 max-w-lg text-[1.0625rem] leading-relaxed text-stone-700">{t('previewReq.done.body', { phone: done.phone })}</p>
        <p className="mx-auto mt-5 w-fit rounded-full bg-surface px-4 py-2 font-mono text-sm font-semibold tracking-wider text-brand-700 shadow-clay-sm">{t('previewReq.done.reference', { reference: done.reference })}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/templates" className="btn-3d min-h-12 rounded-full px-6">
            <LayoutGrid aria-hidden className="size-4" />
            {t('previewReq.done.next')}
          </Link>
          <button
            type="button"
            className="btn-3d btn-3d-light min-h-12 rounded-full px-6"
            onClick={() => {
              setDone(null);
              setTerms(false);
            }}
          >
            {t('previewReq.done.another')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="clay space-y-8 rounded-[2rem] p-5 sm:p-8">
      <Section icon={Sparkles} title={t('previewReq.wants')}>
        <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label={t('previewReq.wants')} data-invalid={errors.wants ? '' : undefined} tabIndex={errors.wants ? -1 : undefined}>
          {PREVIEW_KINDS.map((kind) => {
            const Icon = KIND_ICON[kind];
            const on = wants.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  toggleWant(kind);
                  clear('wants');
                }}
                className={cn(
                  'group relative flex h-full flex-col items-start gap-2 rounded-2xl p-4 text-left ring-1 transition-[background-color,box-shadow,color] duration-300',
                  on ? 'bg-night-900 text-ivory shadow-lift ring-gold-300/50' : 'bg-white/70 text-ink ring-gold-200 hover:bg-white',
                )}
              >
                <span aria-hidden className={cn('grid size-10 place-items-center rounded-xl', on ? 'bg-gradient-to-b from-gold-200 to-gold-300 text-night-900' : 'bg-gold-100 text-gold-700')}>
                  <Icon className="size-5" />
                </span>
                <span className="font-display text-xl leading-tight">{t(`previewReq.wants.${kind}`)}</span>
                <span className={cn('text-sm leading-snug', on ? 'text-ivory/70' : 'text-stone-600')}>{t(`previewReq.wants.${kind}.body`)}</span>
                <span aria-hidden className={cn('absolute top-3 right-3 grid size-5 place-items-center rounded-full ring-1', on ? 'bg-gold-300 text-night-900 ring-gold-200' : 'bg-white ring-gold-300')}>
                  {on ? <CheckCircle2 className="size-5" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        {errors.wants ? <p className="text-sm text-red-700">{errors.wants}</p> : null}
      </Section>

      <Section icon={type ? occasionIcon(type.key) : CalendarDays} title={couple ? t('create.who.couple') : honoree ? t('create.who.honoree') : t('previewReq.occasion')}>
        <Field label={t('previewReq.occasion')} error={errors.eventTypeKey}>
          {(p) => (
            <Select
              {...p}
              value={typeKey}
              onChange={(e) => {
                setTypeKey(e.target.value);
                clear('eventTypeKey');
              }}
            >
              <option value="">{t('previewReq.occasionPick')}</option>
              {eventTypes.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {couple ? (
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <Field label={t('event.field.partnerOne')} error={errors['details.partnerOne']}>
              {(p) => <Input {...p} maxLength={120} autoComplete="off" value={names.partnerOne} onChange={(e) => (setNames({ ...names, partnerOne: e.target.value }), clear('details.partnerOne'))} />}
            </Field>
            <span aria-hidden className="hidden pb-2 font-display text-3xl text-gold-600 sm:block">
              &amp;
            </span>
            <Field label={t('event.field.partnerTwo')} error={errors['details.partnerTwo']}>
              {(p) => <Input {...p} maxLength={120} autoComplete="off" value={names.partnerTwo} onChange={(e) => (setNames({ ...names, partnerTwo: e.target.value }), clear('details.partnerTwo'))} />}
            </Field>
          </div>
        ) : honoree ? (
          <Field label={t('event.field.honoree')} error={errors['details.name']}>
            {(p) => <Input {...p} maxLength={120} autoComplete="off" value={names.name} onChange={(e) => (setNames({ ...names, name: e.target.value }), clear('details.name'))} />}
          </Field>
        ) : type ? (
          <Field label={t('event.field.title')} error={errors.title}>
            {(p) => <Input {...p} maxLength={160} value={title} onChange={(e) => (setTitle(e.target.value), clear('title'))} />}
          </Field>
        ) : null}
        {languages.length > 1 ? (
          <Field label={t('previewReq.language')}>
            {(p) => (
              <Select {...p} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName === l.name ? l.name : `${l.nativeName} · ${l.name}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </Section>

      <Section icon={MapPin} title={t('previewReq.when')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('previewReq.date')} error={errors.date}>
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label={t('previewReq.venue')} error={errors.venue}>
            {(p) => <Input {...p} maxLength={160} value={venue} onChange={(e) => setVenue(e.target.value)} />}
          </Field>
          <Field label={t('previewReq.city')} error={errors.city}>
            {(p) => <Input {...p} maxLength={80} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />}
          </Field>
        </div>
        <div className="rounded-2xl border border-gold-200 bg-white/50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{t('previewReq.functions')}</p>
            <p className="text-xs text-stone-500">{t('common.optional')}</p>
          </div>
          <p className="mt-1 text-sm text-stone-600">{t('previewReq.functionsHint')}</p>
          {functions.length ? (
            <ol className="mt-4 space-y-3">
              {functions.map((fn, index) => (
                <li key={fn.id} className="clay-inset grid gap-3 rounded-2xl p-3 sm:grid-cols-[1.2fr_1fr_0.8fr_1.2fr_auto] sm:items-end">
                  <Field label={t('previewReq.functionName')} error={errors[`functions.${index}.name`]}>
                    {(p) => <Input {...p} maxLength={80} value={fn.name} onChange={(e) => changeFunction(fn.id, { name: e.target.value })} />}
                  </Field>
                  <Field label={t('previewReq.functionDate')} error={errors[`functions.${index}.date`]}>
                    {(p) => <Input {...p} type="date" value={fn.date} onChange={(e) => changeFunction(fn.id, { date: e.target.value })} />}
                  </Field>
                  <Field label={t('previewReq.functionTime')} error={errors[`functions.${index}.time`]}>
                    {(p) => <Input {...p} type="time" value={fn.time} onChange={(e) => changeFunction(fn.id, { time: e.target.value })} />}
                  </Field>
                  <Field label={t('previewReq.functionVenue')} error={errors[`functions.${index}.venue`]}>
                    {(p) => <Input {...p} maxLength={160} value={fn.venue} onChange={(e) => changeFunction(fn.id, { venue: e.target.value })} />}
                  </Field>
                  <button
                    type="button"
                    onClick={() => setFunctions((list) => list.filter((f) => f.id !== fn.id))}
                    className="btn-3d btn-3d-light size-11 justify-self-end rounded-xl"
                    aria-label={t('previewReq.functionRemove', { name: fn.name.trim() || t('previewReq.functionUnnamed') })}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.slug} type="button" onClick={() => addFunction(s.name)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-gold-100/70 px-3.5 text-sm font-medium text-gold-800 ring-1 ring-gold-200 transition-colors hover:bg-gold-100">
                <Plus aria-hidden className="size-3.5" />
                {s.name}
              </button>
            ))}
            {functions.length < 12 ? (
              <button type="button" onClick={() => addFunction()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50">
                <Plus aria-hidden className="size-3.5" />
                {t('previewReq.functionAdd')}
              </button>
            ) : null}
          </div>
        </div>
      </Section>

      <Section icon={LayoutGrid} title={t('previewReq.design')}>
        {templateKey ? (
          <div className="flex items-center gap-4 rounded-2xl bg-white/70 p-3 ring-1 ring-gold-200">
            <span className="relative block aspect-[3/5] w-16 shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-gold-200">
              {cardPreview(templateKey) ? <img src={cardPreview(templateKey)!} alt="" className="absolute inset-0 size-full object-cover object-top" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-xl text-ink">{template?.name ?? templateKey}</span>
              <span className="block text-sm text-stone-600">{t('previewReq.designChosen')}</span>
            </span>
            <button type="button" onClick={() => setTemplateKey(null)} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">
              {t('previewReq.designClear')}
            </button>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-stone-600">
            {t('previewReq.designNone')}{' '}
            <Link href="/templates" className={LINK}>
              {t('previewReq.designBrowse')}
            </Link>
          </p>
        )}
      </Section>

      <Section icon={UserRound} title={t('previewReq.you')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('previewReq.name')} error={errors.name}>
            {(p) => <Input {...p} maxLength={120} autoComplete="name" value={name} onChange={(e) => (setName(e.target.value), clear('name'))} />}
          </Field>
          <Field label={t('previewReq.phone')} hint={t('previewReq.phoneHint')} error={errors.phone}>
            {(p) => <PhoneInput {...p} value={phone} onChange={(v) => (setPhone(v), clear('phone'))} />}
          </Field>
        </div>
        <Field label={t('previewReq.email')} hint={t('previewReq.emailHint')} error={errors.email}>
          {(p) => <Input {...p} type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => (setEmail(e.target.value), clear('email'))} />}
        </Field>
        <Field label={t('previewReq.notes')} hint={t('previewReq.notesHint')} error={errors.notes}>
          {(p) => <Textarea {...p} rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        {/* Bots fill in every field; people never see this one. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
      </Section>

      <div className="border-t border-gold-200/70 pt-6">
        {/* The terms and being contacted about this request: unticked until the person ticks it. */}
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone-800">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 rounded border-stone-300 accent-brand-700"
            checked={terms}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? 'preview-terms-error' : undefined}
            onChange={(e) => {
              setTerms(e.target.checked);
              if (e.target.checked) clear('acceptTerms');
            }}
          />
          <span>
            {t('previewReq.consent.before')}{' '}
            <Link href="/terms" target="_blank" className={LINK}>
              {t('auth.consent.terms')}
            </Link>{' '}
            {t('auth.consent.and')}{' '}
            <Link href="/privacy" target="_blank" className={LINK}>
              {t('auth.consent.privacy')}
            </Link>
            {t('previewReq.consent.after')}
          </span>
        </label>
        {errors.acceptTerms ? (
          <p id="preview-terms-error" role="alert" className="mt-1.5 pl-8 text-sm text-red-700">
            {errors.acceptTerms}
          </p>
        ) : null}
        {problem ? (
          <div className="mt-4">
            <Alert>{problem}</Alert>
          </div>
        ) : null}
        <button type="submit" disabled={sending} className="btn-3d mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-6 text-base sm:w-auto">
          <Send aria-hidden className="size-4.5" />
          {sending ? t('previewReq.sending') : t('previewReq.submit')}
        </button>
        <p className="mt-3 text-sm text-stone-500">{t('previewReq.free')}</p>
      </div>
    </form>
  );
}
