'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SettingValues } from '@bulava/validation';
import { SettingsCard, useGroupEditor, useSettingsOverview } from '@/components/settings';
import { RequirePermission, useCan } from '@/components/shell';
import { Alert, Badge, Button, Card, CardTitle, Checkbox, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Tabs, Td, Th, type BadgeTone } from '@/components/ui';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { t, tMaybe } from '@/lib/i18n';
import type { CardLeadDetail, CardLeadsResponse, CardOrderDetail, CardOrdersResponse, CardStats, SettingGroupView } from '@/lib/types';
import { formatDateTime, formatInr, formatNumber } from '@/lib/utils';

type Tab = 'overview' | 'leads' | 'orders';
const RANGES = [7, 30, 90, 365] as const;

const ORDER_TONE: Record<string, BadgeTone> = { PAID: 'success', PENDING: 'warning', FAILED: 'danger', EXPIRED: 'neutral', REFUNDED: 'gold' };
const EMAIL_TONE: Record<string, BadgeTone> = { SENT: 'success', QUEUED: 'warning', FAILED: 'danger', NONE: 'neutral' };

export default function CardsPage() {
  return (
    <RequirePermission permission="cards.view">
      <Cards />
    </RequirePermission>
  );
}

function Cards() {
  const [tab, setTab] = useState<Tab>('overview');
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  return (
    <>
      <PageHeader
        title={t('cards.title')}
        subtitle={t('cards.subtitle')}
        actions={
          tab === 'overview' ? (
            <Select aria-label={t('cards.range')} value={days} onChange={(e) => setDays(Number(e.target.value) as (typeof RANGES)[number])} className="w-auto">
              {RANGES.map((d) => (
                <option key={d} value={d}>
                  {t('cards.range.days', { days: d })}
                </option>
              ))}
            </Select>
          ) : null
        }
      />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: t('cards.tab.overview') },
          { key: 'leads', label: t('cards.tab.leads') },
          { key: 'orders', label: t('cards.tab.orders') },
        ]}
      />
      {tab === 'overview' ? <Overview days={days} /> : tab === 'leads' ? <Leads /> : <Orders />}
    </>
  );
}

// ─────────────────────────── Overview ───────────────────────────

function Overview({ days }: { days: number }) {
  const stats = useQuery({ queryKey: ['admin', 'cards', 'stats', days], queryFn: () => apiGet<CardStats>(`/admin/cards/stats?days=${days}`), placeholderData: (p) => p });
  const canSettings = useCan('settings.manage');
  if (stats.isPending) return <Spinner />;
  if (stats.isError) return <ErrorNotice error={stats.error} />;
  const s = stats.data;
  const funnel: Array<[string, number]> = [
    [t('cards.funnel.selected'), s.funnel.templatesSelected],
    [t('cards.funnel.opened'), s.funnel.editorsOpened],
    [t('cards.funnel.created'), s.funnel.cardsCreated],
    [t('cards.funnel.dialog'), s.funnel.downloadDialogs],
    [t('cards.funnel.free'), s.funnel.freeDownloads],
    [t('cards.funnel.checkout'), s.funnel.paymentsStarted],
    [t('cards.funnel.paid'), s.funnel.purchases],
  ];
  const top = Math.max(1, ...funnel.map(([, n]) => n));
  return (
    <div className="space-y-6">
      {!s.settings.enabled ? <Alert tone="warning">{t('cards.off')}</Alert> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('cards.stat.created')} value={formatNumber(s.funnel.cardsCreated)} hint={t('cards.stat.createdHint')} />
        <StatCard label={t('cards.stat.free')} value={formatNumber(s.funnel.freeDownloads)} hint={t('cards.stat.freeHint', { images: formatNumber(s.totals.freeImages) })} />
        <StatCard label={t('cards.stat.purchases')} value={formatNumber(s.funnel.purchases)} hint={t('cards.stat.revenue', { amount: formatInr(s.totals.revenueMinor) })} />
        <StatCard label={t('cards.stat.freeToPaid')} value={`${s.conversion.freeToPaid}%`} hint={t('cards.stat.freeToPaidHint')} />
        <StatCard label={t('cards.stat.leads')} value={formatNumber(s.totals.newLeads)} hint={t('cards.stat.leadsHint', { total: formatNumber(s.totals.totalLeads), consented: formatNumber(s.totals.consentedLeads) })} />
        <StatCard label={t('cards.stat.plan')} value={formatNumber(s.totals.planDownloads)} hint={t('cards.stat.planHint')} />
        <StatCard label={t('cards.stat.pending')} value={formatNumber(s.totals.pendingOrders)} hint={t('cards.stat.pendingHint')} />
        <StatCard
          label={t('cards.stat.failures')}
          value={formatNumber(s.failures.payments + s.failures.exports + s.failures.emails)}
          hint={t('cards.stat.failuresHint', { payments: s.failures.payments, images: s.failures.exports, emails: s.failures.emails })}
          tone={s.failures.emails || s.failures.exports ? 'danger' : undefined}
        />
      </div>

      <Card>
        <CardTitle>{t('cards.funnel.title')}</CardTitle>
        <p className="mt-1 text-sm text-stone-500">{t('cards.funnel.hint')}</p>
        <ol className="mt-4 space-y-2">
          {funnel.map(([label, n]) => (
            <li key={label} className="grid grid-cols-[minmax(9rem,14rem)_1fr_4rem] items-center gap-3 text-sm">
              <span className="text-stone-700">{label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-stone-100">
                <span className="block h-full rounded-full bg-brand-700" style={{ width: `${Math.max(1, (n / top) * 100)}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{formatNumber(n)}</span>
            </li>
          ))}
        </ol>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
          {(
            [
              ['cards.conv.createdToFree', s.conversion.createdToFree],
              ['cards.conv.createdToPaid', s.conversion.createdToPaid],
              ['cards.conv.freeToPaid', s.conversion.freeToPaid],
              ['cards.conv.checkoutToPaid', s.conversion.checkoutToPaid],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-stone-50 p-3">
              <dt className="text-xs text-stone-500">{t(key)}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{value}%</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardTitle>{t('cards.activity.title')}</CardTitle>
        <ActivityChart daily={s.daily} />
      </Card>

      <Card>
        <CardTitle>{t('cards.popular.title')}</CardTitle>
        {s.templates.length ? (
          <Table className="mt-3">
            <thead>
              <tr>
                <Th>{t('cards.popular.template')}</Th>
                <Th>{t('cards.popular.category')}</Th>
                <Th className="text-right">{t('cards.popular.created')}</Th>
                <Th className="text-right">{t('cards.popular.free')}</Th>
                <Th className="text-right">{t('cards.popular.paid')}</Th>
              </tr>
            </thead>
            <tbody>
              {s.templates.map((row) => (
                <tr key={row.templateKey}>
                  <Td>
                    <p className="font-medium">{row.name}</p>
                    <p className="font-mono text-xs text-stone-500">{row.templateKey}</p>
                  </Td>
                  <Td>{row.category ?? t('common.none')}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(row.created)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(row.free)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(row.paid)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('common.empty')}</EmptyState>
        )}
      </Card>

      {canSettings ? (
        <CardsSettings />
      ) : (
        <Card>
          <CardTitle>{t('cards.settings.title')}</CardTitle>
          <p className="mt-2 text-sm text-stone-600">{t('cards.settings.readOnly', { price: formatInr(s.settings.priceMinor) })}</p>
        </Card>
      )}
    </div>
  );
}

/** Created, free downloads and purchases per day, as grouped bars (no chart library). */
function ActivityChart({ daily }: { daily: CardStats['daily'] }) {
  const max = Math.max(1, ...daily.flatMap((d) => [d.created, d.free, d.paid]));
  // One slot per day across the card's width; a year scrolls sideways.
  const slot = Math.max(18, 900 / Math.max(1, daily.length));
  const width = Math.max(320, daily.length * slot);
  const h = 160;
  const bar = Math.min(10, Math.max(4, (slot - 6) / 3));
  if (!daily.length) return <EmptyState>{t('common.empty')}</EmptyState>;
  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <svg role="img" aria-label={t('cards.activity.title')} viewBox={`0 0 ${width} ${h + 24}`} width="100%" style={{ minWidth: Math.min(width, 900) }} className="block">
          {daily.map((d, i) => {
            const x = i * slot + 3;
            const bars: Array<[number, string]> = [
              [d.created, '#a8a29e'],
              [d.free, '#c9a227'],
              [d.paid, '#6b0f1a'],
            ];
            return (
              <g key={d.day}>
                {bars.map(([n, color], j) => (
                  <rect key={j} x={x + j * (bar + 1)} y={h - (n / max) * h} width={bar} height={(n / max) * h} rx={1} fill={color}>
                    <title>{`${d.day}: ${n}`}</title>
                  </rect>
                ))}
                {i % Math.ceil(daily.length / 8) === 0 ? (
                  <text x={x} y={h + 16} fontSize={10} fill="#78716c">
                    {d.day.slice(5)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 flex flex-wrap gap-4 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#a8a29e]" /> {t('cards.activity.created')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#c9a227]" /> {t('cards.activity.free')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-700" /> {t('cards.activity.paid')}
        </span>
      </p>
    </div>
  );
}

type CardsSettingsValue = SettingValues['cards'];

function CardsSettings() {
  const overview = useSettingsOverview();
  if (overview.isPending) return <Spinner />;
  if (overview.isError) return <ErrorNotice error={overview.error} />;
  return <CardsSettingsForm view={overview.data.groups.cards} />;
}

function CardsSettingsForm({ view }: { view: SettingGroupView }) {
  const editor = useGroupEditor<CardsSettingsValue>('cards', view);
  const { draft, set } = editor;
  const saved = view.value as CardsSettingsValue;
  return (
    <SettingsCard
      title={t('cards.settings.title')}
      description={t('cards.settings.hint')}
      view={view}
      editor={editor}
      status={saved.enabled ? { tone: 'success', label: t('cards.settings.on') } : { tone: 'neutral', label: t('cards.settings.offLabel') }}
    >
      <Checkbox label={t('cards.settings.enabled')} checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} />
      <Field label={t('cards.settings.price')} hint={t('cards.settings.priceHint')} className="max-w-xs">
        {(p) => <Input {...p} type="number" min={50} max={10000} step={1} value={Math.round(draft.priceMinor / 100)} onChange={(e) => set('priceMinor', Math.round(Number(e.target.value || 0) * 100))} />}
      </Field>
      <Field label={t('cards.settings.planDownloads')} hint={t('cards.settings.planDownloadsHint')} className="max-w-md">
        {(p) => (
          <Select {...p} value={draft.planDownloads} onChange={(e) => set('planDownloads', e.target.value as CardsSettingsValue['planDownloads'])}>
            <option value="any">{t('cards.settings.plan.any')}</option>
            <option value="subscription">{t('cards.settings.plan.subscription')}</option>
            <option value="off">{t('cards.settings.plan.off')}</option>
          </Select>
        )}
      </Field>
    </SettingsCard>
  );
}

// ─────────────────────────── Contacts ───────────────────────────

function useDebounced(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function Leads() {
  const [q, setQ] = useState('');
  const [consent, setConsent] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const debounced = useDebounced(q);
  const canExport = useCan('cards.manage');
  const query = new URLSearchParams(Object.entries({ q: debounced, consent, page: String(page) }).filter(([, v]) => v)).toString();
  const leads = useQuery({ queryKey: ['admin', 'cards', 'leads', query], queryFn: () => apiGet<CardLeadsResponse>(`/admin/cards/leads?${query}`), placeholderData: (p) => p });
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="search" placeholder={t('cards.leads.search')} aria-label={t('common.search')} value={q} onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }} className="max-w-xs" />
        <Select aria-label={t('cards.leads.offers')} value={consent} onChange={(e) => {
          setConsent(e.target.value);
          setPage(1);
        }} className="w-auto">
          <option value="">{`${t('cards.leads.offers')}: ${t('common.all')}`}</option>
          <option value="granted">{t('cards.leads.offersYes')}</option>
          <option value="none">{t('cards.leads.offersNo')}</option>
        </Select>
        {canExport ? (
          <a href="/api/v1/admin/cards/leads.csv" className="ml-auto inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50">
            <Download aria-hidden className="size-4" /> {t('cards.leads.export')}
          </a>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-stone-500">{t('cards.leads.privacy')}</p>
      {leads.isPending ? <Spinner /> : null}
      {leads.isError ? <ErrorNotice error={leads.error} /> : null}
      {leads.data && !leads.data.leads.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
      {leads.data?.leads.length ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t('cards.leads.phone')}</Th>
                <Th>{t('cards.leads.name')}</Th>
                <Th>{t('cards.leads.offers')}</Th>
                <Th className="text-right">{t('cards.leads.cards')}</Th>
                <Th className="text-right">{t('cards.leads.free')}</Th>
                <Th className="text-right">{t('cards.leads.paid')}</Th>
                <Th>{t('cards.leads.lastSeen')}</Th>
              </tr>
            </thead>
            <tbody>
              {leads.data.leads.map((l) => (
                <tr key={l.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setOpen(l.id)}>
                  <Td>
                    <button type="button" className="font-mono text-sm text-brand-700 hover:underline" onClick={() => setOpen(l.id)}>
                      {l.phone}
                    </button>
                  </Td>
                  <Td>
                    <p>{l.name ?? t('common.none')}</p>
                    {l.email ? <p className="text-xs break-all text-stone-500">{l.email}</p> : null}
                  </Td>
                  <Td>{l.offers ? <Badge tone="success">{t('common.yes')}</Badge> : <Badge>{t('common.no')}</Badge>}</Td>
                  <Td className="text-right tabular-nums">{l.cards}</Td>
                  <Td className="text-right tabular-nums">{l.freeDownloads}</Td>
                  <Td className="text-right tabular-nums">{l.purchases}</Td>
                  <Td className="whitespace-nowrap">{formatDateTime(l.lastSeenAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={leads.data.pageSize} total={leads.data.total} onPage={setPage} />
        </>
      ) : null}
      <Modal open={open !== null} onClose={() => setOpen(null)} title={t('cards.lead.title')} wide>
        {open ? <LeadDetail id={open} /> : null}
      </Modal>
    </>
  );
}

function LeadDetail({ id }: { id: string }) {
  const queries = useQueryClient();
  const canManage = useCan('cards.manage');
  const lead = useQuery({ queryKey: ['admin', 'cards', 'lead', id], queryFn: () => apiGet<CardLeadDetail>(`/admin/cards/leads/${id}`) });
  const withdraw = useMutation({
    mutationFn: () => apiPost(`/admin/cards/leads/${id}/withdraw-offers`),
    onSuccess: () => queries.invalidateQueries({ queryKey: ['admin', 'cards'] }),
  });
  if (lead.isPending) return <Spinner />;
  if (lead.isError) return <ErrorNotice error={lead.error} />;
  const l = lead.data;
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <dt className="text-stone-500">{t('cards.leads.phone')}</dt>
        <dd className="font-mono">{l.phoneE164}</dd>
        <dt className="text-stone-500">{t('cards.lead.countryCode')}</dt>
        <dd>{l.countryCode || t('common.none')}</dd>
        <dt className="text-stone-500">{t('cards.leads.name')}</dt>
        <dd>{l.name ?? t('common.none')}</dd>
        <dt className="text-stone-500">{t('cards.lead.email')}</dt>
        <dd className="break-all">{l.email ?? t('common.none')}</dd>
        <dt className="text-stone-500">{t('cards.leads.offers')}</dt>
        <dd>{l.offers ? t('cards.lead.offersSince', { date: formatDateTime(l.marketingConsentAt) }) : l.marketingWithdrawnAt ? t('cards.lead.offersWithdrawn', { date: formatDateTime(l.marketingWithdrawnAt) }) : t('common.no')}</dd>
        <dt className="text-stone-500">{t('cards.lead.firstSeen')}</dt>
        <dd>{formatDateTime(l.firstSeenAt)}</dd>
      </dl>
      {l.offers && canManage ? (
        <Button variant="secondary" size="sm" disabled={withdraw.isPending} onClick={() => {
            if (window.confirm(t('cards.lead.withdrawConfirm'))) withdraw.mutate();
          }}>
          {t('cards.lead.withdraw')}
        </Button>
      ) : null}
      {withdraw.isError ? <Alert>{errorMessage(withdraw.error, t('common.error'))}</Alert> : null}
      <section>
        <h3 className="font-semibold">{t('cards.lead.orders')}</h3>
        {l.orders.length ? (
          <ul className="mt-2 space-y-1">
            {l.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{o.reference}</span>
                <Badge tone={ORDER_TONE[o.status] ?? 'neutral'}>{tMaybe(`cards.status.${o.status}`, o.status)}</Badge>
                <span>{formatInr(o.amountMinor)}</span>
                <span className="text-stone-500">{formatDateTime(o.paidAt ?? o.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-stone-500">{t('common.none')}</p>
        )}
      </section>
      <section>
        <h3 className="font-semibold">{t('cards.lead.cards')}</h3>
        <ul className="mt-2 space-y-1">
          {l.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap gap-2">
              <span className="font-mono text-xs">{s.templateKey}</span>
              <span className="text-stone-500">{tMaybe(`cards.format.${s.format}`, s.format)}</span>
              <span className="text-stone-500">{formatDateTime(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold">{t('cards.lead.consents')}</h3>
        <ul className="mt-2 space-y-1">
          {l.consents.map((c) => (
            <li key={c.id} className="text-xs text-stone-600">
              {formatDateTime(c.createdAt)} · {c.kind} · {c.granted ? t('common.yes') : t('common.no')} · {c.version}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold">{t('cards.lead.events')}</h3>
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {l.events.map((e, i) => (
            <li key={i} className="text-xs text-stone-600">
              {formatDateTime(e.createdAt)} · {tMaybe(`cards.event.${e.type}`, e.type)}
              {e.templateKey ? ` · ${e.templateKey}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─────────────────────────── Orders ───────────────────────────

function Orders() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [emailFailed, setEmailFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const debounced = useDebounced(q);
  const query = new URLSearchParams(Object.entries({ q: debounced, status, emailFailed: emailFailed ? 'true' : '', page: String(page) }).filter(([, v]) => v)).toString();
  const orders = useQuery({ queryKey: ['admin', 'cards', 'orders', query], queryFn: () => apiGet<CardOrdersResponse>(`/admin/cards/orders?${query}`), placeholderData: (p) => p });
  const totals = orders.data?.totals;
  return (
    <>
      {totals ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('cards.orders.revenue')} value={formatInr(totals.PAID?.amountMinor ?? 0)} hint={t('cards.orders.paidCount', { count: formatNumber(totals.PAID?.count ?? 0) })} />
          <StatCard label={t('cards.orders.pending')} value={formatNumber(totals.PENDING?.count ?? 0)} />
          <StatCard label={t('cards.orders.expired')} value={formatNumber(totals.EXPIRED?.count ?? 0)} />
          <StatCard label={t('cards.orders.refunded')} value={formatInr(totals.REFUNDED?.amountMinor ?? 0)} hint={t('cards.orders.paidCount', { count: formatNumber(totals.REFUNDED?.count ?? 0) })} />
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="search" placeholder={t('cards.orders.search')} aria-label={t('common.search')} value={q} onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }} className="max-w-xs" />
        <Select aria-label={t('common.status')} value={status} onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }} className="w-auto">
          <option value="">{`${t('common.status')}: ${t('common.all')}`}</option>
          {['PAID', 'PENDING', 'EXPIRED', 'FAILED', 'REFUNDED'].map((s) => (
            <option key={s} value={s}>
              {tMaybe(`cards.status.${s}`, s)}
            </option>
          ))}
        </Select>
        <Checkbox label={t('cards.orders.emailFailed')} checked={emailFailed} onChange={(e) => {
          setEmailFailed(e.target.checked);
          setPage(1);
        }} />
      </div>
      {orders.isPending ? <Spinner /> : null}
      {orders.isError ? <ErrorNotice error={orders.error} /> : null}
      {orders.data && !orders.data.orders.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
      {orders.data?.orders.length ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t('common.created')}</Th>
                <Th>{t('cards.orders.reference')}</Th>
                <Th>{t('cards.orders.customer')}</Th>
                <Th>{t('cards.orders.card')}</Th>
                <Th className="text-right">{t('cards.orders.amount')}</Th>
                <Th>{t('common.status')}</Th>
                <Th>{t('cards.orders.email')}</Th>
              </tr>
            </thead>
            <tbody>
              {orders.data.orders.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setOpen(o.id)}>
                  <Td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</Td>
                  <Td>
                    <button type="button" className="font-mono text-sm text-brand-700 hover:underline" onClick={() => setOpen(o.id)}>
                      {o.reference}
                    </button>
                  </Td>
                  <Td>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs break-all text-stone-500">
                      {o.email} · {o.phoneE164}
                    </p>
                  </Td>
                  <Td>
                    <p className="font-mono text-xs">{o.templateKey}</p>
                    <p className="text-xs text-stone-500">{tMaybe(`cards.format.${o.format}`, o.format)}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{formatInr(o.amountMinor)}</Td>
                  <Td>
                    <Badge tone={ORDER_TONE[o.status] ?? 'neutral'}>{tMaybe(`cards.status.${o.status}`, o.status)}</Badge>
                    {o.status === 'PENDING' && o.failureReason ? <p className="mt-1 max-w-48 text-xs text-stone-500">{o.failureReason}</p> : null}
                  </Td>
                  <Td>{o.status === 'PAID' ? <Badge tone={EMAIL_TONE[o.emailStatus] ?? 'neutral'}>{tMaybe(`cards.email.${o.emailStatus}`, o.emailStatus)}</Badge> : null}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={orders.data.pageSize} total={orders.data.total} onPage={setPage} />
        </>
      ) : null}
      <Modal open={open !== null} onClose={() => setOpen(null)} title={t('cards.order.title')} wide>
        {open ? <OrderDetail id={open} /> : null}
      </Modal>
    </>
  );
}

function OrderDetail({ id }: { id: string }) {
  const queries = useQueryClient();
  const canManage = useCan('cards.manage');
  const canRefund = useCan('payment.refund');
  const [notice, setNotice] = useState<string | null>(null);
  const order = useQuery({ queryKey: ['admin', 'cards', 'order', id], queryFn: () => apiGet<CardOrderDetail>(`/admin/cards/orders/${id}`) });
  const action = useMutation({
    mutationFn: (kind: 'resend-email' | 'regenerate' | 'refund') => apiPost(`/admin/cards/orders/${id}/${kind}`),
    onSuccess: async (_, kind) => {
      setNotice(t(`cards.order.done.${kind}`));
      await queries.invalidateQueries({ queryKey: ['admin', 'cards'] });
    },
  });
  if (order.isPending) return <Spinner />;
  if (order.isError) return <ErrorNotice error={order.error} />;
  const o = order.data;
  const latest = o.exports[0];
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <dt className="text-stone-500">{t('cards.orders.reference')}</dt>
        <dd className="font-mono">{o.reference}</dd>
        <dt className="text-stone-500">{t('common.status')}</dt>
        <dd>
          <Badge tone={ORDER_TONE[o.status] ?? 'neutral'}>{tMaybe(`cards.status.${o.status}`, o.status)}</Badge>
        </dd>
        <dt className="text-stone-500">{t('cards.orders.amount')}</dt>
        <dd>{formatInr(o.amountMinor)}</dd>
        <dt className="text-stone-500">{t('cards.orders.customer')}</dt>
        <dd>
          {o.name}
          <br />
          <span className="break-all text-stone-600">{o.email}</span>
          <br />
          <span className="font-mono text-stone-600">{o.phoneE164}</span>
        </dd>
        <dt className="text-stone-500">{t('cards.orders.card')}</dt>
        <dd>
          <span className="font-mono text-xs">{o.templateKey}</span> · {tMaybe(`cards.format.${o.format}`, o.format)}
        </dd>
        <dt className="text-stone-500">{t('cards.order.payment')}</dt>
        <dd className="font-mono text-xs break-all">{o.providerPaymentId ?? o.providerOrderId ?? t('common.none')}</dd>
        <dt className="text-stone-500">{t('cards.order.terms')}</dt>
        <dd>{formatDateTime(o.termsAcceptedAt)}</dd>
        <dt className="text-stone-500">{t('cards.orders.email')}</dt>
        <dd>
          <Badge tone={EMAIL_TONE[o.emailStatus] ?? 'neutral'}>{tMaybe(`cards.email.${o.emailStatus}`, o.emailStatus)}</Badge>
          {o.emailError ? <p className="mt-1 text-xs text-red-700">{o.emailError}</p> : null}
          {o.emailedAt ? <p className="mt-1 text-xs text-stone-500">{formatDateTime(o.emailedAt)}</p> : null}
        </dd>
        <dt className="text-stone-500">{t('cards.order.image')}</dt>
        <dd>
          {latest ? (
            <>
              {tMaybe(`cards.export.${latest.status}`, latest.status)} · {t('cards.order.downloads', { count: latest.downloads })}
              {latest.error ? <p className="mt-1 text-xs text-red-700">{latest.error}</p> : null}
            </>
          ) : (
            t('common.none')
          )}
        </dd>
      </dl>

      {o.status === 'PAID' ? (
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <>
              <Button size="sm" variant="secondary" disabled={action.isPending || latest?.status !== 'READY'} onClick={() => action.mutate('resend-email')}>
                {t('cards.order.resend')}
              </Button>
              <Button size="sm" variant="secondary" disabled={action.isPending} onClick={() => action.mutate('regenerate')}>
                {t('cards.order.regenerate')}
              </Button>
            </>
          ) : null}
          {canRefund ? (
            <Button size="sm" variant="danger" disabled={action.isPending} onClick={() => {
                if (window.confirm(t('cards.order.refundConfirm', { amount: formatInr(o.amountMinor) }))) action.mutate('refund');
              }}>
              {t('cards.order.refund')}
            </Button>
          ) : null}
          {o.orderUrl ? (
            <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(o.orderUrl!).then(() => setNotice(t('cards.order.linkCopied')))}>
              {t('cards.order.copyLink')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {action.isError ? <Alert>{errorMessage(action.error, t('common.error'))}</Alert> : null}

      <section>
        <h3 className="font-semibold">{t('cards.lead.events')}</h3>
        <ol className="mt-2 space-y-1">
          {o.events.map((e, i) => (
            <li key={i} className="text-xs text-stone-600">
              {formatDateTime(e.createdAt)} · {tMaybe(`cards.event.${e.type}`, e.type)}
              {e.meta && typeof e.meta === 'object' && 'reason' in e.meta ? ` · ${String((e.meta as { reason: unknown }).reason)}` : ''}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
      <span>{t('cards.pager', { page, pages, total: formatNumber(total) })}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('cards.pager.previous')}
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t('cards.pager.next')}
        </Button>
      </div>
    </div>
  );
}
