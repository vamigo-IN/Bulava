'use client';

import { ArrowRight, MessageCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createTranslator } from '@bulava/localization';
import { ApiError, apiPost } from '@/lib/api';
import { useSession } from '@/lib/session';
import { track } from '@/lib/track';
import type { EventType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, Button, Field, Input, Select } from '@/components/ui/primitives';

const t = createTranslator('en');

interface TemplateInfo {
  key: string;
  name: string;
  eventTypes: string[];
}

let types: Promise<EventType[]> | null = null;
/** The event types (public), once per page. */
function loadEventTypes(): Promise<EventType[]> {
  types ??= fetch('/api/v1/meta/event-types', { cache: 'force-cache' })
    .then((r) => r.json() as Promise<{ data?: EventType[] }>)
    .then((b) => b.data ?? [])
    .catch(() => []);
  return types;
}

/** Only same-site API errors carry a code the catalog knows; everything else gets the generic line. */
function message(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `error.${error.code}` as Parameters<typeof t>[0];
    const translated = t(key);
    if (translated !== key) return translated;
    if (error.status < 500) return error.message;
  }
  return t('common.error');
}

/**
 * "Use this template": signed-in hosts go straight to a new event with the
 * design; everyone else gets the quick start, a preview with their names in
 * under a minute, without a password.
 */
export function UseTemplateButton({ template, className, children }: { template: TemplateInfo; className: string; children: React.ReactNode }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  if (session.status === 'signed-in') {
    return (
      // The template's first occasion is preselected, so the guided creation starts on the details.
      <Link href={`/dashboard/events/new?template=${template.key}${template.eventTypes[0] ? `&type=${template.eventTypes[0]}` : ''}`} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          track('quick_start_opened', { template: template.key });
          setOpen(true);
        }}
      >
        {children}
      </button>
      <QuickStartModal template={template} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

type Step = 'form' | 'otp';

export function QuickStartModal({ template, open, onClose }: { template: TemplateInfo; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [all, setAll] = useState<EventType[]>([]);
  const [typeKey, setTypeKey] = useState(template.eventTypes[0] ?? 'WEDDING');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    if (open) void loadEventTypes().then(setAll);
  }, [open]);

  const offered = all.filter((x) => !template.eventTypes.length || template.eventTypes.includes(x.key));
  const type = offered.find((x) => x.key === typeKey) ?? offered[0];
  const schema = type?.detailsSchemaKey ?? null;
  const today = new Date().toISOString().slice(0, 10);

  const payload = () => ({
    templateKey: template.key,
    typeKey: type?.key ?? typeKey,
    details: schema === 'couple' ? { partnerOne: details.partnerOne ?? '', partnerTwo: details.partnerTwo ?? '' } : schema === 'honoree' ? { name: details.name ?? '' } : {},
    ...(schema ? {} : { title }),
    ...(date ? { date } : {}),
    phone,
    language: 'en',
    acceptTerms,
    whatsappUpdates: updates,
  });

  const finish = (result: { event: { id: string }; whatsappSent: boolean }) => {
    track('quick_start_completed', { template: template.key, type: type?.key, whatsapp: result.whatsappSent });
    router.push(`/dashboard/events/${result.event.id}/design?welcome=1${result.whatsappSent ? '&whatsapp=1' : ''}`);
    router.refresh();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!acceptTerms) {
      setError(t('quick.consentRequired'));
      return;
    }
    setBusy(true);
    try {
      const result = await apiPost<{ requiresOtp?: true; target?: string; event?: { id: string }; whatsappSent?: boolean }>('/public/quick-start', payload());
      if (result.requiresOtp) {
        setTarget(result.target ?? '');
        setStep('otp');
        return;
      }
      if (result.event) finish({ event: result.event, whatsappSent: !!result.whatsappSent });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await apiPost<{ event: { id: string }; whatsappSent: boolean }>('/public/quick-start/verify', { ...payload(), code });
      finish(result);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const link = 'font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700';

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="quick-start-title"
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-[2rem] bg-transparent p-0 backdrop:bg-night-900/60 backdrop:backdrop-blur-sm"
    >
      <div className="clay rounded-[2rem] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-brand-700">{template.name}</p>
            <h2 id="quick-start-title" className="mt-2 font-display text-3xl leading-tight tracking-[-0.015em]">
              {step === 'form' ? t('quick.title') : t('quick.otp.title')}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('quick.close')} className="btn-3d btn-3d-light size-10 shrink-0 rounded-full">
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {step === 'form' ? (
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <p className="text-sm leading-relaxed text-stone-600">{t('quick.subtitle')}</p>
            {error ? <Alert>{error}</Alert> : null}
            {offered.length > 1 ? (
              <Field label={t('quick.eventType')}>
                {(p) => (
                  <Select {...p} value={type?.key ?? typeKey} onChange={(e) => setTypeKey(e.target.value)}>
                    {offered.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
            {schema === 'couple' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('quick.partnerOne')}>
                  {(p) => <Input {...p} required autoComplete="off" value={details.partnerOne ?? ''} onChange={(e) => setDetails({ ...details, partnerOne: e.target.value })} placeholder="Riya" />}
                </Field>
                <Field label={t('quick.partnerTwo')}>
                  {(p) => <Input {...p} required autoComplete="off" value={details.partnerTwo ?? ''} onChange={(e) => setDetails({ ...details, partnerTwo: e.target.value })} placeholder="Aman" />}
                </Field>
              </div>
            ) : schema === 'honoree' ? (
              <Field label={t('quick.honoree')}>
                {(p) => <Input {...p} required autoComplete="off" value={details.name ?? ''} onChange={(e) => setDetails({ ...details, name: e.target.value })} placeholder="Aarav" />}
              </Field>
            ) : (
              <Field label={t('quick.eventName')}>
                {(p) => <Input {...p} required value={title} onChange={(e) => setTitle(e.target.value)} />}
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('quick.date')}>
                {(p) => <Input {...p} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <Field label={t('quick.phone')} hint={t('quick.phoneHint')}>
                {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />}
              </Field>
            </div>
            <div className="space-y-2 rounded-2xl bg-[#f8f2ea] p-4 shadow-clay-inset">
              {/* Never pre-ticked (DPDP Act): the Terms are required, updates are a separate choice. */}
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone-800">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-stone-300 accent-brand-700" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                <span>
                  {t('auth.consent.before')}{' '}
                  <Link href="/terms" target="_blank" className={link}>
                    {t('auth.consent.terms')}
                  </Link>{' '}
                  {t('auth.consent.and')}{' '}
                  <Link href="/privacy" target="_blank" className={link}>
                    {t('auth.consent.privacy')}
                  </Link>
                  .
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone-800">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-stone-300 accent-brand-700" checked={updates} onChange={(e) => setUpdates(e.target.checked)} />
                <span>{t('quick.updates')}</span>
              </label>
            </div>
            <Button type="submit" size="lg" className={cn('group/cta mt-1 min-h-13 w-full rounded-2xl', busy && 'opacity-80')} disabled={busy}>
              {busy ? t('quick.submitting') : t('quick.submit')}
              {busy ? null : <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />}
            </Button>
            <p className="text-center text-sm text-stone-600">
              {t('quick.haveAccount')}{' '}
              <Link href={`/login?template=${template.key}`} className={link}>
                {t('quick.signIn')}
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-5 space-y-4" noValidate>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-stone-600">
              <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              <span>{t('quick.otp.body', { target })}</span>
            </p>
            {error ? <Alert>{error}</Alert> : null}
            <Field label={t('quick.otp.code')}>
              {(p) => <Input {...p} autoFocus required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-mono text-2xl tracking-[0.4em]" />}
            </Field>
            <Button type="submit" size="lg" className="min-h-13 w-full rounded-2xl" disabled={busy || code.length !== 6}>
              {busy ? t('common.loading') : t('quick.otp.submit')}
            </Button>
            <button type="button" className="w-full text-center text-sm text-stone-600 underline" onClick={() => setStep('form')}>
              {t('quick.otp.change')}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
