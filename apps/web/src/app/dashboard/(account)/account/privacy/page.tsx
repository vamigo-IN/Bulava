'use client';

import { Download, FileText, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_RESTORE_DAYS } from '@bulava/validation';
import { api } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useMe } from '@/lib/queries';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';

/** Privacy and data: a copy of everything, the policies, and deleting the account. */
export default function PrivacyPage() {
  const t = useT();
  const me = useMe();
  return (
    <div className="space-y-6">
      <section className="clay rounded-[1.75rem] p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span aria-hidden className="icon-3d size-10 shrink-0 rounded-xl">
            <Download className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight">{t('account.export')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('account.export.body')}</p>
          </div>
        </div>
        {/* A file download from the API, not a page: a plain link is correct. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/v1/users/me/export" className="btn-3d btn-3d-light mt-5 min-h-11 rounded-2xl px-5 text-sm">
          <Download aria-hidden className="size-4" />
          {t('account.export')}
        </a>
      </section>

      <section className="clay rounded-[1.75rem] p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span aria-hidden className="icon-3d size-10 shrink-0 rounded-xl">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight">{t('privacy.policies')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('privacy.policiesBody')}</p>
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['/privacy', 'privacy.link.privacy'],
              ['/terms', 'privacy.link.terms'],
              ['/cookies', 'privacy.link.cookies'],
              ['/account-deletion', 'privacy.link.deletion'],
              ['/grievance-redressal', 'privacy.link.grievance'],
            ] as const
          ).map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-xs">
                {t(label)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <DeleteAccount hasPassword={me.data?.hasPassword ?? true} />
    </div>
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
    <section className="clay space-y-4 rounded-[1.75rem] border border-red-200 p-5 sm:p-7">
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
    </section>
  );
}
