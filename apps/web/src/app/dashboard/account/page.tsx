'use client';

import { ChevronRight, Download, ReceiptIndianRupee, ShieldAlert, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_RESTORE_DAYS } from '@bulava/validation';
import { api, apiPatch } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { keys, useMe } from '@/lib/queries';
import type { User } from '@/lib/types';
import { Alert, Button, Card, Checkbox, Field, Input } from '@/components/ui/primitives';
import { SignInMethods } from '@/components/account/sign-in-methods';
import { TwoStepCard } from '@/components/account/two-step-card';

export default function AccountPage() {
  const t = useT();
  const me = useMe();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-4xl">{t('account.title')}</h1>
      {me.data?.provisional ? (
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
      {me.data ? <ProfileCard me={me.data} /> : null}
      <Link href="/dashboard/payments" className="clay clay-lift group flex items-center gap-4 rounded-3xl p-5">
        <span className="icon-3d size-11 shrink-0 rounded-xl">
          <ReceiptIndianRupee aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl text-ink">{t('account.payments')}</span>
          <span className="block text-sm text-stone-600">{t('account.payments.body')}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 text-stone-400 transition-transform group-hover:translate-x-0.5" />
      </Link>
      {me.data ? (
        <Suspense>
          <SignInMethods me={me.data} />
        </Suspense>
      ) : null}
      <TwoStepCard hasPassword={me.data?.hasPassword ?? true} />
      <Card className="space-y-3 rounded-3xl">
        <h2 className="font-display text-2xl">{t('account.export')}</h2>
        <p className="text-sm text-stone-600">{t('account.export.body')}</p>
        {/* A file download from the API, not a page: a plain link is correct. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/v1/users/me/export" className="btn-3d btn-3d-light min-h-11 rounded-2xl px-5 text-sm">
          <Download aria-hidden className="size-4" />
          {t('account.export')}
        </a>
      </Card>
      <DeleteAccount hasPassword={me.data?.hasPassword ?? true} />
    </div>
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
    <Card className="rounded-3xl">
      <form onSubmit={submit} className="space-y-4">
        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.field.name')}>{(p) => <Input {...p} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label={t('auth.field.email')}>{(p) => <Input {...p} type="email" value={me.email ?? ''} readOnly disabled />}</Field>
          <Field label={t('account.phone')} hint={t('account.phone.hint')}>
            {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
        </div>
        <Checkbox label={t('account.whatsappUpdates')} checked={updates} disabled={!phone.trim()} onChange={(e) => setUpdates(e.target.checked)} />
        <p className="-mt-2 text-xs text-stone-500">{t('account.whatsappUpdates.hint')}</p>
        <Button type="submit" className="rounded-2xl" disabled={!dirty || busy}>
          {busy ? t('common.saving') : t('account.saveProfile')}
        </Button>
      </form>
    </Card>
  );
}

/**
 * Deleting the account: the events go offline at once and everything is erased
 * after ACCOUNT_RESTORE_DAYS, unless the owner signs in before then and restores it.
 */
function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const t = useT();
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = hasPassword ? password.length > 0 : confirm === 'DELETE';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ deleteAt: string }>('/users/me', { method: 'DELETE', body: hasPassword ? { password } : { confirm } });
      client.clear();
      router.replace(`/login?deleted=${encodeURIComponent(result.deleteAt)}`);
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 rounded-3xl border-red-200">
      <h2 className="flex items-center gap-2.5 font-display text-2xl text-red-800">
        <ShieldAlert aria-hidden className="size-6" /> {t('account.delete')}
      </h2>
      <p className="text-sm leading-relaxed text-stone-700">{t('account.delete.body', { days: ACCOUNT_RESTORE_DAYS })}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone-600 marker:text-red-300">
        <li>{t('account.delete.point.offline')}</li>
        <li>{t('account.delete.point.restore', { days: ACCOUNT_RESTORE_DAYS })}</li>
        <li>{t('account.delete.point.erase')}</li>
        <li>{t('account.delete.point.records')}</li>
      </ul>
      {!open ? (
        <Button variant="danger" className="rounded-2xl" onClick={() => setOpen(true)}>
          {t('account.delete')}
        </Button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {error ? <Alert>{error}</Alert> : null}
          {hasPassword ? (
            <Field label={t('account.delete.password')}>
              {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
          ) : (
            <Field label={t('account.delete.confirm')}>
              {(p) => <Input {...p} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" />}
            </Field>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" className="rounded-2xl" disabled={!ready || busy}>
              {busy ? t('common.loading') : t('account.delete.submit', { days: ACCOUNT_RESTORE_DAYS })}
            </Button>
            <Button variant="ghost" className="rounded-2xl" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
