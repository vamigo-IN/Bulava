'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequirePermission, useCan, useInvalidate, useMe } from '@/components/shell';
import { Alert, Badge, Button, buttonVariants, EmptyState, ErrorNotice, Input, PageHeader, Select, Spinner, statusTone, Table, Td, Th } from '@/components/ui';
import { apiGet, apiPatch, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { ASSIGNABLE_ROLES, ROLE_RANK, type AdminUser, type PlatformRole } from '@/lib/types';
import { formatDate } from '@/lib/utils';

/** Every role, most senior first, for the filter. */
const ALL_ROLES = (Object.keys(ROLE_RANK) as PlatformRole[]).sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]);

export default function UsersPage() {
  return (
    <RequirePermission permission="admin.read">
      <Users />
    </RequirePermission>
  );
}

function Users() {
  const me = useMe();
  const canManageUsers = useCan('user.manage');
  const canManageStaff = useCan('staff.manage');
  const invalidate = useInvalidate();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const query = new URLSearchParams(Object.entries({ q: debounced, role }).filter(([, v]) => v)).toString();
  const users = useQuery({
    queryKey: ['admin', 'users', debounced, role],
    queryFn: () => apiGet<AdminUser[]>(`/admin/users${query ? `?${query}` : ''}`),
    placeholderData: (previous) => previous,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status?: 'ACTIVE' | 'SUSPENDED'; platformRole?: PlatformRole } }) => apiPatch(`/admin/users/${id}`, body),
    onSuccess: () => invalidate(['admin', 'users'], ['admin', 'staff']),
  });
  // Suspending customers is user.manage; anything about staff is the Super Admin's (staff.manage).
  const canSuspend = (u: AdminUser) => u.id !== me.id && u.platformRole !== 'SUPER_ADMIN' && u.status !== 'DELETED' && u.status !== 'PENDING_DELETION' && (u.platformRole === 'USER' ? canManageUsers : canManageStaff);
  const canChangeRole = (u: AdminUser) => canManageStaff && u.id !== me.id && u.platformRole !== 'SUPER_ADMIN' && u.status !== 'DELETED';

  return (
    <>
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="search" placeholder={t('users.search')} aria-label={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label={t('users.filterRole')} value={role} onChange={(e) => setRole(e.target.value)} className="w-auto">
          <option value="">{`${t('users.filterRole')}: ${t('common.all')}`}</option>
          <option value="STAFF">{t('users.staffOnly')}</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </Select>
      </div>
      {update.isError ? <Alert className="mb-4">{errorMessage(update.error, t('common.error'))}</Alert> : null}
      {users.isPending ? <Spinner /> : null}
      {users.isError ? <ErrorNotice error={users.error} /> : null}
      {users.data && !users.data.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
      {users.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('common.name')}</Th>
              <Th>{t('users.role')}</Th>
              <Th>{t('common.status')}</Th>
              <Th className="text-right">{t('users.events')}</Th>
              <Th className="text-right">{t('users.orders')}</Th>
              <Th>{t('users.joined')}</Th>
              <Th>
                <span className="sr-only">{t('common.actions')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => (
              <tr key={u.id}>
                <Td>
                  <Link href={`/users/${u.id}`} className="font-medium text-stone-900 underline-offset-2 hover:underline">
                    {u.name}
                  </Link>
                  <p className="text-xs break-all text-stone-500">{[u.email, u.phone].filter(Boolean).join(' · ')}</p>
                </Td>
                <Td>
                  {canChangeRole(u) ? (
                    <Select
                      aria-label={t('users.roleFor', { name: u.name })}
                      value={u.platformRole}
                      className="min-h-8 w-auto py-0 text-xs"
                      disabled={update.isPending}
                      onChange={(e) => {
                        const next = e.target.value as PlatformRole;
                        if (window.confirm(t('users.confirmRole', { name: u.name, role: t(`role.${next}`) }))) update.mutate({ id: u.id, body: { platformRole: next } });
                      }}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`role.${r}`)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge tone={u.platformRole === 'USER' ? 'neutral' : 'gold'}>{t(`role.${u.platformRole}`)}</Badge>
                  )}
                </Td>
                <Td>
                  <Badge tone={statusTone(u.status)}>{t(`user.${u.status}`)}</Badge>
                </Td>
                <Td className="text-right tabular-nums">{u._count.ownedEvents}</Td>
                <Td className="text-right tabular-nums">{u._count.orders}</Td>
                <Td className="whitespace-nowrap">{formatDate(u.createdAt)}</Td>
                <Td className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Link href={`/users/${u.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                      {t('users.open')}
                      <span className="sr-only"> {u.name}</span>
                    </Link>
                    {canSuspend(u) ? (
                      u.status === 'ACTIVE' ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={update.isPending}
                          onClick={() => window.confirm(t('users.confirmSuspend', { name: u.name })) && update.mutate({ id: u.id, body: { status: 'SUSPENDED' } })}
                        >
                          {t('users.suspend')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={update.isPending} onClick={() => update.mutate({ id: u.id, body: { status: 'ACTIVE' } })}>
                          {t('users.reactivate')}
                        </Button>
                      )
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </>
  );
}
