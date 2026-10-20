'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2, UserPlus, Wand2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Card, CardTitle, Checkbox, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, Table, Tabs, Td, Textarea, Th, type BadgeTone } from '@/components/ui';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, errorMessage } from '@/lib/api';
import { t, tMaybe } from '@/lib/i18n';
import type { PreviewDetail, PreviewKind, PreviewProvider, PreviewRow, PreviewStatus } from '@/lib/types';
import { cn, formatDate, formatDateTime, formatInr } from '@/lib/utils';

const STATUSES: PreviewStatus[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'SENT', 'CHANGES_REQUESTED', 'OWNED', 'CLOSED', 'CANCELLED'];
const KINDS: PreviewKind[] = ['WEBSITE', 'CARD', 'FILM'];
const STATUS_TONE: Record<PreviewStatus, BadgeTone> = {
  NEW: 'brand',
  ASSIGNED: 'warning',
  IN_PROGRESS: 'warning',
  SENT: 'success',
  CHANGES_REQUESTED: 'danger',
  OWNED: 'gold',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

interface EventTypeLite {
  key: string;
  name: string;
  detailsSchemaKey: string | null;
}

export default function PreviewsPage() {
  return (
    <RequirePermission permission="preview.manage">
      <Previews />
    </RequirePermission>
  );
}

/**
 * The preview desk from the console (ADR-076): every request, customers from
 * outside entered by staff, giving a request to a preview provider, the offer
 * and its coupon, and who the preview providers are. Providers do the work on
 * the preview desk in the dashboard.
 */
function Previews() {
  const [tab, setTab] = useState<'requests' | 'providers'>('requests');
  return (
    <>
      <PageHeader title={t('previews.title')} subtitle={t('previews.subtitle')} />
      <Tabs
        className="mb-5"
        tabs={[
          { key: 'requests', label: t('previews.tab.requests') },
          { key: 'providers', label: t('previews.tab.providers') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'requests' ? <Requests /> : <Providers />}
    </>
  );
}

function Requests() {
  const [status, setStatus] = useState<PreviewStatus | ''>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams({ scope: 'all', page: String(page), ...(status ? { status } : {}), ...(q ? { q } : {}) });
  const list = useQuery({ queryKey: ['admin', 'previews', 'list', params.toString()], queryFn: () => apiGet<{ total: number; page: number; pageSize: number; requests: PreviewRow[] }>(`/admin/previews/requests?${params.toString()}`), refetchInterval: 60_000 });
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select aria-label={t('common.status')} className="w-48" value={status} onChange={(e) => (setStatus(e.target.value as PreviewStatus | ''), setPage(1))}>
          <option value="">{t('previews.status.any')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`previews.status.${s}`)}
            </option>
          ))}
        </Select>
        <Input type="search" aria-label={t('previews.search')} placeholder={t('previews.search')} className="w-full sm:w-72" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden /> {t('previews.new')}
        </Button>
      </div>
      {created ? (
        <Alert tone="success" className="mb-4">
          {t('previews.created', { reference: created })}
        </Alert>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className={cn(selected && 'hidden lg:block')}>
          {list.isPending ? <Spinner /> : null}
          {list.isError ? <ErrorNotice error={list.error} /> : null}
          {list.data && !list.data.requests.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
          <ul className="space-y-2">
            {list.data?.requests.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  aria-current={selected === r.id ? 'true' : undefined}
                  className={cn('w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-brand-200', selected === r.id ? 'border-brand-600 ring-2 ring-brand-100' : 'border-stone-200')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-stone-900">{r.title}</span>
                    <span className="shrink-0 font-mono text-xs text-stone-500">{r.reference}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={STATUS_TONE[r.status]}>{t(`previews.status.${r.status}`)}</Badge>
                    {r.source === 'STAFF' ? <Badge>{t('previews.source.STAFF')}</Badge> : null}
                    <span className="text-xs text-stone-500">{r.wants.map((k) => t(`previews.kind.${k}`)).join(' · ')}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-stone-500">
                    {r.name} · {r.assignee?.name ?? t('previews.unassigned')} · {formatDateTime(r.updatedAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {list.data && pages > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-sm text-stone-600">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('cards.pager.previous')}
              </Button>
              <span>{t('previews.pager', { page, pages, total: list.data.total })}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                {t('cards.pager.next')}
              </Button>
            </div>
          ) : null}
        </div>
        <div className={cn(!selected && 'hidden lg:block')}>
          {selected ? (
            <RequestDetail key={selected} id={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
              <div>
                <Wand2 className="mx-auto mb-2 size-6 text-stone-400" aria-hidden />
                {t('previews.pick')}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title={t('previews.newTitle')} wide>
        <NewRequest
          onCreated={(detail) => {
            setCreating(false);
            setCreated(detail.reference);
            setSelected(detail.id);
          }}
        />
      </Modal>
    </>
  );
}

function RequestDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const invalidate = useInvalidate();
  const detail = useQuery({ queryKey: ['admin', 'previews', 'detail', id], queryFn: () => apiGet<PreviewDetail>(`/admin/previews/requests/${id}`) });
  const providers = useQuery({ queryKey: ['admin', 'previews', 'providers'], queryFn: () => apiGet<PreviewProvider[]>('/admin/previews/providers') });
  const [assignee, setAssignee] = useState<string | null>(null);
  const [offer, setOffer] = useState<string | null | undefined>(undefined);
  const [coupon, setCoupon] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = () => invalidate(['admin', 'previews']);
  const run = useMutation({
    mutationFn: (action: { path: string; method: 'POST' | 'PUT' | 'PATCH'; body: unknown; done?: string }) =>
      (action.method === 'POST' ? apiPost : action.method === 'PUT' ? apiPut : apiPatch)<PreviewDetail>(action.path, action.body).then(() => action.done ?? null),
    onSuccess: async (message) => {
      setDone(message);
      setAssignee(null);
      setOffer(undefined);
      setCoupon(undefined);
      setNote('');
      await refresh();
    },
  });

  if (detail.isPending) return <Spinner />;
  if (detail.isError) return <ErrorNotice error={detail.error} />;
  const d = detail.data;
  const ended = d.status === 'OWNED' || d.status === 'CLOSED' || d.status === 'CANCELLED';
  const currentAssignee = assignee ?? d.assignee?.id ?? '';
  const currentOffer = offer === undefined ? (d.offer.planKey ?? '') : (offer ?? '');
  const currentCoupon = coupon ?? d.offer.couponCode ?? '';
  const webOrigin = d.link ? new URL(d.link.url).origin : null;
  const details = d.celebration.details ?? {};

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700 lg:hidden">
        <ArrowLeft className="size-4" aria-hidden /> {t('previews.back')}
      </button>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-stone-900">{d.celebration.title}</h2>
            <p className="mt-0.5 text-sm text-stone-600">
              {d.celebration.eventTypeName}
              {d.celebration.date ? ` · ${formatDate(`${d.celebration.date}T12:00:00+05:30`)}` : ''}
              {d.celebration.city ? ` · ${d.celebration.city}` : ''}
            </p>
          </div>
          <div className="text-right text-xs text-stone-500">
            <p className="font-mono text-sm font-semibold text-stone-700">{d.reference}</p>
            <p>{formatDateTime(d.createdAt)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone={STATUS_TONE[d.status]}>{t(`previews.status.${d.status}`)}</Badge>
          <Badge>{t(`previews.source.${d.source}`)}</Badge>
          <Badge tone="gold">{d.assignee?.name ?? t('previews.unassigned')}</Badge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-stone-500 uppercase">{t('previews.detail.customer')}</dt>
            <dd className="mt-0.5 text-stone-900">
              {d.customer.name}
              <span className="block font-mono text-xs text-stone-600">{d.customer.phone}</span>
              {d.customer.email ? <span className="block text-xs text-stone-600">{d.customer.email}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-stone-500 uppercase">{t('previews.detail.wants')}</dt>
            <dd className="mt-0.5 text-stone-900">{d.wants.map((k) => t(`previews.kind.${k}`)).join(', ')}</dd>
          </div>
          {d.celebration.detailsSchemaKey === 'couple' ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-stone-500 uppercase">{t('previews.detail.celebration')}</dt>
              <dd className="mt-0.5 text-stone-900">
                {details.partnerOne ?? '—'} &amp; {details.partnerTwo ?? '—'}
              </dd>
            </div>
          ) : null}
          {d.celebration.functions.length ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-stone-500 uppercase">{t('previews.detail.functions')}</dt>
              <dd className="mt-1 space-y-1">
                {d.celebration.functions.map((fn, i) => (
                  <p key={`${fn.name}-${i}`} className="text-stone-800">
                    <span className="font-medium">{fn.name}</span> <span className="text-xs text-stone-500">{[fn.date, fn.time, fn.venue].filter(Boolean).join(' · ')}</span>
                  </p>
                ))}
              </dd>
            </div>
          ) : null}
          {d.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-stone-500 uppercase">{t('previews.detail.notes')}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-stone-800">{d.notes}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <CardTitle>{t('previews.detail.items')}</CardTitle>
        {d.items.length ? (
          <ul className="mt-3 divide-y divide-stone-100">
            {d.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-stone-900">{t(`previews.kind.${item.kind}`)}</span> · {item.templateName}
                  <Badge className="ml-2" tone={item.status === 'SHARED' ? 'success' : item.status === 'DRAFT' ? 'warning' : 'neutral'}>
                    {t(`previews.item.${item.status}`)}
                  </Badge>
                </span>
                {item.view && webOrigin ? (
                  <a href={`${webOrigin}${item.view}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    {t('previews.detail.view')} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-stone-500">{t('previews.detail.noItems')}</p>
        )}
        {d.link ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-3 text-sm">
            <span className="font-medium text-stone-700">{t('previews.detail.link')}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-stone-600">{d.link.url}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void navigator.clipboard.writeText(d.link!.url).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              <Copy className="size-3.5" aria-hidden /> {copied ? t('previews.detail.copied') : t('previews.detail.copy')}
            </Button>
            {webOrigin ? (
              <a href={`${webOrigin}/dashboard/desk/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                {t('previews.detail.openDesk')} <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
            <span className="w-full text-xs text-stone-500">{d.views ? t('previews.detail.views', { count: d.views }) : t('previews.detail.notViewed')}</span>
          </div>
        ) : null}
      </Card>

      {!ended ? (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('previews.detail.assign')}>
              {(p) => (
                <div className="flex gap-2">
                  <Select {...p} value={currentAssignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">{t('previews.field.assigneeNone')}</option>
                    {(providers.data ?? []).map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} ({pr.open})
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    disabled={run.isPending || currentAssignee === (d.assignee?.id ?? '')}
                    onClick={() => run.mutate({ path: `/admin/previews/requests/${id}/assign`, method: 'POST', body: { assigneeId: currentAssignee || null }, done: t('previews.detail.assigned') })}
                  >
                    {t('previews.detail.assignSave')}
                  </Button>
                </div>
              )}
            </Field>
            <Field label={t('previews.detail.offer')}>
              {(p) => (
                <Select {...p} value={currentOffer} onChange={(e) => setOffer(e.target.value || null)}>
                  <option value="">{t('previews.field.offerCards')}</option>
                  {d.offer.plans.map((plan) => (
                    <option key={plan.key} value={plan.key}>
                      {plan.name} · {formatInr(plan.priceMinor)}
                      {plan.visibility === 'HIDDEN' ? ` (${t('previews.hidden')})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('previews.field.coupon')}>{(p) => <Input {...p} value={currentCoupon} maxLength={40} className="uppercase" onChange={(e) => setCoupon(e.target.value.toUpperCase())} />}</Field>
            <div className="flex items-end">
              <Button
                variant="secondary"
                className="w-full"
                disabled={run.isPending}
                onClick={() =>
                  run.mutate({ path: `/admin/previews/requests/${id}/offer`, method: 'PUT', body: { planKey: currentOffer || null, couponCode: currentCoupon.trim() || null }, done: t('previews.detail.offerSaved') })
                }
              >
                {t('previews.detail.offerSave')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {run.isError ? <Alert>{errorMessage(run.error, t('common.error'))}</Alert> : null}
      {done ? <Alert tone="success">{done}</Alert> : null}

      <Card>
        <CardTitle>{t('previews.detail.activity')}</CardTitle>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (note.trim()) run.mutate({ path: `/admin/previews/requests/${id}/notes`, method: 'POST', body: { text: note.trim() } });
          }}
        >
          <Textarea aria-label={t('previews.detail.note')} placeholder={t('previews.detail.note')} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
          <Button type="submit" variant="secondary" disabled={!note.trim() || run.isPending}>
            {t('previews.detail.addNote')}
          </Button>
        </form>
        <ol className="mt-4 space-y-2.5">
          {d.activity.map((a) => (
            <li key={a.id} className="text-sm">
              <span className="font-medium text-stone-900">{tMaybe(`previews.act.${a.kind}`, a.kind)}</span>
              {a.actor ? <span className="text-stone-600"> · {a.actor}</span> : null}
              <span className="text-xs text-stone-500"> · {formatDateTime(a.at)}</span>
              {a.text ? <p className="mt-1 rounded-lg bg-stone-50 px-3 py-2 whitespace-pre-wrap text-stone-700">{a.text}</p> : null}
            </li>
          ))}
        </ol>
        {d.status !== 'OWNED' ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
            {ended ? (
              <Button variant="secondary" size="sm" disabled={run.isPending} onClick={() => run.mutate({ path: `/admin/previews/requests/${id}/status`, method: 'PATCH', body: { status: 'NEW' } })}>
                {t('previews.detail.reopen')}
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={run.isPending}
                  onClick={() => window.confirm(t('previews.detail.closeConfirm', { reference: d.reference })) && run.mutate({ path: `/admin/previews/requests/${id}/status`, method: 'PATCH', body: { status: 'CLOSED' } })}
                >
                  {t('previews.detail.close')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={run.isPending}
                  onClick={() => window.confirm(t('previews.detail.closeConfirm', { reference: d.reference })) && run.mutate({ path: `/admin/previews/requests/${id}/status`, method: 'PATCH', body: { status: 'CANCELLED' } })}
                >
                  {t('previews.detail.cancel')}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/** "name, 2026-12-14, 18:30, venue" lines into functions; only the name is needed. */
function parseFunctions(text: string) {
  return text
    .split('\n')
    .map((line) => line.split(',').map((part) => part.trim()))
    .filter((parts) => parts[0])
    .slice(0, 12)
    .map(([name, date, time, ...venue]) => ({
      name: name!.slice(0, 80),
      ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}),
      ...(time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? { time } : {}),
      ...(venue.join(', ').trim() ? { venue: venue.join(', ').trim().slice(0, 160) } : {}),
    }));
}

/** A customer from outside (a call, a visit, a partner): entered by staff, who confirm the customer agreed to be contacted. */
function NewRequest({ onCreated }: { onCreated: (detail: PreviewDetail) => void }) {
  const types = useQuery({ queryKey: ['meta', 'event-types'], queryFn: () => apiGet<EventTypeLite[]>('/meta/event-types'), staleTime: 300_000 });
  const languages = useQuery({ queryKey: ['meta', 'languages'], queryFn: () => apiGet<Array<{ code: string; name: string }>>('/meta/languages'), staleTime: 300_000 });
  const providers = useQuery({ queryKey: ['admin', 'previews', 'providers'], queryFn: () => apiGet<PreviewProvider[]>('/admin/previews/providers') });
  const plans = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => apiGet<Array<{ key: string; name: string; kind?: string; interval: string; priceMinor: number; active?: boolean; visibility?: string }>>('/admin/plans') });
  const [form, setForm] = useState({ name: '', phone: '', email: '', eventTypeKey: '', partnerOne: '', partnerTwo: '', honoree: '', title: '', date: '', venue: '', city: '', functions: '', templateKey: '', language: 'en', notes: '', assigneeId: '', offerPlanKey: '', offerCouponCode: '' });
  const [wants, setWants] = useState<PreviewKind[]>(['WEBSITE', 'CARD']);
  const [consent, setConsent] = useState(false);
  const type = (types.data ?? []).find((x) => x.key === form.eventTypeKey) ?? null;
  const templates = useQuery({
    queryKey: ['public', 'templates', 'WEBSITE', form.eventTypeKey],
    queryFn: () => apiGet<Array<{ key: string; name: string }>>(`/public/templates?type=WEBSITE&eventType=${encodeURIComponent(form.eventTypeKey)}`),
    enabled: Boolean(form.eventTypeKey),
    staleTime: 300_000,
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = useMutation({
    mutationFn: () =>
      apiPost<PreviewDetail>('/admin/previews/requests', {
        name: form.name,
        phone: form.phone,
        email: form.email,
        eventTypeKey: form.eventTypeKey,
        details: type?.detailsSchemaKey === 'couple' ? { partnerOne: form.partnerOne, partnerTwo: form.partnerTwo } : type?.detailsSchemaKey === 'honoree' ? { name: form.honoree } : {},
        title: form.title,
        date: form.date,
        venue: form.venue,
        city: form.city,
        functions: parseFunctions(form.functions),
        wants,
        ...(form.templateKey ? { templateKey: form.templateKey } : {}),
        language: form.language,
        notes: form.notes,
        contactConsent: consent,
        ...(form.assigneeId ? { assigneeId: form.assigneeId } : {}),
        ...(form.offerPlanKey ? { offerPlanKey: form.offerPlanKey } : {}),
        ...(form.offerCouponCode.trim() ? { offerCouponCode: form.offerCouponCode.trim() } : {}),
      }),
    onSuccess: onCreated,
  });

  const offerable = (plans.data ?? []).filter((p) => (p.kind ?? 'PLAN') === 'PLAN' && p.interval === 'ONE_TIME' && p.priceMinor > 0 && p.active !== false);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <p className="text-sm text-stone-600">{t('previews.newHint')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('previews.field.name')}>{(p) => <Input {...p} value={form.name} onChange={set('name')} maxLength={120} />}</Field>
        <Field label={t('previews.field.phone')}>{(p) => <Input {...p} type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />}</Field>
        <Field label={t('previews.field.email')}>{(p) => <Input {...p} type="email" value={form.email} onChange={set('email')} />}</Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-stone-700">{t('previews.field.wants')}</legend>
        <div className="flex flex-wrap gap-4">
          {KINDS.map((k) => (
            <Checkbox key={k} label={t(`previews.kind.${k}`)} checked={wants.includes(k)} onChange={(e) => setWants((w) => (e.target.checked ? KINDS.filter((x) => x === k || w.includes(x)) : w.filter((x) => x !== k)))} />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('previews.field.occasion')}>
          {(p) => (
            <Select {...p} value={form.eventTypeKey} onChange={set('eventTypeKey')}>
              <option value="">—</option>
              {(types.data ?? []).map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {type?.detailsSchemaKey === 'couple' ? (
          <>
            <Field label={t('previews.field.partnerOne')}>{(p) => <Input {...p} value={form.partnerOne} onChange={set('partnerOne')} maxLength={120} />}</Field>
            <Field label={t('previews.field.partnerTwo')}>{(p) => <Input {...p} value={form.partnerTwo} onChange={set('partnerTwo')} maxLength={120} />}</Field>
          </>
        ) : type?.detailsSchemaKey === 'honoree' ? (
          <Field label={t('previews.field.honoree')}>{(p) => <Input {...p} value={form.honoree} onChange={set('honoree')} maxLength={120} />}</Field>
        ) : type ? (
          <Field label={t('previews.field.title')}>{(p) => <Input {...p} value={form.title} onChange={set('title')} maxLength={160} />}</Field>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('previews.field.date')}>{(p) => <Input {...p} type="date" value={form.date} onChange={set('date')} />}</Field>
        <Field label={t('previews.field.venue')}>{(p) => <Input {...p} value={form.venue} onChange={set('venue')} maxLength={160} />}</Field>
        <Field label={t('previews.field.city')}>{(p) => <Input {...p} value={form.city} onChange={set('city')} maxLength={80} />}</Field>
      </div>
      <Field label={t('previews.field.functions')} hint={t('previews.field.functionsHint')}>
        {(p) => <Textarea {...p} rows={3} value={form.functions} onChange={set('functions')} placeholder={'Haldi, 2026-12-12, 10:00, Home\nWedding, 2026-12-14, 19:00, Taj Palace'} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('previews.field.template')}>
          {(p) => (
            <Select {...p} value={form.templateKey} onChange={set('templateKey')} disabled={!form.eventTypeKey}>
              <option value="">{t('previews.field.templateNone')}</option>
              {(templates.data ?? []).map((tpl) => (
                <option key={tpl.key} value={tpl.key}>
                  {tpl.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('previews.field.language')}>
          {(p) => (
            <Select {...p} value={form.language} onChange={set('language')}>
              {(languages.data ?? [{ code: 'en', name: 'English' }]).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label={t('previews.field.notes')}>{(p) => <Textarea {...p} rows={2} value={form.notes} onChange={set('notes')} maxLength={1000} />}</Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('previews.field.assignee')}>
          {(p) => (
            <Select {...p} value={form.assigneeId} onChange={set('assigneeId')}>
              <option value="">{t('previews.field.assigneeNone')}</option>
              {(providers.data ?? []).map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name} ({pr.open})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('previews.field.offer')}>
          {(p) => (
            <Select {...p} value={form.offerPlanKey} onChange={set('offerPlanKey')}>
              <option value="">{t('previews.field.offerAuto')}</option>
              {offerable.map((plan) => (
                <option key={plan.key} value={plan.key}>
                  {plan.name} · {formatInr(plan.priceMinor)}
                  {plan.visibility === 'HIDDEN' ? ` (${t('previews.hidden')})` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('previews.field.coupon')}>{(p) => <Input {...p} value={form.offerCouponCode} className="uppercase" onChange={(e) => setForm((f) => ({ ...f, offerCouponCode: e.target.value.toUpperCase() }))} maxLength={40} />}</Field>
      </div>
      <Checkbox label={t('previews.field.consent')} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
      {create.isError ? <Alert>{errorMessage(create.error, t('common.error'))}</Alert> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={create.isPending || !consent || !wants.length}>
          {create.isPending ? t('common.saving') : t('previews.create')}
        </Button>
      </div>
    </form>
  );
}

function Providers() {
  const invalidate = useInvalidate();
  const providers = useQuery({ queryKey: ['admin', 'previews', 'providers'], queryFn: () => apiGet<PreviewProvider[]>('/admin/previews/providers') });
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [added, setAdded] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => apiPost<{ name: string }>('/admin/previews/providers', { name: form.name, email: form.email, phone: form.phone }),
    onSuccess: async (user) => {
      setAdded(t('previews.providers.added', { name: user.name }));
      setForm({ name: '', email: '', phone: '' });
      await invalidate(['admin', 'previews']);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/previews/providers/${id}`),
    onSuccess: () => invalidate(['admin', 'previews']),
  });

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="overflow-hidden p-0">
        {providers.isPending ? <Spinner /> : null}
        {providers.isError ? <ErrorNotice error={providers.error} /> : null}
        {providers.data && !providers.data.length ? <EmptyState>{t('previews.providers.empty')}</EmptyState> : null}
        {providers.data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('common.name')}</Th>
                <Th>{t('previews.providers.twoStep')}</Th>
                <Th className="text-right">{t('previews.providers.open')}</Th>
                <Th className="text-right">{t('previews.providers.owned')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {providers.data.map((pr) => (
                <tr key={pr.id}>
                  <Td>
                    <span className="font-medium text-stone-900">{pr.name}</span>
                    <span className="block text-xs text-stone-500">{[pr.email, pr.phone].filter(Boolean).join(' · ')}</span>
                  </Td>
                  <Td>
                    <Badge tone={pr.twoStep ? 'success' : 'warning'}>{pr.twoStep ? t('common.yes') : t('common.no')}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{pr.open}</Td>
                  <Td className="text-right tabular-nums">{pr.owned}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => window.confirm(t('previews.providers.removeConfirm', { name: pr.name })) && remove.mutate(pr.id)}>
                      <Trash2 className="size-4" aria-hidden /> {t('previews.providers.remove')}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
        {remove.isError ? <Alert className="m-4">{errorMessage(remove.error, t('common.error'))}</Alert> : null}
      </Card>
      <Card>
        <CardTitle>{t('previews.providers.add')}</CardTitle>
        <p className="mt-1 text-sm text-stone-600">{t('previews.providers.addHint')}</p>
        <form
          className="mt-4 space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setAdded(null);
            add.mutate();
          }}
        >
          <Field label={t('previews.providers.name')}>{(p) => <Input {...p} value={form.name} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />}</Field>
          <Field label={t('previews.providers.email')}>{(p) => <Input {...p} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />}</Field>
          <Field label={t('previews.providers.phone')}>{(p) => <Input {...p} type="tel" value={form.phone} placeholder="+91 98765 43210" onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />}</Field>
          {!form.email.trim() && !form.phone.trim() && form.name.trim() ? <p className="text-xs text-stone-500">{t('previews.providers.needOne')}</p> : null}
          {add.isError ? <Alert>{errorMessage(add.error, t('common.error'))}</Alert> : null}
          {added ? <Alert tone="success">{added}</Alert> : null}
          <Button type="submit" className="w-full" disabled={add.isPending || !form.name.trim() || (!form.email.trim() && !form.phone.trim())}>
            <UserPlus className="size-4" aria-hidden /> {t('previews.providers.add')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
