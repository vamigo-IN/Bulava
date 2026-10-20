'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, Hand, Inbox, Layers, MapPin, PenLine, Search, Send, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useEventTypes, useMe } from '@/lib/queries';
import { OPEN_STATUSES, type DeskList, type DeskRow, type DeskSummary, type PreviewStatus } from '@/lib/previews';
import { cn } from '@/lib/utils';
import { CountUp } from '@/components/dashboard/count-up';
import { relativeTime } from '@/components/dashboard/notification-text';
import { DeskError, DeskHeader, shortDate, StatusBadge, Wants } from '@/components/desk/desk-ui';
import { Alert, EmptyState, Input, Select, Spinner } from '@/components/ui/primitives';

type Scope = 'mine' | 'open' | 'all';
const STATUSES: PreviewStatus[] = [...OPEN_STATUSES, 'OWNED', 'CLOSED', 'CANCELLED'];

export default function DeskPage() {
  const t = useT();
  return (
    <Suspense fallback={<Spinner label={t('common.loading')} />}>
      <Desk />
    </Suspense>
  );
}

/**
 * The preview desk (ADR-076): the provider's own requests, the open queue
 * (first come, first served) and, for staff who manage previews, every
 * request. A request opens on its own page, where the previews are made.
 */
function Desk() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const me = useMe();
  const types = useEventTypes();
  const manage = Boolean(me.data?.platformPermissions?.includes('preview.manage'));
  const scope = ((['mine', 'open', 'all'] as const).find((s) => s === params.get('scope')) ?? 'mine') as Scope;
  const status = (STATUSES.find((s) => s === params.get('status')) ?? '') as PreviewStatus | '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [taking, setTaking] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const go = (next: Partial<{ scope: Scope; status: string; q: string; page: number }>) => {
    const merged = { scope, status, q: params.get('q') ?? '', page, ...next };
    const query = new URLSearchParams();
    if (merged.scope !== 'mine') query.set('scope', merged.scope);
    if (merged.status) query.set('status', merged.status);
    if (merged.q) query.set('q', merged.q);
    if (merged.page > 1) query.set('page', String(merged.page));
    router.replace(`/dashboard/desk${query.size ? `?${query}` : ''}`, { scroll: false });
  };

  // Typing searches after a pause.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (q.trim() === current) return;
    const id = setTimeout(() => go({ q: q.trim(), page: 1 }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const summary = useQuery({ queryKey: ['desk', 'summary'], queryFn: () => apiGet<DeskSummary>('/desk/summary'), refetchInterval: 30_000 });
  const query = new URLSearchParams({ scope, page: String(page), ...(status ? { status } : {}), ...(params.get('q') ? { q: params.get('q')! } : {}) });
  const list = useQuery({ queryKey: ['desk', 'list', query.toString()], queryFn: () => apiGet<DeskList>(`/desk/requests?${query}`), refetchInterval: scope === 'open' ? 20_000 : 60_000 });

  if (summary.isError && !summary.data) return <DeskError error={summary.error} onRetry={() => void summary.refetch()} retrying={summary.isFetching} />;

  const take = async (row: DeskRow) => {
    setTaking(row.id);
    setProblem(null);
    try {
      await apiPost(`/desk/requests/${row.id}/take`);
      void client.invalidateQueries({ queryKey: ['desk'] });
      router.push(`/dashboard/desk/${row.id}`);
    } catch (error) {
      setProblem(errorMessage(t, error));
      void client.invalidateQueries({ queryKey: ['desk'] });
    } finally {
      setTaking(null);
    }
  };

  const typeName = new Map((types.data ?? []).map((x) => [x.key, x.name]));
  const tiles: Array<{ label: string; value: number; icon: LucideIcon; scope: Scope; status?: PreviewStatus }> = [
    { label: t('desk.stat.mine'), value: summary.data?.mine ?? 0, icon: UserRound, scope: 'mine' },
    { label: t('desk.stat.open'), value: summary.data?.open ?? 0, icon: Inbox, scope: 'open' },
    { label: t('desk.stat.changes'), value: summary.data?.changes ?? 0, icon: PenLine, scope: 'mine', status: 'CHANGES_REQUESTED' },
    { label: t('desk.stat.sent'), value: summary.data?.sent ?? 0, icon: Send, scope: 'mine', status: 'SENT' },
  ];
  const scopes: Scope[] = manage ? ['mine', 'open', 'all'] : ['mine', 'open'];
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <DeskHeader eyebrow={t('desk.eyebrow')} title={t('desk.title')}>
        <p className="mt-2 max-w-2xl text-ivory/70">{t('desk.subtitle')}</p>
      </DeskHeader>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, scope: s, status: st }) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => go({ scope: s, status: st ?? '', page: 1 })}
              className={cn('clay clay-lift block w-full rounded-2xl p-4 text-left', scope === s && status === (st ?? '') && 'ring-2 ring-gold-300')}
            >
              <Icon aria-hidden className="size-4 text-gold-600" />
              <span className="mt-2 block font-display text-3xl leading-none text-ink">
                <CountUp value={value} />
              </span>
              <span className="mt-1 block text-xs text-stone-500">{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <section aria-label={t('desk.title')} className="clay rounded-[1.75rem] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label={t('desk.title')} className="clay-inset flex rounded-full p-1">
            {scopes.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={scope === s}
                onClick={() => go({ scope: s, page: 1 })}
                className={cn('min-h-9 rounded-full px-4 text-sm font-medium transition-colors', scope === s ? 'bg-night-900 text-ivory' : 'text-stone-600 hover:text-ink')}
              >
                {t(`desk.scope.${s}`)}
              </button>
            ))}
          </div>
          <label className="relative min-w-[12rem] flex-1">
            <span className="sr-only">{t('desk.search')}</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('desk.search')} className="pl-10" maxLength={80} />
          </label>
          <Select aria-label={t('desk.status.any')} value={status} onChange={(e) => go({ status: e.target.value, page: 1 })} className="w-auto">
            <option value="">{t('desk.status.any')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`desk.status.${s}`)}
              </option>
            ))}
          </Select>
        </div>

        {problem ? (
          <div className="mt-4">
            <Alert>{problem}</Alert>
          </div>
        ) : null}

        <div className="mt-5">
          {list.isPending ? (
            <Spinner label={t('common.loading')} />
          ) : list.isError ? (
            <DeskError error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} />
          ) : !list.data.requests.length ? (
            <EmptyState>{t(`desk.empty.${scope}`)}</EmptyState>
          ) : (
            <ul className="grid gap-3">
              {list.data.requests.map((row) => (
                <li key={row.id}>
                  <RequestRow row={row} typeName={typeName.get(row.eventTypeKey) ?? row.eventTypeKey} onTake={!row.assignee && OPEN_STATUSES.includes(row.status) ? () => void take(row) : null} taking={taking === row.id} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {list.data && pages > 1 ? (
          <nav aria-label={t('desk.page', { page, pages })} className="mt-5 flex items-center justify-between gap-3">
            <button type="button" disabled={page <= 1} onClick={() => go({ page: page - 1 })} className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm disabled:opacity-50">
              <ChevronLeft aria-hidden className="size-4" />
              {t('desk.prev')}
            </button>
            <span className="text-sm text-stone-600">{t('desk.page', { page, pages })}</span>
            <button type="button" disabled={page >= pages} onClick={() => go({ page: page + 1 })} className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm disabled:opacity-50">
              {t('desk.next')}
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

/** One request: who and what, where it stands, and (in the queue) taking it. */
function RequestRow({ row, typeName, onTake, taking }: { row: DeskRow; typeName: string; onTake: (() => void) | null; taking: boolean }) {
  const t = useT();
  const when = shortDate(row.date);
  return (
    <div className="group relative flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-white/70 p-4 ring-1 ring-gold-200/80 transition-[background-color,box-shadow] hover:bg-white hover:shadow-soft">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold tracking-wider text-brand-700">{row.reference}</span>
          <StatusBadge status={row.status} />
          {row.source === 'STAFF' ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200">{t('desk.source.STAFF')}</span> : null}
        </div>
        <Link href={`/dashboard/desk/${row.id}`} className="mt-1.5 block truncate font-display text-2xl leading-tight text-ink after:absolute after:inset-0 after:content-[''] hover:text-brand-700">
          {row.title}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
          <span>{typeName}</span>
          {when ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden className="size-3.5 text-gold-600" />
              {when}
            </span>
          ) : null}
          {row.city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5 text-gold-600" />
              {row.city}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <UserRound aria-hidden className="size-3.5 text-gold-600" />
            {row.name}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
        <Wants wants={row.wants} />
        <span className="inline-flex items-center gap-1.5" title={t('desk.itemsCount', { count: row.items })}>
          <Layers aria-hidden className="size-4 text-stone-400" />
          {row.items}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {row.views ? <Eye aria-hidden className="size-4 text-emerald-600" /> : <EyeOff aria-hidden className="size-4 text-stone-400" />}
          {row.views ? (row.views === 1 ? t('desk.viewedOnce') : t('desk.viewed', { count: row.views })) : row.sentAt ? t('desk.notViewed') : '—'}
        </span>
        <span className="text-xs text-stone-500">{row.assignee?.name ?? t('desk.unassigned')}</span>
        <span className="text-xs text-stone-500">{relativeTime(row.updatedAt)}</span>
      </div>
      {onTake ? (
        <button type="button" onClick={onTake} disabled={taking} className="btn-3d relative z-10 min-h-10 rounded-full px-4 text-sm">
          <Hand aria-hidden className="size-4" />
          {t('desk.take')}
        </button>
      ) : (
        <ArrowRight aria-hidden className="hidden size-5 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700 sm:block" />
      )}
    </div>
  );
}
