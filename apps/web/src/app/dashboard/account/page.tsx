'use client';

import { Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useMe } from '@/lib/queries';
import { Alert, Button, Card, Input } from '@/components/ui/primitives';
import { SignInMethods } from '@/components/account/sign-in-methods';
import { TwoStepCard } from '@/components/account/two-step-card';

export default function AccountPage() {
  const t = useT();
  const router = useRouter();
  const client = useQueryClient();
  const me = useMe();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setError(null);
    try {
      await apiDelete('/users/me');
      client.clear();
      router.replace('/');
    } catch (err) {
      setError(errorMessage(t, err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-4xl">{t('account.title')}</h1>
      <Card className="rounded-3xl">
        <p className="font-display text-2xl">{me.data?.name}</p>
        <p className="text-stone-600">{me.data?.email}</p>
      </Card>
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
        <a href="/api/v1/users/me/export" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold-400 px-5 text-sm font-medium hover:bg-gold-100">
          <Download aria-hidden className="size-4" />
          {t('account.export')}
        </a>
      </Card>
      <Card className="space-y-3 rounded-3xl border-red-200">
        <h2 className="font-display text-2xl text-red-800">{t('account.delete')}</h2>
        <p className="text-sm text-stone-600">{t('account.delete.body')}</p>
        {error ? <Alert>{error}</Alert> : null}
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" aria-label={t('account.delete.confirm')} />
        <Button variant="danger" className="rounded-full" disabled={confirm !== 'DELETE'} onClick={remove}>
          {t('account.delete')}
        </Button>
      </Card>
    </div>
  );
}
