'use client';

import { Hourglass, Lock, Mail, RotateCcw, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { MessageKey } from '@bulava/localization';
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui/primitives';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useInvalidateEvent, useTeam } from '@/lib/queries';
import type { TeamMember, TeamRole } from '@/lib/types';

const GRANTABLE: TeamRole[] = ['CO_HOST', 'GUEST_MANAGER', 'MEDIA_MANAGER', 'PHOTOGRAPHER', 'FUNCTION_MANAGER', 'ADMIN'];

/**
 * The event team. Someone with a Bulava account joins at once; anyone else is
 * emailed a link and a 6-digit code, and shows as waiting until they join.
 * Each role sees only its own sections of the event.
 */
export function TeamCard({ eventId, myRole }: { eventId: string; myRole: string }) {
  const t = useT();
  const invalidate = useInvalidateEvent(eventId);
  const team = useTeam(eventId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('CO_HOST');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';
  // Only the owner handles admins; the API enforces the same rule.
  const grantable = GRANTABLE.filter((r) => r !== 'ADMIN' || myRole === 'OWNER');

  async function run(action: () => Promise<string | undefined | void>) {
    setBusy(true);
    setMessage(null);
    try {
      const success = await action();
      if (success) setMessage({ tone: 'success', text: success });
      await invalidate();
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const to = email.trim().toLowerCase();
    void run(async () => {
      const result = await apiPost<{ kind: 'MEMBER' | 'INVITED' }>(`/events/${eventId}/members`, { email: to, role });
      setEmail('');
      return result.kind === 'INVITED' ? t('team.invited', { email: to }) : t('team.added');
    });
  }

  const editable = (m: TeamMember) => canManage && !m.isYou && m.role !== 'OWNER' && (m.role !== 'ADMIN' || myRole === 'OWNER');
  const invites = team.data?.invites ?? [];

  return (
    <Card className="space-y-4 rounded-3xl">
      <div>
        <h2 className="font-display text-2xl">{t('team.title')}</h2>
        <p className="text-sm text-stone-600">{t('team.subtitle')}</p>
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {team.isError ? <Alert>{errorMessage(t, team.error)}</Alert> : null}
      <ul className="divide-y divide-gold-100 rounded-2xl border border-gold-200 bg-white">
        {team.data?.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                {m.user.name} {m.isYou ? <Badge tone="neutral">{t('team.you')}</Badge> : null}
              </p>
              <p className="truncate text-xs text-stone-500">{m.user.email}</p>
            </div>
            {editable(m) ? (
              <div className="flex items-center gap-2">
                <Select
                  aria-label={t('team.role')}
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => void run(() => apiPatch(`/events/${eventId}/members/${m.id}`, { role: e.target.value }).then(() => undefined))}
                  className="min-h-9 w-auto py-0 text-sm"
                >
                  {grantable.map((r) => (
                    <option key={r} value={r}>
                      {t(`team.role.${r}` as MessageKey)}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => window.confirm(t('team.confirmRemove', { name: m.user.name })) && void run(() => apiDelete(`/events/${eventId}/members/${m.id}`).then(() => undefined))}
                >
                  {t('team.remove')}
                </Button>
              </div>
            ) : (
              <Badge tone={m.role === 'OWNER' ? 'brand' : 'neutral'}>{t(`team.role.${m.role}` as MessageKey)}</Badge>
            )}
          </li>
        ))}
        {invites.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 bg-sand/30 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium">
                <Mail aria-hidden className="size-4 text-gold-600" />
                <span className="truncate">{inv.email}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <Badge tone={inv.status === 'LOCKED' ? 'danger' : 'warning'}>
                  {inv.status === 'LOCKED' ? <Lock aria-hidden className="size-3" /> : <Hourglass aria-hidden className="size-3" />}
                  {inv.status === 'LOCKED' ? t('team.locked') : t('team.pending')}
                </Badge>
                {t(`team.role.${inv.role}` as MessageKey)}
                {inv.invitedBy ? <span>· {t('team.invitedBy', { name: inv.invitedBy })}</span> : null}
              </p>
            </div>
            {canManage && (inv.role !== 'ADMIN' || myRole === 'OWNER') ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => apiPost(`/events/${eventId}/members/invites/${inv.id}/resend`).then(() => t('team.resent', { email: inv.email })))}>
                  <RotateCcw aria-hidden className="size-4" />
                  {t('team.resend')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => window.confirm(t('team.confirmRevoke', { email: inv.email })) && void run(() => apiDelete(`/events/${eventId}/members/invites/${inv.id}`).then(() => undefined))}
                >
                  <X aria-hidden className="size-4" />
                  {t('team.revokeInvite')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <Field label={t('team.email')}>{(p) => <Input {...p} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label={t('team.role')}>
            {(p) => (
              <Select {...p} value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
                {grantable.map((r) => (
                  <option key={r} value={r}>
                    {t(`team.role.${r}` as MessageKey)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button type="submit" disabled={busy}>
            {t('team.add')}
          </Button>
          <p className="text-xs text-stone-500 sm:col-span-3">{t(`team.role.${role}.desc` as MessageKey)}</p>
        </form>
      ) : null}
    </Card>
  );
}
