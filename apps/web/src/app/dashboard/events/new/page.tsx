'use client';

import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCheck, Languages, Loader2, LockKeyhole, Palette, Rocket, Sparkles, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatEventDateWithWeekday } from '@bulava/localization';
// Single modules: the package entry would bring the whole template engine.
import { FloralCorner, Mandala } from '@bulava/template-engine/src/ornaments';
import { CreateEventSchema } from '@bulava/validation';
import { ApiError, apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { isPlanLimit, unlockHref } from '@/lib/plan-limits';
import { occasionIcon, occasionShortName } from '@/lib/occasions';
import { keys, useEventTypes, useLanguages } from '@/lib/queries';
import { cardPreview } from '@/lib/template-previews';
import type { EventSummary, EventType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, Field, Input, Spinner } from '@/components/ui/primitives';

const STEPS = ['create.step.occasion', 'create.step.details', 'create.step.functions'] as const;
type Names = { partnerOne: string; partnerTwo: string; name: string };

export default function NewEventPage() {
  return (
    <Suspense>
      <CreateEvent />
    </Suspense>
  );
}

/**
 * A new event in three short steps: the occasion (picked from cards), who and
 * when, and which of the usual functions are happening. A live invitation card
 * follows along. Nothing about who can open the invitation is asked here:
 * events start as one private link and the host chooses when publishing.
 */
function CreateEvent() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const templateKey = params.get('template');
  const client = useQueryClient();
  const types = useEventTypes();
  const languages = useLanguages();

  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [names, setNames] = useState<Names>({ partnerOne: '', partnerTwo: '', name: '' });
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [date, setDate] = useState('');
  const [language, setLanguage] = useState('en');
  const [functions, setFunctions] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // A plan limit carries where to unlock more (the plans page for the number of events).
  const [error, setError] = useState<{ text: string; unlock: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const type = types.data?.find((x) => x.key === typeKey);

  // ?type=BIRTHDAY (from the home page's occasion shortcuts) starts on the details.
  useEffect(() => {
    const wanted = params.get('type');
    if (!types.data || typeKey || !wanted) return;
    const found = types.data.find((x) => x.key === wanted);
    if (found) pick(found, false);
    // Only once the types have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.data]);

  const autoTitle = useMemo(() => {
    if (!type) return '';
    const occasion = occasionShortName(type.name);
    if (type.detailsSchemaKey === 'couple' && names.partnerOne.trim() && names.partnerTwo.trim()) {
      return t('create.autoTitle.couple', { one: names.partnerOne.trim(), two: names.partnerTwo.trim(), occasion });
    }
    if (type.detailsSchemaKey === 'honoree' && names.name.trim()) return t('create.autoTitle.honoree', { name: names.name.trim(), occasion });
    return '';
  }, [type, names, t]);
  const finalTitle = (titleEdited ? title : autoTitle || title).trim();

  function pick(next: EventType, advance = true) {
    setTypeKey(next.key);
    setFunctions(next.defaultFunctions.map((f) => f.slug));
    setFieldErrors({});
    if (advance) {
      setStep(1);
      setReached((r) => Math.max(r, 1));
    } else {
      setStep(1);
      setReached(1);
    }
  }

  const details = (): Record<string, string> =>
    type?.detailsSchemaKey === 'couple'
      ? { partnerOne: names.partnerOne.trim(), partnerTwo: names.partnerTwo.trim() }
      : type?.detailsSchemaKey === 'honoree'
        ? { name: names.name.trim() }
        : {};

  const payload = () => ({
    typeKey: typeKey ?? '',
    title: finalTitle,
    language,
    // One link for everyone until the host decides otherwise, when publishing.
    accessMode: 'PRIVATE_LINK' as const,
    applyDefaults: true,
    ...(type?.defaultFunctions.length ? { functionSlugs: functions } : {}),
    ...(date ? { date } : {}),
    details: details(),
  });

  /** Checks the details step; true when it may continue. */
  const checkDetails = () => {
    const parsed = CreateEventSchema.safeParse(payload());
    if (parsed.success) {
      setFieldErrors({});
      return true;
    }
    const errors = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message]));
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const goTo = (next: number) => {
    if (next > step && step === 1 && !checkDetails()) return;
    setStep(next);
    setReached((r) => Math.max(r, next));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!checkDetails()) {
      setStep(1);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const event = await apiPost<EventSummary>('/events', payload());
      await client.invalidateQueries({ queryKey: keys.events });
      // Came from 'Use this template': apply it, or offer to unlock paid designs.
      if (templateKey) {
        try {
          await apiPut(`/events/${event.id}/design/website`, { templateKey });
          router.push(`/dashboard/events/${event.id}/design`);
        } catch (err) {
          const locked = err instanceof ApiError && err.code === 'PLAN_UPGRADE_REQUIRED';
          router.push(locked ? `/dashboard/events/${event.id}/unlock?template=${encodeURIComponent(templateKey)}` : `/dashboard/events/${event.id}/design`);
        }
        return;
      }
      // The first step of the setup: choosing the design.
      router.push(`/dashboard/events/${event.id}/design?welcome=1`);
    } catch (err) {
      setError({ text: errorMessage(t, err), unlock: isPlanLimit(err) ? unlockHref(err) : null });
      setSubmitting(false);
    }
  };

  if (types.isPending || languages.isPending) return <Spinner label={t('common.loading')} />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brand-700">{t('create.eyebrow')}</p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{t(`create.title.${step}` as 'create.title.0')}</h1>
          <p className="mt-2 max-w-2xl text-stone-600">{t(`create.subtitle.${step}` as 'create.subtitle.0')}</p>
        </div>
        <Stepper step={step} reached={reached} onStep={(i) => (i < step || i <= reached ? goTo(i) : undefined)} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} noValidate className="min-w-0">
          {error ? (
            <div className="mb-5">
              <Alert>
                {error.text}
                {error.unlock ? (
                  <>
                    {' '}
                    <Link href={error.unlock} className="font-semibold underline decoration-red-300 underline-offset-4 hover:decoration-red-800">
                      {t('unlock.cta')}
                    </Link>
                  </>
                ) : null}
              </Alert>
            </div>
          ) : null}

          {step === 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {types.data?.map((x) => {
                const Icon = occasionIcon(x.key);
                const chosen = x.key === typeKey;
                return (
                  <li key={x.key}>
                    <button
                      type="button"
                      onClick={() => pick(x)}
                      aria-pressed={chosen}
                      className={cn(
                        'group flex h-full w-full flex-col items-start gap-3 rounded-3xl p-4 text-left transition-[box-shadow,background-color,translate] duration-300 sm:p-5',
                        chosen ? 'clay ring-2 ring-brand-600' : 'clay clay-lift',
                      )}
                    >
                      <span className="flex w-full items-start justify-between gap-2">
                        <span aria-hidden className="icon-3d size-12 rounded-2xl">
                          <Icon className="size-6" />
                        </span>
                        {chosen ? (
                          <span aria-hidden className="grid size-6 place-items-center rounded-full bg-brand-700 text-white">
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                        ) : null}
                      </span>
                      <span className="font-display text-lg leading-snug text-ink">{x.name}</span>
                      {x.description ? <span className="line-clamp-2 text-xs leading-relaxed text-stone-500">{x.description}</span> : null}
                      {x.defaultFunctions.length ? (
                        <span className="mt-auto text-[11px] font-medium text-gold-700">{t('create.suggested', { count: x.defaultFunctions.length })}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {step === 1 && type ? (
            <div className="space-y-6">
              <Panel icon={occasionIcon(type.key)} title={type.detailsSchemaKey === 'couple' ? t('create.who.couple') : type.detailsSchemaKey === 'honoree' ? t('create.who.honoree') : t('create.who.event')}>
                {type.detailsSchemaKey === 'couple' ? (
                  <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
                    <Field label={t('event.field.partnerOne')} error={fieldErrors['details.partnerOne']}>
                      {(p) => <Input {...p} autoFocus maxLength={120} autoComplete="off" value={names.partnerOne} onChange={(e) => setNames({ ...names, partnerOne: e.target.value })} />}
                    </Field>
                    <span aria-hidden className="hidden pb-2 font-display text-3xl text-gold-600 sm:block">
                      &amp;
                    </span>
                    <Field label={t('event.field.partnerTwo')} error={fieldErrors['details.partnerTwo']}>
                      {(p) => <Input {...p} maxLength={120} autoComplete="off" value={names.partnerTwo} onChange={(e) => setNames({ ...names, partnerTwo: e.target.value })} />}
                    </Field>
                  </div>
                ) : type.detailsSchemaKey === 'honoree' ? (
                  <Field label={t('event.field.honoree')} error={fieldErrors['details.name']}>
                    {(p) => <Input {...p} autoFocus maxLength={120} autoComplete="off" value={names.name} onChange={(e) => setNames({ ...names, name: e.target.value })} />}
                  </Field>
                ) : null}
                <Field label={t('event.field.title')} hint={autoTitle && !titleEdited ? t('create.titleAuto') : t('create.titleHint')} error={fieldErrors.title}>
                  {(p) => (
                    <Input
                      {...p}
                      autoFocus={!type.detailsSchemaKey}
                      maxLength={160}
                      value={titleEdited ? title : autoTitle || title}
                      placeholder={t('create.titlePlaceholder', { occasion: occasionShortName(type.name) })}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setTitleEdited(true);
                      }}
                    />
                  )}
                </Field>
              </Panel>

              <Panel icon={CalendarDays} title={t('create.when')}>
                <Field label={t('create.date')} hint={t('create.dateHint')}>
                  {(p) => <Input {...p} type="date" className="max-w-xs" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />}
                </Field>
              </Panel>

              <Panel icon={Languages} title={t('event.field.language')} subtitle={t('create.languageHint')}>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('event.field.language')}>
                  {languages.data?.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      aria-pressed={language === l.code}
                      onClick={() => setLanguage(l.code)}
                      className={cn('btn-3d min-h-10 rounded-full px-4 text-sm', language !== l.code && 'btn-3d-light')}
                    >
                      {l.nativeName}
                      {l.nativeName !== l.name ? <span className={cn('text-xs', language === l.code ? 'text-white/75' : 'text-stone-500')}>{l.name}</span> : null}
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {step === 2 && type ? (
            <div className="space-y-6">
              {type.defaultFunctions.length ? (
                <Panel
                  icon={CalendarDays}
                  title={t('create.functions')}
                  subtitle={t('create.functionsHint')}
                  aside={
                    <button
                      type="button"
                      onClick={() => setFunctions(functions.length === type.defaultFunctions.length ? [] : type.defaultFunctions.map((f) => f.slug))}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                    >
                      <CheckCheck aria-hidden className="size-4" />
                      {functions.length === type.defaultFunctions.length ? t('create.none') : t('create.all')}
                    </button>
                  }
                >
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {type.defaultFunctions.map((f) => {
                      const on = functions.includes(f.slug);
                      return (
                        <li key={f.slug}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setFunctions(on ? functions.filter((s) => s !== f.slug) : type.defaultFunctions.map((d) => d.slug).filter((s) => s === f.slug || functions.includes(s)))}
                            className={cn(
                              'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left transition-[border-color,background-color,box-shadow] duration-200',
                              on ? 'border-brand-600 bg-white shadow-clay-sm' : 'border-gold-200 bg-white/50 text-stone-500 hover:border-gold-300 hover:bg-white',
                            )}
                          >
                            <span aria-hidden className={cn('grid size-6 shrink-0 place-items-center rounded-lg border transition-colors', on ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-white')}>
                              {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                            </span>
                            <span className={cn('font-medium', on ? 'text-ink' : 'text-stone-500 line-through decoration-stone-300')}>{f.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-stone-500">{t('create.functionsLater')}</p>
                </Panel>
              ) : (
                <Panel icon={CalendarDays} title={t('create.functions')}>
                  <p className="text-sm text-stone-600">{t('create.noSuggestions')}</p>
                </Panel>
              )}

              {type.defaultGroups.length > 1 ? (
                <Panel icon={UsersRound} title={t('create.groups')} subtitle={t('create.groupsHint')}>
                  <ul className="flex flex-wrap gap-2">
                    {type.defaultGroups.map((g) => (
                      <li key={g.slug} className="rounded-full bg-sand px-3 py-1.5 text-sm text-stone-700 ring-1 ring-gold-200/70">
                        {g.name}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              <div className="flex items-start gap-3 rounded-3xl border border-gold-200 bg-gold-100/40 p-4 text-sm leading-relaxed text-stone-700 sm:p-5">
                <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
                <p>{t('create.privacy')}</p>
              </div>
            </div>
          ) : null}

          {step > 0 ? (
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => goTo(step - 1)} className="btn-3d btn-3d-light min-h-12 rounded-2xl px-5 text-sm">
                <ArrowLeft aria-hidden className="size-4" />
                {t('create.back')}
              </button>
              {step < 2 ? (
                <button type="button" onClick={() => goTo(step + 1)} className="btn-3d min-h-12 rounded-2xl px-7 text-sm">
                  {t('create.continue')}
                  <ArrowRight aria-hidden className="size-4" />
                </button>
              ) : (
                <button type="submit" disabled={submitting} className="btn-3d min-h-12 rounded-2xl px-7 text-base">
                  {submitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Sparkles aria-hidden className="size-4" />}
                  {submitting ? t('create.creating') : t('create.submit')}
                </button>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm text-stone-500">
              {t('create.notSure')}{' '}
              <Link href="/templates" className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
                {t('home.hero.browse')}
              </Link>
            </p>
          )}
        </form>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <InvitationCard type={type} names={names} title={finalTitle} date={date} />
            {templateKey && cardPreview(templateKey) ? (
              // Came from a template page: the design the event will start with.
              <div className="clay flex items-center gap-4 rounded-3xl p-4">
                <img src={cardPreview(templateKey)!} alt="" className="h-24 w-12 shrink-0 rounded-lg object-cover object-top ring-1 ring-gold-200" />
                <p className="text-sm leading-relaxed text-stone-600">{t('create.templateChosen')}</p>
              </div>
            ) : null}
            <WhatsNext designChosen={!!templateKey} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stepper({ step, reached, onStep }: { step: number; reached: number; onStep: (i: number) => void }) {
  const t = useT();
  return (
    <ol className="flex items-center gap-1.5" aria-label={t('create.progress')}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const here = i === step;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onStep(i)}
              disabled={i > reached}
              aria-current={here ? 'step' : undefined}
              className={cn(
                'flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors',
                here ? 'bg-white text-ink shadow-clay-sm ring-1 ring-gold-300' : done ? 'text-emerald-800 hover:bg-white/70' : 'text-stone-500',
                i > reached && 'cursor-default',
              )}
            >
              <span aria-hidden className={cn('grid size-6 place-items-center rounded-full text-xs font-bold', done ? 'bg-emerald-600 text-white' : here ? 'bg-brand-700 text-white' : 'bg-stone-200 text-stone-600')}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{t(label)}</span>
            </button>
            {i < STEPS.length - 1 ? <span aria-hidden className={cn('h-px w-5 sm:w-8', i < step ? 'bg-emerald-400' : 'bg-gold-200')} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function Panel({ icon: Icon, title, subtitle, aside, children }: { icon: typeof Palette; title: string; subtitle?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="clay rounded-3xl p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span aria-hidden className="icon-3d size-10 shrink-0 rounded-xl">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-stone-600">{subtitle}</p> : null}
        </div>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** The invitation taking shape as the host types: occasion, names, date. */
function InvitationCard({ type, names, title, date }: { type: EventType | undefined; names: Names; title: string; date: string }) {
  const t = useT();
  const couple = type?.detailsSchemaKey === 'couple';
  const honoree = type?.detailsSchemaKey === 'honoree';
  const one = names.partnerOne.trim() || t('create.preview.one');
  const two = names.partnerTwo.trim() || t('create.preview.two');
  const heading = honoree ? names.name.trim() || t('create.preview.name') : title || (type ? occasionShortName(type.name) : t('create.preview.event'));
  const when = date ? formatEventDateWithWeekday(`${date}T10:00:00+05:30`, { language: 'en', timeZone: 'Asia/Kolkata' }) : t('create.preview.date');
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#fbf6ee] px-7 py-10 text-center shadow-clay ring-1 ring-gold-200">
      <FloralCorner className="pointer-events-none absolute -top-2 -left-2 -z-10 w-24 text-gold-500 opacity-60" />
      <FloralCorner className="pointer-events-none absolute -right-2 -bottom-2 -z-10 w-24 rotate-180 text-gold-500 opacity-60" />
      <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-72 -translate-x-1/2 -translate-y-1/2 text-gold-300 opacity-[0.18]" />
      <p className="text-[11px] font-semibold tracking-[0.3em] text-gold-700 uppercase">{type ? occasionShortName(type.name) : t('create.preview.eyebrow')}</p>
      <p className="mt-3 text-xs tracking-[0.2em] text-stone-500 uppercase">{t('create.preview.invited')}</p>
      {couple ? (
        <p className="mt-4 font-display text-[2.1rem] leading-[1.1] text-brand-800">
          <span className="block break-words">{one}</span>
          <span className="my-1 block text-2xl text-gold-600">&amp;</span>
          <span className="block break-words">{two}</span>
        </p>
      ) : (
        <p className="mt-4 font-display text-[2.1rem] leading-[1.1] break-words text-brand-800">{heading}</p>
      )}
      <div aria-hidden className="mx-auto my-5 flex items-center justify-center gap-2 text-gold-500">
        <span className="h-px w-10 bg-gold-300" />
        <Sparkles className="size-3.5" />
        <span className="h-px w-10 bg-gold-300" />
      </div>
      <p className={cn('text-sm', date ? 'font-medium text-ink' : 'text-stone-500 italic')}>{when}</p>
    </div>
  );
}

function WhatsNext({ designChosen }: { designChosen: boolean }) {
  const t = useT();
  const items = [
    { icon: Palette, label: designChosen ? t('create.next.designChosen') : t('create.next.design') },
    { icon: CalendarDays, label: t('create.next.functions') },
    { icon: UsersRound, label: t('create.next.guests') },
    { icon: Rocket, label: t('create.next.publish') },
  ];
  return (
    <div className="clay-inset rounded-3xl p-5">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-stone-500 uppercase">{t('create.next.title')}</p>
      <ol className="mt-3 space-y-2.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-3 text-sm text-stone-700">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand-700 shadow-clay-sm">
              {i + 1}
            </span>
            <item.icon aria-hidden className="size-4 text-gold-600" />
            {item.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
