'use client';

import { BadgeCheck, Crown, LoaderCircle, MessageSquareText, ShieldCheck, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { ApiError, apiGet } from '@/lib/api';
import { cardApi, rememberOrder } from '@/lib/cards';
import { runCheckout } from '@/lib/checkout';
import { inr, lookApi, lookCheckoutHref, type LookItem, type LookView } from '@/lib/previews';
import { useSession } from '@/lib/session';
import { track } from '@/lib/track';
import { cn } from '@/lib/utils';
import { Alert, Input, Textarea } from '@/components/ui/primitives';

const t = createTranslator('en');
const LINK = 'font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700';

function message(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `error.${error.code}` as MessageKey;
    const translated = t(key);
    if (translated !== key) return translated;
    if (error.status < 500) return error.message;
  }
  return error instanceof Error && error.message ? error.message : t('common.error');
}

/** A sheet from the bottom on phones, a card in the middle on wider screens. Mounted only while open. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-night-900/60 backdrop-blur-sm sm:items-center sm:p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="own-sheet-title"
        className="clay max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none animate-fade-in-up sm:max-w-lg sm:rounded-[2rem] sm:p-8"
        style={{ animationDuration: '0.35s' }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="own-sheet-title" className="font-display text-3xl leading-tight">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="btn-3d btn-3d-light size-10 shrink-0 rounded-full" aria-label={t('common.cancel')}>
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * The bottom of every preview page: "Make it yours" with the price (a plan,
 * or a card at the card price), and asking the designer for changes. Signed
 * out, it goes through signing in and comes back (?own=1); a plan that covers
 * the offer owns it at once, else the plan's checkout carries the page's link;
 * a card is paid for here, like any watermark-free card.
 */
export function OwnBar({ token, view, onOwned }: { token: string; view: LookView; onOwned?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const [sheet, setSheet] = useState<'signin' | 'card' | 'changes' | 'done' | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; claim?: boolean } | null>(null);
  const [owned, setOwned] = useState<{ eventId: string | null } | null>(null);
  const autoStarted = useRef(false);
  const cards = view.items.filter((i) => i.kind === 'CARD');
  const here = `/look/${token}`;

  const own = useCallback(async () => {
    setProblem(null);
    if (session.status === 'unknown') return;
    if (session.status === 'anonymous') {
      setSheet('signin');
      return;
    }
    track('preview_own_started', { offer: view.offer.kind });
    if (view.offer.kind === 'CARD') {
      setSheet('card');
      return;
    }
    setBusy(true);
    try {
      const result = await lookApi.own(token);
      if ('owned' in result) {
        setOwned({ eventId: result.eventId });
        setSheet('done');
        onOwned?.();
      } else if ('checkout' in result) router.push(lookCheckoutHref(result.checkout));
    } catch (error) {
      setProblem({ text: message(error), claim: error instanceof ApiError && error.code === 'ACCOUNT_UNVERIFIED' });
    } finally {
      setBusy(false);
    }
  }, [session.status, view.offer.kind, token, router, onOwned]);

  // Back from signing in: carry on where they left off, once.
  useEffect(() => {
    if (params.get('own') !== '1' || autoStarted.current || session.status !== 'signed-in') return;
    autoStarted.current = true;
    router.replace(here, { scroll: false });
    void own();
  }, [params, session.status, own, router, here]);

  if (view.state !== 'ready') return null;
  const offer = view.offer;

  return (
    <>
      {/* Room for the bar, so it never covers the last preview. */}
      <div aria-hidden className="h-36 sm:h-28" />
      <aside aria-label={t('look.bar.own')} className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] bg-night-900/95 text-ivory shadow-[0_-12px_40px_-18px_rgba(28,25,23,0.6)] ring-1 ring-gold-300/25 backdrop-blur-xl">
          {problem ? (
            <p role="alert" className="border-b border-white/10 bg-red-500/15 px-5 py-2.5 text-sm text-red-100">
              {problem.text}{' '}
              {problem.claim ? (
                <Link href={`/dashboard/claim?next=${encodeURIComponent(here)}`} className="font-semibold text-gold-200 underline underline-offset-4">
                  {t('claim.banner.cta')}
                </Link>
              ) : null}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-gold-200 uppercase">
                <Crown aria-hidden className="size-3.5" />
                {offer.kind === 'PLAN' ? offer.planName : t('look.kind.CARD')}
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-display text-2xl leading-tight">
                {offer.kind === 'PLAN' && offer.listPriceMinor && offer.listPriceMinor > offer.priceMinor ? <s className="text-base text-ivory/75">{inr(offer.listPriceMinor)}</s> : null}
                <span>{inr(offer.priceMinor)}</span>
                <span className="font-sans text-xs font-normal text-ivory/60">{offer.kind === 'PLAN' ? t('look.bar.once') : t('look.bar.perCard')}</span>
              </p>
              <p className="mt-0.5 hidden truncate text-xs text-ivory/65 sm:block">{offer.kind === 'PLAN' ? t('look.bar.includes', { plan: offer.planName }) : t('look.bar.cardIncludes')}</p>
            </div>
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setProblem(null);
                  setSheet('changes');
                }}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-ivory ring-1 ring-white/20 transition-colors hover:bg-white/10 sm:flex-none"
              >
                <MessageSquareText aria-hidden className="size-4" />
                {t('look.changes')}
              </button>
              <button
                type="button"
                onClick={() => void own()}
                disabled={busy || session.status === 'unknown'}
                className="inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-6 text-sm font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_-12px_rgba(227,197,133,0.8)] transition-colors hover:from-gold-100 hover:to-gold-200 disabled:opacity-70 sm:flex-none"
              >
                {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Sparkles aria-hidden className="size-4" />}
                {busy ? t('look.own.checking') : t('look.bar.own')}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {sheet === 'signin' ? (
        <Sheet title={t('look.own.title')} onClose={() => setSheet(null)}>
          <p className="leading-relaxed text-stone-700">{t('look.own.signIn')}</p>
          <Link href={`/login?next=${encodeURIComponent(`${here}?own=1`)}`} className="btn-3d mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base">
            <ShieldCheck aria-hidden className="size-4.5" />
            {t('look.own.signInCta')}
          </Link>
        </Sheet>
      ) : null}

      {sheet === 'card' && offer.kind === 'CARD' ? <CardPurchase token={token} cards={cards} priceMinor={offer.priceMinor} onClose={() => setSheet(null)} /> : null}

      {sheet === 'changes' ? <ChangesSheet token={token} onClose={() => setSheet(null)} /> : null}

      {sheet === 'done' ? (
        <Sheet title={t('look.owned.title')} onClose={() => setSheet(null)}>
          <p className="flex items-start gap-2 leading-relaxed text-stone-700">
            <BadgeCheck aria-hidden className="mt-1 size-5 shrink-0 text-emerald-600" />
            {t('look.own.done')}
          </p>
          <Link href={owned?.eventId ? `/dashboard/events/${owned.eventId}` : '/dashboard/cards'} className="btn-3d mt-6 flex min-h-12 w-full items-center justify-center rounded-full px-6 text-base">
            {owned?.eventId ? t('look.owned.cta') : t('look.owned.cards')}
          </Link>
        </Sheet>
      ) : null}
    </>
  );
}

/** Cards at the card price: which card, the email for the receipt, the terms; then Razorpay, then the card's order page. */
function CardPurchase({ token, cards, priceMinor, onClose }: { token: string; cards: LookItem[]; priceMinor: number; onClose: () => void }) {
  const router = useRouter();
  const [itemId, setItemId] = useState(cards[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // The account's email, to start from.
  useEffect(() => {
    apiGet<{ email: string | null }>('/users/me')
      .then((me) => setEmail((current) => current || me.email || ''))
      .catch(() => undefined);
  }, []);

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!terms) return setProblem(t('look.own.termsRequired'));
    setBusy(true);
    setProblem(null);
    try {
      const result = await lookApi.own(token, { itemId, email: email.trim() || undefined, acceptTerms: true });
      if (!('cardCheckout' in result)) {
        router.refresh();
        onClose();
        return;
      }
      const checkout = result.cardCheckout;
      const card = cards.find((c) => c.id === itemId);
      rememberOrder({ orderToken: checkout.orderToken, reference: checkout.reference, templateKey: card?.templateKey ?? '', templateName: card?.templateName ?? '', createdAt: Date.now() });
      if (checkout.status === 'PAID') {
        router.push(`/cards/order#${checkout.orderToken}`);
        return;
      }
      const outcome = await runCheckout(
        { orderId: checkout.reference, status: 'CREATED', amountMinor: checkout.amountMinor, currency: checkout.currency, planName: t('cards.order.description'), keyId: checkout.keyId, providerOrderId: checkout.providerOrderId, prefill: checkout.prefill },
        {
          unavailable: t('error.PAYMENTS_UNAVAILABLE'),
          verify: (proof) => cardApi.verifyOrder(checkout.orderToken, proof),
          onFailedAttempt: (reason) => void cardApi.orderEvent(checkout.orderToken, { type: 'PAYMENT_FAILED', reason }),
        },
      );
      if (outcome === 'paid' || outcome === 'confirming') {
        router.push(`/cards/order#${checkout.orderToken}`);
        return;
      }
      if (outcome === 'dismissed') void cardApi.orderEvent(checkout.orderToken, { type: 'PAYMENT_CANCELLED' });
      setProblem(outcome === 'failed' ? t('look.own.payFailed') : t('look.own.payCancelled'));
    } catch (error) {
      setProblem(message(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('look.own.title')} onClose={onClose}>
      <form onSubmit={(e) => void pay(e)} noValidate className="space-y-5">
        {cards.length > 1 ? (
          <fieldset>
            <legend className="text-sm font-medium text-stone-700">{t('look.own.chooseCard')}</legend>
            <div className="mt-2 grid gap-2">
              {cards.map((card) => (
                <label key={card.id} className={cn('flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 ring-1', itemId === card.id ? 'bg-brand-50 ring-brand-300' : 'bg-white/70 ring-gold-200')}>
                  <input type="radio" name="card" value={card.id} checked={itemId === card.id} onChange={() => setItemId(card.id)} className="size-4 accent-brand-700" />
                  <span className="font-medium text-ink">{card.templateName}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div>
          <label htmlFor="own-email" className="mb-1 block text-sm font-medium text-stone-700">
            {t('look.own.email')}
          </label>
          <Input id="own-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone-800">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-stone-300 accent-brand-700" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            {t('look.own.terms.before')}{' '}
            <Link href="/terms" target="_blank" className={LINK}>
              {t('auth.consent.terms')}
            </Link>{' '}
            {t('auth.consent.and')}{' '}
            <Link href="/refund" target="_blank" className={LINK}>
              {t('upgrade.consent.refund')}
            </Link>
            .
          </span>
        </label>
        {problem ? <Alert>{problem}</Alert> : null}
        <button type="submit" disabled={busy} className="btn-3d flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base">
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Sparkles aria-hidden className="size-4" />}
          {t('look.own.pay', { price: inr(priceMinor) })}
        </button>
        <p className="text-center text-xs text-stone-500">{t('look.bar.cardPrice', { price: inr(priceMinor) })}</p>
      </form>
    </Sheet>
  );
}

/** Asking the designer for changes, in the customer's words. */
function ChangesSheet({ token, onClose }: { token: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 2) return;
    setBusy(true);
    setProblem(null);
    try {
      await lookApi.changes(token, text.trim());
      track('preview_changes_asked');
      setSent(true);
    } catch (error) {
      setProblem(message(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t('look.changes.title')} onClose={onClose}>
      {sent ? (
        <p role="status" className="flex items-start gap-2 leading-relaxed text-stone-700">
          <BadgeCheck aria-hidden className="mt-1 size-5 shrink-0 text-emerald-600" />
          {t('look.changes.sent')}
        </p>
      ) : (
        <form onSubmit={(e) => void send(e)} className="space-y-4">
          <p className="text-sm leading-relaxed text-stone-600">{t('look.changes.hint')}</p>
          <Textarea aria-label={t('look.changes.title')} rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('look.changes.placeholder')} autoFocus />
          {problem ? <Alert>{problem}</Alert> : null}
          <button type="submit" disabled={busy || text.trim().length < 2} className="btn-3d flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base disabled:opacity-60">
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <MessageSquareText aria-hidden className="size-4" />}
            {t('look.changes.send')}
          </button>
        </form>
      )}
    </Sheet>
  );
}
