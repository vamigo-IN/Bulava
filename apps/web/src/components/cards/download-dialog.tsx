'use client';

import { ArrowLeft, Check, Crown, Download, LoaderCircle, Lock, Mail, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CardView } from '@bulava/template-engine';
import { splitPhoneNumber } from '@bulava/validation';
import { PhoneInput } from '@/components/ui/phone-input';
import { errorMessage } from '@/lib/i18n';
import { cardApi, formatRupees, rememberOrder, startDownload, type CardExportView, type CardSessionOrder } from '@/lib/cards';
import { runCheckout } from '@/lib/checkout';
import { cn } from '@/lib/utils';
import type { CardEditorApi } from './editor-types';
import { OrderStatus } from './order-status';

type Step =
  /** A plan holder's download, started as the dialog opens: nothing to choose or fill in. */
  | { kind: 'starting' }
  | { kind: 'choose' }
  | { kind: 'free' }
  | { kind: 'paid'; notice?: string }
  | { kind: 'making'; option: 'FREE' | 'PLAN'; exportId: string }
  | { kind: 'ready'; option: 'FREE' | 'PLAN'; card: CardExportView }
  | { kind: 'order'; orderToken: string }
  | { kind: 'failed'; option: 'FREE' | 'PLAN'; message: string };

const ACCENT = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

/**
 * Downloading a card (docs/cards.md#downloads): the free card with the
 * watermark for a mobile number, or the watermark-free card for the price
 * (number, name, email, the ticked Terms, then Razorpay). A signed-in customer
 * whose plan covers watermark-free cards gets no choice and no form: the clean
 * card is made and saved as the dialog opens. Closing it never touches the
 * design; reopening it after paying goes straight to the bought card.
 */
export function DownloadDialog({
  editor,
  ensureSession,
  sessionToken,
  paidOrder,
  siteName,
  onClose,
}: {
  editor: Pick<CardEditorApi, 'design' | 'template' | 't' | 'cardT' | 'ctx' | 'config'>;
  /** Saves the latest design on the server (creating the card there the first time) and gives its token. */
  ensureSession: () => Promise<string>;
  sessionToken: string | null;
  /** A paid order for exactly this design, if one exists: no second purchase. */
  paidOrder: CardSessionOrder | null;
  siteName: string;
  onClose: () => void;
}) {
  const { design, t, config, template } = editor;
  const plan = config?.account?.planDownload ? config.account : null;
  const [step, setStep] = useState<Step>(plan ? { kind: 'starting' } : paidOrder ? { kind: 'order', orderToken: paidOrder.orderToken } : { kind: 'choose' });
  const [phone, setPhone] = useState(config?.account?.phone ?? '');
  const [offers, setOffers] = useState(false);
  const [name, setName] = useState(config?.account?.name ?? '');
  const [email, setEmail] = useState(config?.account?.email ?? '');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const price = formatRupees(config?.priceMinor ?? 5000);
  // A plan download saves itself once, when its image is ready.
  const autoSaved = useRef(false);

  useEffect(() => {
    void cardApi.event({ type: 'DOWNLOAD_MODAL_OPENED', templateKey: template.key, ...(sessionToken ? { session: sessionToken } : {}), meta: { format: design.format } });
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Waits for the image of a free or plan download.
  useEffect(() => {
    if (step.kind !== 'making') return;
    let stop = false;
    const started = Date.now();
    const poll = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, 1500));
        if (stop) return;
        try {
          const token = await ensureSession();
          const card = await cardApi.exportStatus(token, step.exportId);
          if (card.status === 'READY') return setStep({ kind: 'ready', option: step.option, card });
          if (card.status === 'FAILED' || card.status === 'EXPIRED') return setStep({ kind: 'failed', option: step.option, message: t('cards.download.failed') });
        } catch (error) {
          if (Date.now() - started > 120_000) return setStep({ kind: 'failed', option: step.option, message: errorMessage(t, error) });
        }
        if (Date.now() - started > 150_000) return setStep({ kind: 'failed', option: step.option, message: t('cards.download.slow') });
      }
    };
    void poll();
    return () => {
      stop = true;
    };
  }, [step, ensureSession, t]);

  const run = async (fn: () => Promise<void>) => {
    setWorking(true);
    setProblem(null);
    try {
      await fn();
    } catch (error) {
      setProblem(errorMessage(t, error));
    } finally {
      setWorking(false);
    }
  };

  const checkPhone = (): boolean => {
    if (!splitPhoneNumber(phone)) {
      setErrors((e) => ({ ...e, phone: t('cards.download.phoneInvalid') }));
      return false;
    }
    setErrors((e) => ({ ...e, phone: '' }));
    return true;
  };

  const freeDownload = (e?: FormEvent) => {
    e?.preventDefault();
    if (!checkPhone()) return;
    void run(async () => {
      const token = await ensureSession();
      const card = await cardApi.freeDownload(token, { phone, marketingConsent: offers });
      setStep(card.status === 'READY' ? { kind: 'ready', option: 'FREE', card } : { kind: 'making', option: 'FREE', exportId: card.id });
    });
  };

  const planDownload = () =>
    run(async () => {
      const token = await ensureSession();
      const card = await cardApi.planDownload(token);
      setStep(card.status === 'READY' ? { kind: 'ready', option: 'PLAN', card } : { kind: 'making', option: 'PLAN', exportId: card.id });
    });

  const saveFile = (card: CardExportView) =>
    run(async () => {
      const token = await ensureSession();
      const { url } = await cardApi.exportDownload(token, card.id);
      startDownload(url);
    });

  // Plan holders: make the clean card as soon as the dialog opens (once; "Try again" asks again)…
  const planStarted = useRef(false);
  useEffect(() => {
    if (step.kind !== 'starting' || planStarted.current) return;
    planStarted.current = true;
    void planDownload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);
  // …and save it the moment it is ready.
  useEffect(() => {
    if (step.kind !== 'ready' || step.option !== 'PLAN' || autoSaved.current) return;
    autoSaved.current = true;
    void saveFile(step.card);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const pay = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!splitPhoneNumber(phone)) next.phone = t('cards.download.phoneInvalid');
    if (name.trim().length < 2) next.name = t('cards.download.nameInvalid');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) next.email = t('cards.download.emailInvalid');
    if (!terms) next.terms = t('cards.download.termsRequired');
    setErrors(next);
    if (Object.keys(next).length) return;
    void run(async () => {
      const token = await ensureSession();
      const checkout = await cardApi.createOrder(token, { phone, name: name.trim(), email: email.trim(), acceptTerms: true, marketingConsent: offers });
      rememberOrder({ orderToken: checkout.orderToken, reference: checkout.reference, templateKey: template.key, templateName: template.name, createdAt: Date.now() });
      if (checkout.status === 'PAID') {
        setStep({ kind: 'order', orderToken: checkout.orderToken });
        return;
      }
      const outcome = await runCheckout(
        { orderId: checkout.reference, status: 'CREATED', amountMinor: checkout.amountMinor, currency: checkout.currency, planName: t('cards.order.description'), keyId: checkout.keyId, providerOrderId: checkout.providerOrderId, prefill: checkout.prefill },
        {
          unavailable: t('error.PAYMENTS_UNAVAILABLE'),
          siteName,
          verify: (proof) => cardApi.verifyOrder(checkout.orderToken, proof),
          onFailedAttempt: (reason) => void cardApi.orderEvent(checkout.orderToken, { type: 'PAYMENT_FAILED', reason }),
        },
      );
      if (outcome === 'paid' || outcome === 'confirming') setStep({ kind: 'order', orderToken: checkout.orderToken });
      else {
        if (outcome === 'dismissed') void cardApi.orderEvent(checkout.orderToken, { type: 'PAYMENT_CANCELLED' });
        setStep({ kind: 'paid', notice: outcome === 'failed' ? t('cards.download.payFailed') : t('cards.download.payCancelled') });
      }
    });
  };

  const choosePaid = () => {
    void cardApi.event({ type: 'PAID_OPTION_SELECTED', templateKey: template.key, ...(sessionToken ? { session: sessionToken } : {}) });
    setErrors({});
    setStep({ kind: 'paid' });
  };

  const preview = (watermark: boolean, className?: string) => (
    <div className={cn('overflow-hidden rounded-xl shadow-clay', className)} style={{ aspectRatio: `${design.board.width} / ${design.board.height}` }}>
      <CardView design={design} ctx={editor.ctx} t={editor.cardT} watermark={watermark ? (config?.watermark ?? null) : null} />
    </div>
  );

  let body: ReactNode;
  switch (step.kind) {
    case 'starting':
      body = problem ? (
        <div className="space-y-4 py-4 text-center">
          <h2 id="download-title" className="font-display text-2xl text-ink">
            {t('cards.download.failedTitle')}
          </h2>
          <p className="text-sm text-stone-600">{problem}</p>
          <button type="button" disabled={working} onClick={() => void planDownload()} className={cn('btn-3d min-h-12 w-full justify-center rounded-xl', ACCENT)}>
            {t('cards.download.tryAgain')}
          </button>
          <button type="button" onClick={() => setStep({ kind: 'choose' })} className="text-sm font-semibold text-brand-700 hover:underline">
            {t('cards.download.otherWays')}
          </button>
        </div>
      ) : (
        <div role="status" className="space-y-4 py-6 text-center">
          <LoaderCircle aria-hidden className="mx-auto size-10 animate-spin text-brand-700" />
          <h2 id="download-title" className="font-display text-2xl text-ink">
            {t('cards.download.making')}
          </h2>
          <p className="flex items-center justify-center gap-1.5 text-sm text-stone-600">
            <Crown aria-hidden className="size-4 text-brand-700" /> {plan?.planName ? t('cards.download.planNamed', { plan: plan.planName }) : t('cards.download.plan')}
          </p>
        </div>
      );
      break;
    case 'choose':
      body = (
        <div className="space-y-5">
          <header className="text-center">
            <h2 id="download-title" className="font-display text-2xl text-ink sm:text-3xl">
              {t('cards.download.title')}
            </h2>
            <p className="mt-2 text-sm text-stone-600">{t('cards.download.subtitle')}</p>
          </header>
          {plan ? (
            <div className="rounded-3xl bg-gradient-to-br from-gold-100 to-surface p-4 shadow-clay ring-1 ring-gold-300/60">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                <Crown aria-hidden className="size-4" /> {plan.planName ? t('cards.download.planNamed', { plan: plan.planName }) : t('cards.download.plan')}
              </p>
              <p className="mt-1 text-sm text-stone-700">{t('cards.download.planBody')}</p>
              <button type="button" disabled={working} onClick={() => void planDownload()} className={cn('btn-3d mt-3 min-h-12 w-full justify-center gap-2 rounded-xl text-base disabled:opacity-60', ACCENT)}>
                {working ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Download aria-hidden className="size-5" />} {t('cards.download.planButton')}
              </button>
            </div>
          ) : null}
          {/* Phones: one small preview above the two choices, so both fit on the screen. */}
          <div className="sm:hidden">{preview(true, 'mx-auto w-24')}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionCard
              title={t('cards.download.freeTitle')}
              price={t('cards.download.freePrice')}
              points={[t('cards.download.freePoint1'), t('cards.download.freePoint2'), t('cards.download.freePoint3')]}
              preview={preview(true, 'mx-auto hidden w-28 sm:block')}
              action={
                <button type="button" onClick={() => setStep({ kind: 'free' })} className={cn('btn-3d btn-3d-light min-h-12 w-full justify-center rounded-xl text-sm', ACCENT)}>
                  {t('cards.download.freeButton')}
                </button>
              }
            />
            <OptionCard
              highlight
              title={t('cards.download.paidTitle')}
              price={t('cards.download.paidPrice', { price })}
              points={[t('cards.download.paidPoint1'), t('cards.download.paidPoint2'), t('cards.download.paidPoint3')]}
              preview={preview(false, 'mx-auto hidden w-28 sm:block')}
              action={
                <button type="button" disabled={!config?.paymentsReady} onClick={choosePaid} className={cn('btn-3d min-h-12 w-full justify-center rounded-xl text-sm disabled:opacity-60', ACCENT)}>
                  {config?.paymentsReady ? t('cards.download.paidButton', { price }) : t('cards.download.paidUnavailable')}
                </button>
              }
            />
          </div>
        </div>
      );
      break;
    case 'free':
      body = (
        <form onSubmit={freeDownload} className="space-y-5" noValidate>
          <BackButton onClick={() => setStep({ kind: 'choose' })} label={t('cards.download.back')} />
          <header>
            <h2 id="download-title" className="font-display text-2xl text-ink sm:text-3xl">
              {t('cards.download.freeFormTitle')}
            </h2>
            <p className="mt-2 text-sm text-stone-600">{t('cards.download.freeFormBody')}</p>
          </header>
          <div>
            <label htmlFor="card-phone" className="mb-1 block text-sm font-medium text-stone-700">
              {t('cards.download.phone')}
            </label>
            <PhoneInput id="card-phone" value={phone} onChange={setPhone} autoFocus aria-invalid={errors.phone ? true : undefined} aria-describedby="card-phone-help" />
            {errors.phone ? (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {errors.phone}
              </p>
            ) : null}
          </div>
          <OffersBox checked={offers} onChange={setOffers} t={t} />
          <p id="card-phone-help" className="flex gap-2 rounded-xl bg-stone-100 p-3 text-xs leading-relaxed text-stone-600">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" />
            <span>
              {t('cards.download.freePrivacy')}{' '}
              <Link href="/privacy" target="_blank" className="font-semibold text-brand-700 underline">
                {t('cards.download.privacyLink')}
              </Link>
            </span>
          </p>
          <p className="text-xs text-stone-500">{t('cards.download.watermarkNote')}</p>
          {problem ? <Problem text={problem} /> : null}
          <button type="submit" disabled={working} className={cn('btn-3d min-h-12 w-full justify-center gap-2 rounded-xl text-base disabled:opacity-60', ACCENT)}>
            {working ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Download aria-hidden className="size-5" />} {t('cards.download.continue')}
          </button>
          <button type="button" onClick={choosePaid} className="w-full text-center text-sm font-semibold text-brand-700 hover:underline">
            {t('cards.download.upsell', { price })}
          </button>
        </form>
      );
      break;
    case 'paid':
      body = (
        <form onSubmit={pay} className="space-y-4" noValidate>
          <BackButton onClick={() => setStep({ kind: 'choose' })} label={t('cards.download.back')} />
          <header>
            <h2 id="download-title" className="font-display text-2xl text-ink sm:text-3xl">
              {t('cards.download.paidFormTitle')}
            </h2>
            <p className="mt-2 text-sm text-stone-600">{t('cards.download.paidFormBody')}</p>
          </header>
          {step.notice ? <Problem text={step.notice} /> : null}
          <div>
            <label htmlFor="card-phone-paid" className="mb-1 block text-sm font-medium text-stone-700">
              {t('cards.download.phone')}
            </label>
            <PhoneInput id="card-phone-paid" value={phone} onChange={setPhone} aria-invalid={errors.phone ? true : undefined} />
            {errors.phone ? <p className="mt-1 text-sm text-red-700">{errors.phone}</p> : null}
          </div>
          <Input id="card-name" label={t('cards.download.name')} value={name} onChange={setName} error={errors.name} autoComplete="name" />
          <Input id="card-email" label={t('cards.download.email')} value={email} onChange={setEmail} error={errors.email} type="email" autoComplete="email" hint={t('cards.download.emailHint')} />
          <label className="flex cursor-pointer gap-3 text-sm text-stone-800">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-700" aria-invalid={errors.terms ? true : undefined} />
            <span>
              {t('cards.download.termsBefore')}{' '}
              <Link href="/terms" target="_blank" className="font-semibold text-brand-700 underline">
                {t('cards.download.terms')}
              </Link>{' '}
              {t('cards.download.termsAnd')}{' '}
              <Link href="/refund" target="_blank" className="font-semibold text-brand-700 underline">
                {t('cards.download.refund')}
              </Link>
            </span>
          </label>
          {errors.terms ? <p className="text-sm text-red-700">{errors.terms}</p> : null}
          <OffersBox checked={offers} onChange={setOffers} t={t} />
          <p className="text-xs leading-relaxed text-stone-500">
            {t('cards.download.paidPrivacy')}{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-brand-700 underline">
              {t('cards.download.privacyLink')}
            </Link>
          </p>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-clay-sm">
            <span className="text-sm text-stone-600">{t('cards.download.payable')}</span>
            <span className="font-display text-2xl text-ink">{price}</span>
          </div>
          {problem ? <Problem text={problem} /> : null}
          <button type="submit" disabled={working || !config?.paymentsReady} className={cn('btn-3d min-h-12 w-full justify-center gap-2 rounded-xl text-base disabled:opacity-60', ACCENT)}>
            {working ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Lock aria-hidden className="size-4" />} {t('cards.download.pay', { price })}
          </button>
          <p className="text-center text-xs text-stone-500">{t('cards.download.secure')}</p>
        </form>
      );
      break;
    case 'making':
      body = (
        <div role="status" className="space-y-4 py-6 text-center">
          <LoaderCircle aria-hidden className="mx-auto size-10 animate-spin text-brand-700" />
          <h2 id="download-title" className="font-display text-2xl text-ink">
            {t('cards.download.making')}
          </h2>
          <p className="text-sm text-stone-600">{t('cards.download.makingBody')}</p>
        </div>
      );
      break;
    case 'ready':
      body = (
        <div className="space-y-5 text-center">
          <span className="icon-3d mx-auto grid size-14 place-items-center rounded-2xl">
            <Check aria-hidden className="size-7" />
          </span>
          <h2 id="download-title" className="font-display text-2xl text-ink sm:text-3xl">
            {t('cards.download.readyTitle')}
          </h2>
          <p className="text-sm text-stone-600">{step.option === 'FREE' ? t('cards.download.readyFree') : t('cards.download.readyPlanSaved')}</p>
          {preview(step.option === 'FREE', 'mx-auto w-40')}
          {problem ? <Problem text={problem} /> : null}
          <button type="button" disabled={working} onClick={() => void saveFile(step.card)} className={cn('btn-3d min-h-13 w-full justify-center gap-2 rounded-2xl text-base disabled:opacity-60', ACCENT)}>
            {working ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Download aria-hidden className="size-5" />} {t('cards.download.save', { width: step.card.width, height: step.card.height })}
          </button>
          {step.option === 'FREE' && config?.paymentsReady ? (
            <div className="rounded-2xl bg-gradient-to-br from-gold-100/70 to-surface p-4 text-left shadow-clay-sm">
              <p className="text-sm font-semibold text-ink">{t('cards.download.upgradeTitle')}</p>
              <p className="mt-1 text-sm text-stone-600">{t('cards.download.upgradeBody', { price })}</p>
              <button type="button" onClick={choosePaid} className={cn('btn-3d mt-3 min-h-11 rounded-xl px-4 text-sm', ACCENT)}>
                {t('cards.download.paidButton', { price })}
              </button>
            </div>
          ) : null}
          <button type="button" onClick={onClose} className="text-sm font-semibold text-brand-700 hover:underline">
            {t('cards.download.keepEditing')}
          </button>
        </div>
      );
      break;
    case 'failed':
      body = (
        <div className="space-y-4 py-4 text-center">
          <h2 id="download-title" className="font-display text-2xl text-ink">
            {t('cards.download.failedTitle')}
          </h2>
          <p className="text-sm text-stone-600">{step.message}</p>
          <button type="button" disabled={working} onClick={() => (step.option === 'PLAN' ? void planDownload() : freeDownload())} className={cn('btn-3d min-h-12 w-full justify-center rounded-xl', ACCENT)}>
            {t('cards.download.tryAgain')}
          </button>
        </div>
      );
      break;
    case 'order':
      body = (
        <div className="space-y-4">
          <h2 id="download-title" className="sr-only">
            {t('cards.order.title')}
          </h2>
          <OrderStatus orderToken={step.orderToken} siteName={siteName} compact />
          <p className="flex items-center justify-center gap-1.5 text-xs text-stone-500">
            <Mail aria-hidden className="size-3.5" /> {t('cards.download.orderFootnote')}
          </p>
        </div>
      );
      break;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-title"
        tabIndex={-1}
        className="editor-chrome relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-canvas p-5 text-ink shadow-clay-raised outline-none sm:max-w-2xl sm:rounded-[2rem] sm:p-8"
      >
        <button type="button" onClick={onClose} aria-label={t('cards.download.close')} className="btn-3d btn-3d-light absolute top-4 right-4 size-10 rounded-full">
          <X aria-hidden className="size-4" />
        </button>
        {body}
      </div>
    </div>
  );
}

function OptionCard({ title, price, points, preview, action, highlight }: { title: string; price: string; points: string[]; preview: ReactNode; action: ReactNode; highlight?: boolean }) {
  return (
    <section className={cn('flex flex-col rounded-3xl p-4 shadow-clay', highlight ? 'bg-gradient-to-b from-gold-100/80 to-surface ring-1 ring-gold-300/70' : 'bg-surface')}>
      {preview}
      <h3 className="text-base font-semibold text-ink sm:mt-3">{title}</h3>
      <p className="font-display text-2xl text-brand-700">{price}</p>
      <ul className="mt-2 flex-1 space-y-1.5 text-sm text-stone-700">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-4">{action}</div>
    </section>
  );
}

function OffersBox({ checked, onChange, t }: { checked: boolean; onChange: (v: boolean) => void; t: CardEditorApi['t'] }) {
  return (
    <label className="flex cursor-pointer gap-3 text-sm text-stone-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-700" />
      <span>{t('cards.download.offers')}</span>
    </label>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
      <ArrowLeft aria-hidden className="size-4" /> {label}
    </button>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
      {text}
    </p>
  );
}

function Input({ id, label, value, onChange, error, type = 'text', autoComplete, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; type?: string; autoComplete?: string; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="block min-h-11 w-full rounded-xl border border-[var(--ed-field-line)] bg-[var(--ed-field)] px-3.5 text-base text-stone-900 shadow-clay-inset focus:border-brand-600 focus:bg-surface focus:ring-4 focus:ring-brand-100 focus:outline-none aria-invalid:border-red-500"
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
