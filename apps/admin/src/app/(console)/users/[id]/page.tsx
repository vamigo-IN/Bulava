'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Gift, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FEATURE_KEYS } from '@bulava/validation';
import { OrderActionButtons, PaymentStateBadge, useOrderActions } from '@/components/orders';
import { RequirePermission, useCan, useInvalidate, useMe } from '@/components/shell';
import { Alert, Badge, Button, Card, CardTitle, EmptyState, ErrorNotice, Field, PageHeader, Select, Spinner, StatCard, statusTone, Table, Tabs, Td, Textarea, Th } from '@/components/ui';
import { apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { t, tMaybe } from '@/lib/i18n';
import type { UserProfile } from '@/lib/types';
import { formatDate, formatDateTime, formatInr, formatNumber } from '@/lib/utils';

type Tab = 'events' | 'payments' | 'plan' | 'sessions' | 'activity';
type Entitlement = UserProfile['entitlements'][number];

/** On/off features; the rest carry a count limit. */
const SWITCH_FEATURES = new Set<string>([FEATURE_KEYS.VIDEO_HD, FEATURE_KEYS.WATERMARK, FEATURE_KEYS.PLANNER, FEATURE_KEYS.CUSTOM_DOMAIN]);

interface PublicPlan {
  key: string;
  name: string;
  priceMinor: number;
  interval: string;
}

export default function UserProfilePage() {
  return (
    <RequirePermission permission="admin.read">
      <ProfileLoader />
    </RequirePermission>
  );
}

function BackLink() {
  return (
    <Link href="/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
      <ArrowLeft className="size-4" aria-hidden /> {t('profile.back')}
    </Link>
  );
}

function ProfileLoader() {
  const { id } = useParams<{ id: string }>();
  const profile = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => apiGet<UserProfile>(`/admin/users/${id}`) });
  return (
    <div className="max-w-6xl">
      <BackLink />
      {profile.isPending ? <Spinner /> : null}
      {profile.isError ? <ErrorNotice error={profile.error} /> : null}
      {profile.data ? <Profile profile={profile.data} /> : null}
    </div>
  );
}

function Profile({ profile }: { profile: UserProfile }) {
  const { user, summary } = profile;
  const [tab, setTab] = useState<Tab>('events');
  const orderActions = useOrderActions();
  return (
    <>
      <ProfileHeader profile={profile} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t('profile.events')} value={formatNumber(summary.events)} />
        <StatCard label={t('profile.guests')} value={formatNumber(summary.guests)} />
        <StatCard label={t('profile.invitations')} value={formatNumber(summary.invitations)} />
        <StatCard label={t('profile.photos')} value={formatNumber(summary.photos)} />
        <StatCard label={t('profile.videos')} value={formatNumber(summary.videos)} />
        {summary.totalPaidMinor !== undefined ? (
          <StatCard label={t('profile.paid')} value={formatInr(summary.totalPaidMinor)} hint={t('profile.paidHint', { count: summary.paidOrders ?? 0 })} />
        ) : null}
      </div>
      {summary.accountPlan ? <p className="mt-3 text-sm text-stone-600">{t('profile.accountPlan', { plan: summary.accountPlan })}</p> : null}

      <Tabs<Tab>
        className="mt-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'events', label: t('profile.tab.events') },
          { key: 'payments', label: t('profile.tab.payments') },
          { key: 'plan', label: t('profile.tab.plan') },
          { key: 'sessions', label: t('profile.tab.sessions') },
          { key: 'activity', label: t('profile.tab.activity') },
        ]}
      />
      <div role="tabpanel" className="mt-5">
        {tab === 'events' ? <EventsTab profile={profile} /> : null}
        {tab === 'payments' ? (
          <>
            {orderActions.status}
            <PaymentsTab profile={profile} actions={orderActions} customer={user.email ?? user.name} />
          </>
        ) : null}
        {tab === 'plan' ? <PlanTab profile={profile} /> : null}
        {tab === 'sessions' ? <SessionsTab profile={profile} /> : null}
        {tab === 'activity' ? <ActivityTab profile={profile} /> : null}
      </div>
    </>
  );
}

function ProfileHeader({ profile }: { profile: UserProfile }) {
  const { user } = profile;
  const me = useMe();
  const invalidate = useInvalidate();
  const canManageUsers = useCan('user.manage');
  const canManageStaff = useCan('staff.manage');
  const [notice, setNotice] = useState<string | null>(null);
  const self = user.id === me.id;
  const isStaff = user.platformRole !== 'USER';
  // The Super Admin is protected; staff accounts are the Super Admin's to manage.
  const canAct = !self && user.platformRole !== 'SUPER_ADMIN' && user.status !== 'DELETED' && (isStaff ? canManageStaff : canManageUsers);
  const refresh = () => invalidate(['admin', 'user', user.id], ['admin', 'users'], ['admin', 'staff']);
  const setStatus = useMutation({
    mutationFn: (status: 'ACTIVE' | 'SUSPENDED') => apiPatch(`/admin/users/${user.id}`, { status }),
    onSuccess: async () => {
      setNotice(null);
      await refresh();
    },
  });
  const signOut = useMutation({
    mutationFn: () => apiPost<{ revoked: number }>(`/admin/users/${user.id}/sessions/revoke`),
    onSuccess: async (r) => {
      setNotice(t('profile.signedOut', { count: r.revoked }));
      await refresh();
    },
  });
  const error = setStatus.error ?? signOut.error;

  return (
    <div className="mb-6">
      <PageHeader
        title={user.name}
        subtitle={[user.email, user.phone].filter(Boolean).join(' · ')}
        actions={
          canAct ? (
            <>
              <Button variant="secondary" size="sm" disabled={signOut.isPending} onClick={() => window.confirm(t('profile.confirmSignOut', { name: user.name })) && signOut.mutate()}>
                <LogOut className="size-3.5" aria-hidden /> {t('staff.signOut')}
              </Button>
              {user.status === 'ACTIVE' ? (
                <Button variant="danger" size="sm" disabled={setStatus.isPending} onClick={() => window.confirm(t('users.confirmSuspend', { name: user.name })) && setStatus.mutate('SUSPENDED')}>
                  {t('users.suspend')}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate('ACTIVE')}>
                  {t('users.reactivate')}
                </Button>
              )}
            </>
          ) : null
        }
      />
      <div className="-mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={isStaff ? 'gold' : 'neutral'}>{t(`role.${user.platformRole}`)}</Badge>
        <Badge tone={statusTone(user.status)}>{t(`user.${user.status}`)}</Badge>
        {user.email ? <Badge tone={user.emailVerifiedAt ? 'success' : 'warning'}>{user.emailVerifiedAt ? t('profile.emailVerified') : t('profile.emailUnverified')}</Badge> : null}
        {user.googleLinked ? <Badge>{t('profile.google')}</Badge> : null}
        {user.mfaEnabled ? <Badge tone="success">{t('profile.twoStepOn')}</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-stone-500">
        {t('profile.joined', { date: formatDate(user.createdAt) })} · {user.lastActiveAt ? t('profile.lastActive', { when: formatDateTime(user.lastActiveAt) }) : t('profile.neverActive')}
      </p>
      {user.platformRole === 'SUPER_ADMIN' ? (
        <Alert tone="info" className="mt-3">
          {t('profile.superAdminNote')}
        </Alert>
      ) : null}
      {error ? <Alert className="mt-3">{errorMessage(error, t('common.error'))}</Alert> : null}
      {notice ? (
        <Alert tone="success" className="mt-3">
          {notice}
        </Alert>
      ) : null}
    </div>
  );
}

function EventsTab({ profile }: { profile: UserProfile }) {
  return (
    <div className="space-y-6">
      {profile.events.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('profile.event')}</Th>
              <Th>{t('profile.plan')}</Th>
              <Th>{t('profile.templates')}</Th>
              <Th>{t('profile.usage')}</Th>
            </tr>
          </thead>
          <tbody>
            {profile.events.map((e) => (
              <tr key={e.id}>
                <Td>
                  <p className="font-medium text-stone-900">{e.title}</p>
                  <p className="text-xs text-stone-500">
                    {e.typeKey} · {formatDate(e.createdAt)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone={statusTone(e.status)}>{tMaybe(`eventStatus.${e.status}`, e.status)}</Badge>
                    {e.domain ? <Badge tone={statusTone(e.domain.status)}>{t('profile.domain', { hostname: e.domain.hostname })}</Badge> : null}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{e.plan}</Td>
                <Td>
                  {e.templates.length ? (
                    <ul className="space-y-1">
                      {e.templates.map((tpl) => (
                        <li key={`${tpl.output}-${tpl.key}`}>
                          <span className="text-xs text-stone-500">{tMaybe(`type.${tpl.output}`, tpl.output)}:</span> <span className="font-medium text-stone-800">{tpl.name}</span>{' '}
                          <Badge tone={tpl.tier === 'FREE' ? 'neutral' : 'gold'}>{t(`tier.${tpl.tier}`)}</Badge> <span className="text-xs text-stone-500">v{tpl.version}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-stone-400">{t('profile.noTemplate')}</span>
                  )}
                  {e.videos.length ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-stone-500">
                      {e.videos.map((v, i) => (
                        <li key={`${v.createdAt}-${i}`}>{t('profile.video', { template: v.template, status: tMaybe(`videoStatus.${v.status}`, v.status), date: formatDate(v.createdAt) })}</li>
                      ))}
                    </ul>
                  ) : null}
                </Td>
                <Td className="text-xs text-stone-600">
                  {t('profile.usageLine', { guests: formatNumber(e.counts.guests), invitations: formatNumber(e.counts.invitations), photos: formatNumber(e.counts.photos), videos: formatNumber(e.counts.videoJobs) })}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState>{t('profile.noEvents')}</EmptyState>
      )}
      {profile.memberships.length ? (
        <Card>
          <CardTitle>{t('profile.memberOf')}</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {profile.memberships.map((m) => (
              <li key={m.event.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-stone-800">{m.event.title}</span>
                <Badge>{tMaybe(`eventRole.${m.role}`, m.role)}</Badge>
                <Badge tone={statusTone(m.event.status)}>{tMaybe(`eventStatus.${m.event.status}`, m.event.status)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function PaymentsTab({ profile, actions, customer }: { profile: UserProfile; actions: ReturnType<typeof useOrderActions>; customer: string }) {
  if (!profile.orders) return <Alert tone="info">{t('profile.billingHidden')}</Alert>;
  if (!profile.orders.length) return <EmptyState>{t('profile.noOrders')}</EmptyState>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('common.created')}</Th>
          <Th>{t('orders.plan')}</Th>
          <Th className="text-right">{t('orders.amount')}</Th>
          <Th>{t('orders.payment')}</Th>
          <Th>{t('profile.reference')}</Th>
          <Th>
            <span className="sr-only">{t('common.actions')}</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {profile.orders.map((o) => {
          const payment = o.payments.find((p) => p.verifiedAt) ?? o.payments[0];
          return (
            <tr key={o.id}>
              <Td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</Td>
              <Td>
                <p className="font-medium text-stone-900">{o.plan.name}</p>
                <p className="text-xs text-stone-500">{o.eventTitle ?? (o.eventId ? t('common.none') : t('profile.accountWide'))}</p>
                {o.kind === 'ADMIN_GRANT' ? (
                  <p className="mt-1 text-xs text-stone-500">
                    {o.grantedBy ? `${t('profile.grantedBy', { name: o.grantedBy })} · ` : ''}
                    <span className="whitespace-pre-line">{o.note}</span>
                  </p>
                ) : null}
              </Td>
              <Td className="text-right tabular-nums">{formatInr(o.amountMinor)}</Td>
              <Td>
                <PaymentStateBadge state={o.state} />
                {o.coupon ? <p className="mt-1 text-xs text-stone-500">{t('orders.couponUsed', { code: o.coupon })}</p> : null}
              </Td>
              <Td className="font-mono text-xs break-all">{payment ? `${payment.provider} ${payment.providerPaymentId}` : (o.providerOrderId ?? t('common.none'))}</Td>
              <Td className="text-right">
                <OrderActionButtons order={o} customer={customer} actions={actions} />
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function featureValue(e: Entitlement): string {
  if (SWITCH_FEATURES.has(e.featureKey)) return e.enabled ? t('common.yes') : t('common.no');
  if (!e.enabled) return t('profile.featureOff');
  return e.limit === null ? t('common.unlimited') : formatNumber(e.limit);
}

function PlanTab({ profile }: { profile: UserProfile }) {
  const canGrant = useCan('plan.grant');
  // One group per purchase or upgrade: same event, source and end date.
  const groups = new Map<string, Entitlement[]>();
  for (const e of profile.entitlements.filter((x) => x.active)) {
    const key = `${e.eventId ?? 'account'}|${e.sourceType}|${e.validUntil ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{t('profile.access')}</CardTitle>
        {groups.size ? (
          <div className="space-y-4">
            {[...groups.entries()].map(([key, rows]) => {
              const first = rows[0]!;
              return (
                <div key={key}>
                  <p className="text-sm font-medium text-stone-900">
                    {first.eventId ? (first.eventTitle ?? t('common.none')) : t('profile.wholeAccount')}{' '}
                    <span className="font-normal text-stone-500">· {first.validUntil ? t('profile.until', { date: formatDate(first.validUntil) }) : t('profile.noEnd')}</span>
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {rows.map((e) => (
                      <li key={e.featureKey}>
                        <Badge>
                          {tMaybe(`feature.${e.featureKey}`, e.featureKey)}: {featureValue(e)}
                          {e.used ? ` (${t('profile.used', { count: formatNumber(e.used) })})` : ''}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-stone-500">{t('profile.noAccess')}</p>
        )}
      </Card>
      {canGrant && profile.user.status !== 'DELETED' ? <UpgradeForm profile={profile} /> : null}
    </div>
  );
}

function UpgradeForm({ profile }: { profile: UserProfile }) {
  const invalidate = useInvalidate();
  const plans = useQuery({ queryKey: ['meta', 'plans'], queryFn: () => apiGet<PublicPlan[]>('/meta/plans') });
  const paid = (plans.data ?? []).filter((p) => p.key !== 'FREE');
  const events = profile.events.filter((e) => e.status !== 'DELETED');
  const [planKey, setPlanKey] = useState('');
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const plan = paid.find((p) => p.key === planKey);
  const perEvent = plan?.interval === 'ONE_TIME';
  const grant = useMutation({
    mutationFn: () => apiPost<{ plan: string }>(`/admin/users/${profile.user.id}/grants`, { planKey, note: note.trim(), ...(perEvent ? { eventId } : {}) }),
    onSuccess: async (r) => {
      setNotice(t('profile.upgraded', { plan: r.plan }));
      setNote('');
      await invalidate(['admin', 'user', profile.user.id], ['admin', 'orders']);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    grant.mutate();
  };
  const blocked = perEvent && !events.length;
  return (
    <Card>
      <CardTitle className="mb-1 flex items-center gap-2">
        <Gift className="size-4 text-gold-600" aria-hidden /> {t('profile.upgrade')}
      </CardTitle>
      <p className="mb-4 max-w-2xl text-sm text-stone-500">{t('profile.upgradeBody')}</p>
      {plans.isError ? <ErrorNotice error={plans.error} /> : null}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('profile.upgradePlan')}>
            {(p) => (
              <Select {...p} required value={planKey} onChange={(e) => setPlanKey(e.target.value)}>
                <option value="" disabled>
                  {t('profile.choosePlan')}
                </option>
                {paid.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.interval === 'ONE_TIME' ? `${p.name} · ${formatInr(p.priceMinor)}` : `${p.name} · ${t('profile.accountWide')}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {perEvent ? (
            events.length ? (
              <Field label={t('profile.upgradeEvent')}>
                {(p) => (
                  <Select {...p} required value={eventId} onChange={(e) => setEventId(e.target.value)}>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {`${e.title} · ${e.plan}`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Alert tone="warning">{t('profile.needsEvent')}</Alert>
            )
          ) : null}
        </div>
        <Field label={t('profile.upgradeNote')}>
          {(p) => <Textarea {...p} required minLength={3} maxLength={300} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {grant.isError ? <Alert>{errorMessage(grant.error, t('common.error'))}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <Button type="submit" disabled={!planKey || note.trim().length < 3 || blocked || grant.isPending}>
          {grant.isPending ? t('common.saving') : t('profile.upgradeSubmit')}
        </Button>
      </form>
    </Card>
  );
}

/** "Chrome on Windows" from a user-agent string; the full string stays in the tooltip. */
function describeAgent(ua: string | null): string {
  if (!ua) return t('common.none');
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  if (!browser && !os) return ua.slice(0, 60);
  return t('profile.agent', { browser: browser ?? '?', os: os ?? '?' });
}

function SessionsTab({ profile }: { profile: UserProfile }) {
  if (!profile.sessions.length) return <EmptyState>{t('profile.noSessions')}</EmptyState>;
  return (
    <>
      <h2 className="mb-3 text-base font-semibold text-stone-900">{t('profile.sessions')}</h2>
      <Table>
        <thead>
          <tr>
            <Th>{t('profile.device')}</Th>
            <Th>{t('audit.ip')}</Th>
            <Th>{t('profile.signedIn')}</Th>
            <Th>{t('profile.lastUsed')}</Th>
            <Th>{t('staff.twoStep')}</Th>
          </tr>
        </thead>
        <tbody>
          {profile.sessions.map((s) => (
            <tr key={s.id}>
              <Td title={s.userAgent ?? undefined}>{describeAgent(s.userAgent)}</Td>
              <Td className="font-mono text-xs">{s.ipAddress ?? t('common.none')}</Td>
              <Td className="whitespace-nowrap">{formatDateTime(s.createdAt)}</Td>
              <Td className="whitespace-nowrap">{formatDateTime(s.lastUsedAt)}</Td>
              <Td>{s.mfa ? <Badge tone="success">{t('mfa.on')}</Badge> : <Badge>{t('mfa.off')}</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

function ActivityTab({ profile }: { profile: UserProfile }) {
  if (!profile.activity.length) return <EmptyState>{t('common.empty')}</EmptyState>;
  return (
    <>
      <h2 className="mb-3 text-base font-semibold text-stone-900">{t('profile.activity')}</h2>
      <Table>
        <thead>
          <tr>
            <Th>{t('audit.time')}</Th>
            <Th>{t('profile.action')}</Th>
            <Th>{t('audit.actor')}</Th>
            <Th>{t('audit.target')}</Th>
            <Th>{t('audit.result')}</Th>
            <Th>{t('audit.ip')}</Th>
          </tr>
        </thead>
        <tbody>
          {profile.activity.map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</Td>
              <Td className="font-mono text-xs">{a.action}</Td>
              <Td className="text-xs">{a.byThisUser ? t('profile.byThem') : t('profile.aboutThem')}</Td>
              <Td className="text-xs">{a.targetType}</Td>
              <Td>
                <Badge tone={statusTone(a.result)}>{a.result}</Badge>
              </Td>
              <Td className="font-mono text-xs">{a.ipAddress ?? t('common.none')}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
