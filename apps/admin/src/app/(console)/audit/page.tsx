'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RequirePermission } from '@/components/shell';
import { Badge, EmptyState, ErrorNotice, Input, PageHeader, Spinner, statusTone, Table, Td, Th } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { AuditEntry } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const UUID = /^[0-9a-f-]{36}$/i;

export default function AuditPage() {
  return (
    <RequirePermission permission="admin.read">
      <Audit />
    </RequirePermission>
  );
}

function Audit() {
  const [action, setAction] = useState('');
  const [eventId, setEventId] = useState('');
  const [filters, setFilters] = useState({ action: '', eventId: '' });
  useEffect(() => {
    const id = setTimeout(() => setFilters({ action: action.trim(), eventId: UUID.test(eventId.trim()) ? eventId.trim() : '' }), 300);
    return () => clearTimeout(id);
  }, [action, eventId]);
  const params = new URLSearchParams({ ...(filters.action ? { action: filters.action } : {}), ...(filters.eventId ? { eventId: filters.eventId } : {}) }).toString();
  const log = useQuery({ queryKey: ['admin', 'audit', params], queryFn: () => apiGet<AuditEntry[]>(`/admin/audit${params ? `?${params}` : ''}`) });

  return (
    <>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder={t('audit.action')} aria-label={t('audit.action')} value={action} onChange={(e) => setAction(e.target.value)} className="max-w-56 font-mono" />
        <Input placeholder={t('audit.eventId')} aria-label={t('audit.eventId')} value={eventId} onChange={(e) => setEventId(e.target.value)} className="max-w-80 font-mono" />
      </div>
      {log.isPending ? <Spinner /> : null}
      {log.isError ? <ErrorNotice error={log.error} /> : null}
      {log.data && !log.data.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
      {log.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('audit.time')}</Th>
              <Th>{t('audit.action')}</Th>
              <Th>{t('audit.actor')}</Th>
              <Th>{t('audit.target')}</Th>
              <Th>{t('audit.result')}</Th>
              <Th>{t('audit.ip')}</Th>
              <Th>{t('audit.details')}</Th>
            </tr>
          </thead>
          <tbody>
            {log.data.map((row) => {
              const meta = row.metadata && typeof row.metadata === 'object' && Object.keys(row.metadata).length ? JSON.stringify(row.metadata) : '';
              return (
                <tr key={row.id}>
                  <Td className="text-xs whitespace-nowrap">{formatDateTime(row.createdAt)}</Td>
                  <Td className="font-mono text-xs">{row.action}</Td>
                  <Td className="text-xs">
                    {row.actorType}
                    {row.actorId ? <span className="block font-mono text-stone-400">{row.actorId.slice(0, 8)}</span> : null}
                  </Td>
                  <Td className="text-xs">
                    {row.targetType}
                    {row.targetId ? <span className="block font-mono text-stone-400">{row.targetId.slice(0, 8)}</span> : null}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(row.result)}>{row.result}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">{row.ipAddress ?? t('common.none')}</Td>
                  <Td className="max-w-xs">{meta ? <code className="line-clamp-2 text-xs break-all text-stone-500">{meta}</code> : null}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : null}
    </>
  );
}
