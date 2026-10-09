'use client';

import { Check, KeyRound, MessageCircle, ShieldAlert, ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react';
import { Suspense } from 'react';
import { useT } from '@/lib/i18n';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { SignInMethods } from '@/components/account/sign-in-methods';
import { TwoStepCard } from '@/components/account/two-step-card';

/** Sign-in and security: how protected the account is (password, Google, WhatsApp, two-step), the ways to sign in, and two-step sign-in. */
export default function SecurityPage() {
  const t = useT();
  const me = useMe();
  const user = me.data;
  const checks: Array<{ ok: boolean; icon: LucideIcon; label: string; hint: string }> = user
    ? [
        { ok: user.hasPassword, icon: KeyRound, label: t('security.check.password'), hint: user.hasPassword ? t('security.check.passwordOn') : user.email ? t('security.check.passwordOff') : t('security.check.passwordNoEmail') },
        { ok: user.googleLinked, icon: ShieldCheck, label: t('security.check.google'), hint: user.googleLinked ? t('security.check.googleOn') : t('security.check.googleOff') },
        { ok: user.phoneVerified, icon: MessageCircle, label: t('security.check.whatsapp'), hint: user.phoneVerified ? t('security.check.whatsappOn') : t('security.check.whatsappOff') },
        { ok: user.mfaEnabled, icon: Smartphone, label: t('security.check.twoStep'), hint: user.mfaEnabled ? t('security.check.twoStepOn') : t('security.check.twoStepOff') },
      ]
    : [];
  const score = checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-6">
      <section aria-labelledby="security-title" className="clay rounded-[1.75rem] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          <span aria-hidden className={cn('grid size-14 shrink-0 place-items-center rounded-2xl text-white', score >= 2 ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 'bg-gradient-to-br from-amber-400 to-amber-600')}>
            {score >= 2 ? <ShieldCheck className="size-7" /> : <ShieldAlert className="size-7" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="security-title" className="font-display text-2xl leading-tight">
              {score >= 2 ? t('security.strong') : t('security.weak')}
            </h2>
            <p className="mt-0.5 text-sm text-stone-600">{t('security.score', { count: score, total: checks.length })}</p>
          </div>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {checks.map(({ ok, icon: Icon, label, hint }) => (
            <li key={label} className={cn('rounded-2xl border p-4', ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-gold-200 bg-white/60')}>
              <span className="flex items-center justify-between">
                <Icon aria-hidden className={cn('size-5', ok ? 'text-emerald-700' : 'text-gold-600')} />
                <span className={cn('grid size-5 place-items-center rounded-full', ok ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-500')}>
                  {ok ? <Check aria-hidden className="size-3" strokeWidth={3} /> : <span aria-hidden className="size-1.5 rounded-full bg-stone-400" />}
                </span>
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{hint}</p>
            </li>
          ))}
        </ul>
      </section>

      {user ? (
        <Suspense>
          <SignInMethods me={user} />
        </Suspense>
      ) : null}
      <TwoStepCard hasPassword={user?.hasPassword ?? true} />
    </div>
  );
}
