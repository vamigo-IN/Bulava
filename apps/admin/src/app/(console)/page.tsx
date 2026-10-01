'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { RequirePermission } from '@/components/shell';
import { QueueTable } from '@/components/queue-table';
import { Button, Card, CardTitle, EmptyState, ErrorNotice, PageHeader, Spinner, StatCard } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { AdminStats } from '@/lib/types';
import { formatBytes, formatInr, formatNumber } from '@/lib/utils';

export default function OverviewPage() {
  return (
    <RequirePermission permission="admin.read">
      <Overview />
    </RequirePermission>
  );
}

function Overview() {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => apiGet<AdminStats>('/admin/stats'), refetchInterval: 30_000 });
  const s = stats.data;

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={
          <Button variant="secondary" onClick={() => stats.refetch()} disabled={stats.isFetching}>
            <RefreshCw className={stats.isFetching ? 'size-4 animate-spin' : 'size-4'} /> {t('common.refresh')}
          </Button>
        }
      />
      {stats.isPending ? <Spinner /> : null}
      {stats.isError ? <ErrorNotice error={stats.error} /> : null}
      {s ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label={t('stat.users')} value={formatNumber(s.users)} />
            <StatCard label={t('stat.events')} value={formatNumber(s.events)} hint={`${formatNumber(s.activeEvents)} ${t('stat.activeEvents').toLowerCase()}`} />
            <StatCard label={t('stat.invitations')} value={formatNumber(s.invitations)} />
            <StatCard label={t('stat.rsvps')} value={formatNumber(s.rsvps)} />
            <StatCard label={t('stat.revenue')} value={formatInr(s.revenueMinor)} hint={`${formatNumber(s.orders)} ${t('stat.orders').toLowerCase()}`} />
            <StatCard label={t('stat.conversion')} value={`${(s.conversion * 100).toFixed(1)}%`} />
            <StatCard label={t('stat.videos')} value={formatNumber(s.videosGenerated)} />
            <StatCard label={t('stat.renderFailures')} value={formatNumber(s.renderFailures)} tone={s.renderFailures ? 'danger' : undefined} />
            <StatCard label={t('stat.uploads')} value={formatNumber(s.mediaUploads)} />
            <StatCard label={t('stat.storage')} value={formatBytes(s.storageBytes)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle>{t('overview.popularTemplates')}</CardTitle>
              {s.popularTemplates.length ? (
                <BarList rows={s.popularTemplates.map((p) => ({ id: p.key, label: p.name, value: p.count }))} format={(n) => t('overview.selections', { count: n })} />
              ) : (
                <EmptyState>{t('common.empty')}</EmptyState>
              )}
            </Card>
            <Card>
              <CardTitle>{t('overview.languages')}</CardTitle>
              {s.popularLanguages.length ? (
                <BarList rows={s.popularLanguages.map((l) => ({ label: l.language, value: l.count }))} format={(n) => formatNumber(n)} />
              ) : (
                <EmptyState>{t('common.empty')}</EmptyState>
              )}
            </Card>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold">{t('overview.queues')}</h2>
            <QueueTable counts={s.queues} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function BarList({ rows, format }: { rows: Array<{ id?: string; label: string; value: number }>; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id ?? r.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate font-medium text-stone-800">{r.label}</span>
            <span className="shrink-0 text-stone-500 tabular-nums">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-gold-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
