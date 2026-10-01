'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RequirePermission } from '@/components/shell';
import { Badge, EmptyState, ErrorNotice, PageHeader, Spinner, statusTone } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { LicenseAlert } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function LicensesPage() {
  return (
    <RequirePermission permission="asset.manage">
      <LicenseAlerts />
    </RequirePermission>
  );
}

function LicenseAlerts() {
  const alerts = useQuery({ queryKey: ['admin', 'license-alerts'], queryFn: () => apiGet<LicenseAlert[]>('/admin/licenses/alerts') });
  return (
    <>
      <PageHeader title={t('alerts.title')} subtitle={t('alerts.subtitle')} />
      {alerts.isPending ? <Spinner /> : null}
      {alerts.isError ? <ErrorNotice error={alerts.error} /> : null}
      {alerts.data && !alerts.data.length ? <EmptyState>{t('alerts.none')}</EmptyState> : null}
      <ul className="space-y-4">
        {alerts.data?.map((a) => {
          const templates = a.assets.flatMap((asset) => asset.templates);
          const unique = [...new Map(templates.map((tpl) => [tpl.id, tpl])).values()];
          return (
            <li key={a.licenseId} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{a.provider}</p>
                <Badge tone={a.expired ? 'danger' : 'warning'}>
                  {a.expired ? t('alerts.expired') : t('alerts.expiring')} · {formatDate(a.expiresAt)}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-stone-600">
                {[...a.assets.map((x) => x.name), ...a.music.map((m) => m.title)].join(', ') || t('common.none')}
              </p>
              <p className="mt-3 text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('alerts.affected')}</p>
              {unique.length ? (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {unique.map((tpl) => (
                    <li key={tpl.id}>
                      <Link href={`/templates/${tpl.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1 text-sm hover:border-brand-600">
                        {tpl.name} <Badge tone={statusTone(tpl.status)}>{t(`status.${tpl.status}`)}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-stone-500">{t('alerts.noTemplates')}</p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
