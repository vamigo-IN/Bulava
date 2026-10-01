'use client';

import { Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { MessageKey } from '@bulava/localization';
import { Alert, Badge, Button, Card, Field, Input, Spinner } from '@/components/ui/primitives';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';

interface DomainRecord {
  type: 'TXT' | 'CNAME' | 'A';
  name: string;
  value: string;
  alternative?: boolean;
}

interface DomainState {
  /** False when the platform has no certificate source for customer domains. */
  available: boolean;
  entitled: boolean;
  target: { cname: string; addresses: string[] };
  domain: {
    hostname: string;
    status: 'PENDING' | 'ACTIVE' | 'FAILED';
    url: string | null;
    lastError: string | null;
    lastCheckedAt: string | null;
    records: DomainRecord[];
  } | null;
}

const TONE = { PENDING: 'warning', ACTIVE: 'success', FAILED: 'danger' } as const;

/** Connect the event to the host's own domain: DNS instructions, status and checks. */
export function DomainCard({ eventId }: { eventId: string }) {
  const t = useT();
  const state = useQuery({ queryKey: ['events', eventId, 'domain'], queryFn: () => apiGet<DomainState>(`/events/${eventId}/domain`) });
  const [hostname, setHostname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await state.refetch();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  const connect = (e: FormEvent) => {
    e.preventDefault();
    void run(() => apiPut(`/events/${eventId}/domain`, { hostname }));
  };

  if (state.isPending) return <Spinner label={t('common.loading')} />;
  const data = state.data;
  if (!data) return null;
  const d = data.domain;

  return (
    <Card className="space-y-4 rounded-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 font-display text-2xl">
            <Globe aria-hidden className="size-5 text-gold-600" />
            {t('domain.title')}
          </h2>
          <p className="max-w-prose text-sm text-stone-600">{t('domain.subtitle')}</p>
        </div>
        {d ? <Badge tone={TONE[d.status]}>{t(`domain.status.${d.status}` as MessageKey)}</Badge> : null}
      </div>
      {error ? <Alert>{error}</Alert> : null}

      {!data.available && !d ? <Alert tone="info">{t('domain.unavailable')}</Alert> : null}

      {data.available && !data.entitled && !d ? (
        <Alert tone="info">
          {t('domain.upsell')}{' '}
          <Link href={`/dashboard/events/${eventId}/upgrade`} className="font-medium underline">
            {t('domain.upgrade')}
          </Link>
        </Alert>
      ) : null}

      {data.available && data.entitled && !d ? (
        <form onSubmit={connect} className="flex flex-wrap items-end gap-2">
          <Field label={t('domain.input')} hint={t('domain.inputHint')}>
            {(p) => <Input {...p} required maxLength={253} placeholder="amanweddsriya.com" value={hostname} onChange={(e) => setHostname(e.target.value)} className="w-72 max-w-full" />}
          </Field>
          <Button type="submit" disabled={busy}>
            {t('domain.connect')}
          </Button>
        </form>
      ) : null}

      {d ? (
        <div className="space-y-4">
          {d.status === 'ACTIVE' && d.url ? (
            <p className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
              {t('domain.live')}{' '}
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                {d.url.replace(/^https?:\/\//, '')}
              </a>
            </p>
          ) : (
            <>
              {d.lastError ? <Alert tone={d.status === 'FAILED' ? 'danger' : 'warning'}>{t(`domain.error.${d.lastError}` as MessageKey)}</Alert> : null}
              <p className="text-sm font-medium">{t('domain.records')}</p>
              <div className="overflow-x-auto rounded-xl border border-gold-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gold-100/60 text-xs text-stone-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">{t('domain.type')}</th>
                      <th className="px-3 py-2">{t('domain.name')}</th>
                      <th className="px-3 py-2">{t('domain.value')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold-100 font-mono text-xs">
                    {d.records.map((r) => (
                      <tr key={`${r.type}-${r.value}`} className={r.alternative ? 'text-stone-500' : undefined}>
                        <td className="px-3 py-2">{r.type}</td>
                        <td className="px-3 py-2 break-all select-all">{r.name}</td>
                        <td className="px-3 py-2 break-all select-all">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {d.records.some((r) => r.alternative) ? <p className="text-xs text-stone-500">{t('domain.orA')}</p> : null}
              <p className="text-xs text-stone-500">{t('domain.propagation')}</p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(() => apiPost(`/events/${eventId}/domain/check`))}>
              {busy ? t('common.loading') : t('domain.check')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => window.confirm(t('domain.confirmRemove', { domain: d.hostname })) && void run(() => apiDelete(`/events/${eventId}/domain`))}
            >
              {t('domain.remove')}
            </Button>
          </div>
          {d.lastCheckedAt ? <p className="text-xs text-stone-500">{t('domain.lastChecked', { when: new Date(d.lastCheckedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) })}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
