'use client';

import { ArrowRight, CalendarHeart, ChevronRight, MessageCircle, ReceiptIndianRupee, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { keys, useEvents, useMe } from '@/lib/queries';
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';

/** Profile: what the account holds at a glance, and the details hosts can change. */
export default function AccountPage() {
  const t = useT();
  const me = useMe();
  const events = useEvents();
  const orders = useQuery({ queryKey: ['orders', 'mine'], queryFn: () => apiGet<Array<{ status: string; kind: string }>>('/orders') });
  const user = me.data;
  const methods = user ? [user.hasPassword, user.googleLinked, user.mfaEnabled].filter(Boolean).length : 0;

  return (
    <div className="space-y-6">
      {user?.provisional ? (
        <Link href="/dashboard/claim?next=%2Fdashboard%2Faccount" className="clay clay-lift group flex items-center gap-4 rounded-3xl border border-gold-300 p-5">
          <span className="icon-3d size-11 shrink-0 rounded-xl">
            <ShieldCheck aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl text-ink">{t('claim.title')}</span>
            <span className="block text-sm text-stone-600">{t('claim.banner')}</span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-stone-400 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-3">
        <Tile href="/dashboard/events" icon={CalendarHeart} label={t('account.tile.events')} value={String(events.data?.length ?? '…')} hint={t('account.tile.eventsHint')} />
        <Tile
          href="/dashboard/payments"
          icon={ReceiptIndianRupee}
          label={t('account.tile.plans')}
          value={String(orders.data?.filter((o) => o.status === 'PAID').length ?? '…')}
          hint={t('account.tile.plansHint')}
        />
        <Tile href="/dashboard/account/security" icon={ShieldCheck} label={t('account.tile.security')} value={t('account.tile.securityValue', { count: methods })} hint={user?.mfaEnabled ? t('account.fact.twoStep') : t('account.tile.securityHint')} warn={!user?.mfaEnabled} />
      </ul>

      {user ? <ProfileCard me={user} /> : null}
    </div>
  );
}

function Tile({ href, icon: Icon, label, value, hint, warn }: { href: string; icon: LucideIcon; label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <li>
      <Link href={href} className="clay clay-lift group flex h-full flex-col rounded-3xl p-5">
        <span className="flex items-start justify-between gap-3">
          <span className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{label}</span>
          <span aria-hidden className="icon-3d size-9 shrink-0 rounded-xl">
            <Icon className="size-4" />
          </span>
        </span>
        <span className="mt-2 font-display text-3xl leading-none text-ink">{value}</span>
        <span className={cn('mt-auto flex items-center gap-1 pt-3 text-xs', warn ? 'text-amber-800' : 'text-stone-500')}>
          {hint}
          <ArrowRight aria-hidden className="ml-auto size-3.5 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
        </span>
      </Link>
    </li>
  );
}

/** Name, email, WhatsApp number and the optional WhatsApp-updates consent. */
function ProfileCard({ me }: { me: User }) {
  const t = useT();
  const client = useQueryClient();
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [updates, setUpdates] = useState(me.whatsappUpdates);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => {
    setName(me.name);
    setPhone(me.phone ?? '');
    setUpdates(me.whatsappUpdates);
  }, [me]);
  const dirty = name.trim() !== me.name || phone.trim() !== (me.phone ?? '') || updates !== me.whatsappUpdates;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await apiPatch('/users/me', { name: name.trim(), phone: phone.trim(), whatsappUpdates: updates });
      await client.invalidateQueries({ queryKey: keys.me });
      setNotice({ tone: 'success', text: t('account.profileSaved') });
    } catch (err) {
      setNotice({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="clay rounded-[1.75rem] p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span aria-hidden className="icon-3d size-10 shrink-0 rounded-xl">
          <UserRound className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-2xl leading-tight">{t('account.details')}</h2>
          <p className="mt-0.5 text-sm text-stone-600">{t('account.detailsHint')}</p>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.field.name')}>{(p) => <Input {...p} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label={t('auth.field.email')} hint={t('account.emailHint')}>
            {(p) => <Input {...p} type="email" value={me.email ?? ''} readOnly disabled />}
          </Field>
          <Field label={t('account.phone')} hint={t('account.phone.hint')}>
            {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
        </div>

        {/* The optional updates consent: a switch of its own, never ticked for the host. */}
        <label className={cn('flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors', updates ? 'border-emerald-200 bg-emerald-50/60' : 'border-gold-200 bg-white/60', !phone.trim() && 'cursor-not-allowed opacity-60')}>
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#075E54] text-white">
            <MessageCircle className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{t('account.whatsappUpdates')}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-stone-600">{t('account.whatsappUpdates.hint')}</span>
          </span>
          <input type="checkbox" role="switch" className="mt-1 size-5 shrink-0 accent-brand-700" checked={updates} disabled={!phone.trim()} onChange={(e) => setUpdates(e.target.checked)} />
        </label>

        <div className="flex flex-wrap items-center gap-3 border-t border-gold-100 pt-4">
          <Button type="submit" className="rounded-2xl" disabled={!dirty || busy}>
            {busy ? t('common.saving') : t('account.saveProfile')}
          </Button>
          {dirty ? <span className="text-xs font-medium text-amber-700">{t('account.unsaved')}</span> : null}
        </div>
      </div>
    </form>
  );
}
