'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ImageOff, X } from 'lucide-react';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Button, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { ModerationItem } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export default function ModerationPage() {
  return (
    <RequirePermission permission="media.moderate">
      <Moderation />
    </RequirePermission>
  );
}

function Moderation() {
  const invalidate = useInvalidate();
  const queue = useQuery({ queryKey: ['admin', 'moderation'], queryFn: () => apiGet<ModerationItem[]>('/admin/moderation'), refetchInterval: 30_000 });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) => apiPost(`/admin/moderation/${id}`, { decision }),
    onSuccess: () => invalidate(['admin', 'moderation']),
  });

  return (
    <>
      <PageHeader title={t('moderation.title')} subtitle={t('moderation.subtitle')} />
      {decide.isError ? <Alert className="mb-4">{errorMessage(decide.error, t('common.error'))}</Alert> : null}
      {queue.isPending ? <Spinner /> : null}
      {queue.isError ? <ErrorNotice error={queue.error} /> : null}
      {queue.data && !queue.data.length ? <EmptyState>{t('moderation.none')}</EmptyState> : null}
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {queue.data?.map((item) => (
          <li key={item.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="grid aspect-square place-items-center bg-stone-100">
              {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageOff className="size-8 text-stone-300" aria-hidden />}
            </div>
            <div className="space-y-1 p-3 text-xs">
              <p className="truncate font-medium text-stone-900">{item.eventTitle}</p>
              <p className="truncate text-stone-500">{item.roomName}</p>
              <p className="text-stone-500">{item.uploaderName ? t('moderation.by', { name: item.uploaderName }) : t('moderation.anonymous')}</p>
              <p className="text-stone-400">{formatDateTime(item.createdAt)}</p>
              <div className="flex gap-1.5 pt-1">
                <Button size="sm" variant="success" className="flex-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.id, decision: 'APPROVE' })}>
                  <Check className="size-3.5" /> {t('common.approve')}
                </Button>
                <Button size="sm" variant="danger" className="flex-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.id, decision: 'REJECT' })}>
                  <X className="size-3.5" /> {t('common.reject')}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
