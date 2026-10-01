'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Crown, KeyRound, LogOut, UserMinus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { RequirePermission, useInvalidate, useMe } from '@/components/shell';
import { Alert, Badge, Button, Card, CardTitle, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, statusTone, Table, Td, Th } from '@/components/ui';
import { apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { ASSIGNABLE_ROLES, type AdminUser, type PlatformRole, type StaffOverview } from '@/lib/types';

type Person = StaffOverview['people'][number];

/** Staff roles, least to most access (the matrix columns). */
const MATRIX_ROLES: PlatformRole[] = ['SUPPORT', 'CONTENT_MANAGER', 'FINANCE_MANAGER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];
const STAFF_ROLES = ASSIGNABLE_ROLES.filter((r) => r !== 'USER');

export default function StaffPage() {
  return (
    <RequirePermission permission="staff.manage">
      <PageHeader title={t('staff.title')} subtitle={t('staff.subtitle')} />
      <Staff />
    </RequirePermission>
  );
}

function Staff() {
  const staff = useQuery({ queryKey: ['admin', 'staff'], queryFn: () => apiGet<StaffOverview>('/admin/staff') });
  if (staff.isPending) return <Spinner />;
  if (staff.isError) return <ErrorNotice error={staff.error} />;
  const { people, staffMfaRequired, roles } = staff.data;
  return (
    <div className="max-w-5xl space-y-6">
      <SuperAdminCard people={people} mfaRequired={staffMfaRequired} />
      <StaffList people={people} mfaRequired={staffMfaRequired} />
      <AddStaff />
      <RoleMatrix roles={roles} />
    </div>
  );
}

/** Password (and authenticator code, when two-step is on) for the Super Admin's sensitive actions. */
function IdentityFields({ password, code, onPassword, onCode }: { password: string; code: string; onPassword: (v: string) => void; onCode: (v: string) => void }) {
  const me = useMe();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('staff.password')}>{(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => onPassword(e.target.value)} />}</Field>
      {me.mfaEnabled ? (
        <Field label={t('staff.code')}>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,8}"
              maxLength={8}
              required
              className="font-mono tracking-widest"
              value={code}
              onChange={(e) => onCode(e.target.value)}
            />
          )}
        </Field>
      ) : null}
    </div>
  );
}

const identity = (password: string, code: string) => ({ password, ...(code.trim() ? { code: code.replace(/\s/g, '') } : {}) });

function SuperAdminCard({ people, mfaRequired }: { people: Person[]; mfaRequired: boolean }) {
  const me = useMe();
  const superAdmin = people.find((p) => p.platformRole === 'SUPER_ADMIN') ?? null;
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="mb-1 flex items-center gap-2">
            <Crown className="size-4 text-gold-600" aria-hidden /> {t('staff.superAdmin')}
          </CardTitle>
          <p className="max-w-2xl text-sm text-stone-500">{t('staff.superAdminBody')}</p>
        </div>
        {superAdmin && superAdmin.id === me.id ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t('staff.transfer')}
          </Button>
        ) : null}
      </div>
      {superAdmin ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-gold-50 px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium text-stone-900">
              {superAdmin.name} {superAdmin.id === me.id ? <Badge tone="gold">{t('staff.you')}</Badge> : null}
            </p>
            <p className="text-sm break-all text-stone-600">{superAdmin.email}</p>
          </div>
          <Badge tone={superAdmin.mfaEnabled ? 'success' : 'warning'} className="ml-auto">
            {t('staff.twoStep')}: {superAdmin.mfaEnabled ? t('mfa.on') : t('mfa.off')}
          </Badge>
        </div>
      ) : (
        <Alert tone="warning" className="mt-4">
          {t('staff.none')}
        </Alert>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t('staff.transfer')}>
        <TransferForm people={people} mfaRequired={mfaRequired} onCancel={() => setOpen(false)} />
      </Modal>
    </Card>
  );
}

function TransferForm({ people, mfaRequired, onCancel }: { people: Person[]; mfaRequired: boolean; onCancel: () => void }) {
  const me = useMe();
  const router = useRouter();
  const invalidate = useInvalidate();
  const candidates = people.filter((p) => p.id !== me.id && p.status === 'ACTIVE' && p.email);
  const eligible = (p: Person) => !mfaRequired || p.mfaEnabled;
  const [userId, setUserId] = useState(() => candidates.find(eligible)?.id ?? '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const transfer = useMutation({ mutationFn: () => apiPost<{ superAdminId: string }>('/admin/staff/transfer-super-admin', { userId, ...identity(password, code) }) });
  const chosen = candidates.find((p) => p.id === userId);

  if (transfer.isSuccess) {
    // Only now refresh this account's permissions: the console closes the Super Admin pages.
    const finish = async () => {
      await invalidate(['me'], ['admin']);
      router.replace('/');
    };
    return (
      <div className="space-y-4">
        <Alert tone="success">{t('staff.transferDone', { name: chosen?.name ?? '' })}</Alert>
        <Button onClick={() => void finish()}>{t('common.close')}</Button>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (userId) transfer.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-stone-600">{t('staff.transferBody')}</p>
      {mfaRequired ? <p className="text-xs text-stone-500">{t('staff.transferMfaNote')}</p> : null}
      {candidates.length ? (
        <Field label={t('staff.transferTo')}>
          {(p) => (
            <Select {...p} required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="" disabled>
                {t('staff.choose')}
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id} disabled={!eligible(c)}>
                  {eligible(c) ? `${c.name} · ${c.email}` : t('staff.needsTwoStep', { name: `${c.name} · ${c.email}` })}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <Alert tone="info">{t('staff.noCandidates')}</Alert>
      )}
      <IdentityFields password={password} code={code} onPassword={setPassword} onCode={setCode} />
      {transfer.isError ? <Alert>{errorMessage(transfer.error, t('common.error'))}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="danger" disabled={!userId || !password || transfer.isPending}>
          {transfer.isPending ? t('common.saving') : t('staff.transferConfirm')}
        </Button>
      </div>
    </form>
  );
}

function StaffList({ people, mfaRequired }: { people: Person[]; mfaRequired: boolean }) {
  const me = useMe();
  const invalidate = useInvalidate();
  const [notice, setNotice] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<Person | null>(null);
  const refresh = () => invalidate(['admin', 'staff'], ['admin', 'users']);
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) => apiPatch(`/admin/users/${id}`, { platformRole: role }),
    onSuccess: async () => {
      setNotice(null);
      await refresh();
    },
  });
  const signOut = useMutation({
    mutationFn: (id: string) => apiPost<{ revoked: number }>(`/admin/users/${id}/sessions/revoke`),
    onSuccess: (r) => setNotice(t('staff.signedOut', { count: r.revoked })),
  });
  const error = setRole.error ?? signOut.error;
  const sorted = [...people].sort((a, b) => MATRIX_ROLES.indexOf(b.platformRole) - MATRIX_ROLES.indexOf(a.platformRole) || a.name.localeCompare(b.name));

  return (
    <section aria-labelledby="staff-people">
      <h2 id="staff-people" className="mb-3 text-base font-semibold text-stone-900">
        {t('staff.people')}
      </h2>
      {mfaRequired ? (
        <Alert tone="info" className="mb-3">
          {t('staff.mfaRequired')}
        </Alert>
      ) : null}
      {error ? <Alert className="mb-3">{errorMessage(error, t('common.error'))}</Alert> : null}
      {notice ? (
        <Alert tone="success" className="mb-3">
          {notice}
        </Alert>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>{t('common.name')}</Th>
            <Th>{t('users.role')}</Th>
            <Th>{t('staff.twoStep')}</Th>
            <Th>{t('common.status')}</Th>
            <Th>
              <span className="sr-only">{t('common.actions')}</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const self = p.id === me.id;
            const protectedRow = self || p.platformRole === 'SUPER_ADMIN';
            return (
              <tr key={p.id}>
                <Td>
                  <Link href={`/users/${p.id}`} className="font-medium text-stone-900 underline-offset-2 hover:underline">
                    {p.name}
                  </Link>{' '}
                  {self ? <Badge tone="gold">{t('staff.you')}</Badge> : null}
                  <p className="text-xs break-all text-stone-500">{p.email}</p>
                </Td>
                <Td>
                  {protectedRow ? (
                    <Badge tone="gold">{t(`role.${p.platformRole}`)}</Badge>
                  ) : (
                    <Select
                      aria-label={t('users.roleFor', { name: p.name })}
                      value={p.platformRole}
                      className="min-h-8 w-auto py-0 text-xs"
                      disabled={setRole.isPending}
                      onChange={(e) => {
                        const role = e.target.value as PlatformRole;
                        if (window.confirm(t('users.confirmRole', { name: p.name, role: t(`role.${role}`) }))) setRole.mutate({ id: p.id, role });
                      }}
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`role.${r}`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Td>
                <Td>
                  <Badge tone={p.mfaEnabled ? 'success' : mfaRequired ? 'warning' : 'neutral'}>{p.mfaEnabled ? t('mfa.on') : t('mfa.off')}</Badge>
                </Td>
                <Td>
                  <Badge tone={statusTone(p.status)}>{t(`user.${p.status}`)}</Badge>
                </Td>
                <Td className="text-right">
                  {protectedRow ? null : (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {p.mfaEnabled ? (
                        <Button size="sm" variant="secondary" onClick={() => setResetFor(p)}>
                          <KeyRound className="size-3.5" aria-hidden /> {t('staff.resetTwoStep')}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={signOut.isPending}
                        onClick={() => window.confirm(t('profile.confirmSignOut', { name: p.name })) && signOut.mutate(p.id)}
                      >
                        <LogOut className="size-3.5" aria-hidden /> {t('staff.signOut')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={setRole.isPending}
                        onClick={() => window.confirm(t('staff.confirmRemove', { name: p.name })) && setRole.mutate({ id: p.id, role: 'USER' })}
                      >
                        <UserMinus className="size-3.5" aria-hidden /> {t('staff.remove')}
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Modal open={Boolean(resetFor)} onClose={() => setResetFor(null)} title={t('staff.resetTwoStep')}>
        {resetFor ? <ResetTwoStepForm person={resetFor} onDone={() => setResetFor(null)} /> : null}
      </Modal>
    </section>
  );
}

function ResetTwoStepForm({ person, onDone }: { person: Person; onDone: () => void }) {
  const invalidate = useInvalidate();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const reset = useMutation({
    mutationFn: () => apiPost(`/admin/users/${person.id}/mfa/reset`, identity(password, code)),
    onSuccess: () => invalidate(['admin', 'staff']),
  });
  if (reset.isSuccess) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{t('staff.resetDone')}</Alert>
        <Button onClick={onDone}>{t('common.close')}</Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        reset.mutate();
      }}
    >
      <p className="text-sm text-stone-600">{t('staff.resetTwoStepBody', { name: person.name })}</p>
      <IdentityFields password={password} code={code} onPassword={setPassword} onCode={setCode} />
      {reset.isError ? <Alert>{errorMessage(reset.error, t('common.error'))}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="danger" disabled={!password || reset.isPending}>
          {reset.isPending ? t('common.saving') : t('staff.resetTwoStep')}
        </Button>
      </div>
    </form>
  );
}

function AddStaff() {
  const invalidate = useInvalidate();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [roles, setRoles] = useState<Record<string, PlatformRole>>({});
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const matches = useQuery({
    queryKey: ['admin', 'users', 'candidates', debounced],
    queryFn: () => apiGet<AdminUser[]>(`/admin/users?role=USER&status=ACTIVE&q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
  });
  const assign = useMutation({
    mutationFn: ({ user, role }: { user: AdminUser; role: PlatformRole }) => apiPatch(`/admin/users/${user.id}`, { platformRole: role }).then(() => ({ user, role })),
    onSuccess: async ({ user, role }) => {
      setAdded(t('staff.added', { name: user.name, role: t(`role.${role}`) }));
      await invalidate(['admin', 'staff'], ['admin', 'users']);
    },
  });
  const rows = (matches.data ?? []).slice(0, 8);
  return (
    <Card>
      <CardTitle className="mb-1 flex items-center gap-2">
        <UserPlus className="size-4" aria-hidden /> {t('staff.add')}
      </CardTitle>
      <p className="mb-4 max-w-2xl text-sm text-stone-500">{t('staff.addBody')}</p>
      <Field label={t('staff.find')} className="max-w-md">
        {(p) => <Input {...p} type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />}
      </Field>
      {added ? (
        <Alert tone="success" className="mt-3">
          {added}
        </Alert>
      ) : null}
      {assign.isError ? <Alert className="mt-3">{errorMessage(assign.error, t('common.error'))}</Alert> : null}
      {debounced.length >= 2 ? (
        <div className="mt-4">
          {matches.isPending ? <Spinner /> : null}
          {matches.isError ? <ErrorNotice error={matches.error} /> : null}
          {matches.data && !rows.length ? <EmptyState>{t('staff.noMatch')}</EmptyState> : null}
          {rows.length ? (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
              {rows.map((u) => {
                const role = roles[u.id] ?? 'SUPPORT';
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">{u.name}</p>
                      <p className="text-xs break-all text-stone-500">{u.email}</p>
                    </div>
                    <Select
                      aria-label={t('users.roleFor', { name: u.name })}
                      value={role}
                      className="min-h-8 w-auto py-0 text-xs"
                      onChange={(e) => setRoles((r) => ({ ...r, [u.id]: e.target.value as PlatformRole }))}
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`role.${r}`)}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      disabled={assign.isPending}
                      onClick={() => window.confirm(t('users.confirmRole', { name: u.name, role: t(`role.${role}`) })) && assign.mutate({ user: u, role })}
                    >
                      {t('staff.assign')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function RoleMatrix({ roles }: { roles: StaffOverview['roles'] }) {
  // Every permission, in the order the Super Admin's role lists them.
  const permissions = roles.SUPER_ADMIN;
  return (
    <section aria-labelledby="staff-matrix">
      <h2 id="staff-matrix" className="mb-3 text-base font-semibold text-stone-900">
        {t('staff.matrix')}
      </h2>
      <dl className="mb-4 grid gap-3 sm:grid-cols-2">
        {MATRIX_ROLES.map((role) => (
          <div key={role} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
            <dt className="text-sm font-semibold text-stone-900">{t(`role.${role}`)}</dt>
            <dd className="mt-0.5 text-sm text-stone-500">{t(`role.desc.${role}`)}</dd>
          </div>
        ))}
      </dl>
      <Table>
        <thead>
          <tr>
            <Th>{t('staff.permission')}</Th>
            {MATRIX_ROLES.map((role) => (
              <Th key={role} className="text-center">
                {t(`role.${role}`)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission) => (
            <tr key={permission}>
              <Td>{t(`perm.${permission}`)}</Td>
              {MATRIX_ROLES.map((role) => (
                <Td key={role} className="text-center">
                  {roles[role].includes(permission) ? (
                    <>
                      <Check className="mx-auto size-4 text-green-700" aria-hidden />
                      <span className="sr-only">{t('common.yes')}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-stone-300" aria-hidden>
                        —
                      </span>
                      <span className="sr-only">{t('common.no')}</span>
                    </>
                  )}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
