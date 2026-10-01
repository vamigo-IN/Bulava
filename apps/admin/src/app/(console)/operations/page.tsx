'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { QueueTable } from '@/components/queue-table';
import { RequirePermission, useCan, useInvalidate } from '@/components/shell';
import { Alert, Button, EmptyState, ErrorNotice, PageHeader, Spinner, Table, Td, Th } from '@/components/ui';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { FailedRender, QueueCounts } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export default function OperationsPage() {
  return (
    <RequirePermission permission="admin.read">
      <Operations />
    </RequirePermission>
  );
}

function Operations() {
  const canRetry = useCan('template.manage');
  const invalidate = useInvalidate();
  const queues = useQuery({ queryKey: ['admin', 'queues'], queryFn: () => apiGet<QueueCounts>('/admin/queues'), refetchInterval: 10_000 });
  const failed = useQuery({ queryKey: ['admin', 'renders', 'failed'], queryFn: () => apiGet<FailedRender[]>('/admin/renders/failed') });
  const [retried, setRetried] = useState(false);
  const retry = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/renders/${id}/retry`),
    onSuccess: async () => {
      setRetried(true);
      await invalidate(['admin', 'renders', 'failed'], ['admin', 'queues']);
    },
  });

  return (
    <>
      <PageHeader
        title={t('ops.title')}
        subtitle={t('ops.subtitle')}
        actions={
          <Button variant="secondary" onClick={() => Promise.all([queues.refetch(), failed.refetch()])} disabled={queues.isFetching || failed.isFetching}>
            <RefreshCw className="size-4" /> {t('common.refresh')}
          </Button>
        }
      />
      <h2 className="mb-3 text-base font-semibold">{t('overview.queues')}</h2>
      {queues.isPending ? <Spinner /> : null}
      {queues.isError ? <ErrorNotice error={queues.error} /> : null}
      {queues.data ? <QueueTable counts={queues.data} /> : null}

      <h2 className="mt-8 mb-3 text-base font-semibold">{t('ops.failedRenders')}</h2>
      {retry.isError ? <Alert className="mb-3">{errorMessage(retry.error, t('common.error'))}</Alert> : null}
      {retried && !retry.isError ? (
        <Alert tone="success" className="mb-3">
          {t('ops.retried')}
        </Alert>
      ) : null}
      {failed.isPending ? <Spinner /> : null}
      {failed.isError ? <ErrorNotice error={failed.error} /> : null}
      {failed.data && !failed.data.length ? <EmptyState>{t('ops.noFailures')}</EmptyState> : null}
      {failed.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('common.created')}</Th>
              <Th>{t('ops.template')}</Th>
              <Th>{t('ops.error')}</Th>
              <Th className="text-right">{t('ops.attempts')}</Th>
              {canRetry ? <Th /> : null}
            </tr>
          </thead>
          <tbody>
            {failed.data.map((job) => (
              <tr key={job.id}>
                <Td className="whitespace-nowrap">{formatDateTime(job.createdAt)}</Td>
                <Td>
                  <p className="font-medium">{job.templateVersion.template.name}</p>
                  <p className="font-mono text-xs text-stone-500">{job.eventId}</p>
                </Td>
                <Td className="max-w-md">
                  <p className="line-clamp-3 font-mono text-xs break-words text-red-800">{job.error ?? t('common.none')}</p>
                </Td>
                <Td className="text-right tabular-nums">{job.attempts}</Td>
                {canRetry ? (
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" disabled={retry.isPending} onClick={() => retry.mutate(job.id)}>
                      <RotateCcw className="size-3.5" /> {t('common.retry')}
                    </Button>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </>
  );
}
