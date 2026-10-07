'use client';

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Inbox, Mail, Phone, Send, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, ErrorNotice, Field, Input, PageHeader, Select, Spinner, Tabs, Textarea, type BadgeTone } from '@/components/ui';
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { ContactMessageDetail, ContactMessageSummary, ContactStatus } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

type Filter = ContactStatus | 'ALL';
const FILTERS: Filter[] = ['NEW', 'OPEN', 'RESOLVED', 'SPAM', 'ALL'];
const STATUSES: ContactStatus[] = ['NEW', 'OPEN', 'RESOLVED', 'SPAM'];
const STATUS_TONE: Record<ContactStatus, BadgeTone> = { NEW: 'brand', OPEN: 'warning', RESOLVED: 'success', SPAM: 'neutral' };

export default function MessagesPage() {
  return (
    <RequirePermission permission="contact.manage">
      <Messages />
    </RequirePermission>
  );
}

function Messages() {
  const [filter, setFilter] = useState<Filter>('NEW');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  // Search after a short pause in typing.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const counts = useQuery({ queryKey: ['admin', 'contact', 'counts'], queryFn: () => apiGet<Record<ContactStatus, number>>('/admin/contact-messages/counts'), refetchInterval: 60_000 });
  const list = useInfiniteQuery({
    queryKey: ['admin', 'contact', 'list', filter, q],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ ...(filter === 'ALL' ? {} : { status: filter }), ...(q ? { q } : {}), ...(pageParam ? { cursor: pageParam } : {}) });
      return apiGet<{ items: ContactMessageSummary[]; nextCursor: string | null }>(`/admin/contact-messages?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const count = (f: Filter) => (f === 'ALL' || !counts.data ? '' : ` (${counts.data[f]})`);

  return (
    <>
      <PageHeader title={t('messages.title')} subtitle={t('messages.subtitle')} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          className="min-w-0 flex-1"
          tabs={FILTERS.map((f) => ({ key: f, label: `${t(`messages.filter.${f}`)}${count(f)}` }))}
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setSelected(null);
          }}
        />
        <Input type="search" aria-label={t('messages.search')} placeholder={t('messages.search')} className="w-full sm:w-72" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <div className={cn(selected && 'hidden lg:block')}>
          {list.isPending ? <Spinner /> : null}
          {list.isError ? <ErrorNotice error={list.error} /> : null}
          {list.data && !items.length ? <EmptyState>{q ? t('messages.noMatches') : t(`messages.empty.${filter}`)}</EmptyState> : null}
          <ul className="space-y-2">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(m.id)}
                  aria-current={selected === m.id ? 'true' : undefined}
                  className={cn(
                    'w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-brand-200',
                    selected === m.id ? 'border-brand-600 ring-2 ring-brand-100' : 'border-stone-200',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-sm text-stone-900', m.status === 'NEW' ? 'font-semibold' : 'font-medium')}>{m.name}</span>
                    <span className="shrink-0 text-xs text-stone-500">{formatDateTime(m.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={STATUS_TONE[m.status]}>{t(`messages.status.${m.status}`)}</Badge>
                    <span className="text-xs text-stone-500">{t(`messages.topic.${m.topic}`)}</span>
                    {m.replies ? <span className="text-xs text-stone-400">· {t('messages.repliesCount', { count: m.replies })}</span> : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-stone-600">{m.preview}</p>
                </button>
              </li>
            ))}
          </ul>
          {list.hasNextPage ? (
            <Button variant="secondary" className="mt-3 w-full" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
              {list.isFetchingNextPage ? t('common.loading') : t('messages.more')}
            </Button>
          ) : null}
        </div>

        <div className={cn(!selected && 'hidden lg:block')}>
          {selected ? (
            <MessageDetail key={selected} id={selected} onBack={() => setSelected(null)} onDeleted={() => setSelected(null)} />
          ) : (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
              <div>
                <Inbox className="mx-auto mb-2 size-6 text-stone-400" aria-hidden />
                {t('messages.pick')}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MessageDetail({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) {
  const invalidate = useInvalidate();
  const detail = useQuery({ queryKey: ['admin', 'contact', 'detail', id], queryFn: () => apiGet<ContactMessageDetail>(`/admin/contact-messages/${id}`) });
  const [reply, setReply] = useState('');
  const [resolve, setResolve] = useState(true);
  const [status, setStatus] = useState<ContactStatus | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = () => invalidate(['admin', 'contact']);
  const send = useMutation({
    mutationFn: () => apiPost<ContactMessageDetail>(`/admin/contact-messages/${id}/replies`, { body: reply.trim(), resolve }),
    onSuccess: async () => {
      setReply('');
      await refresh();
    },
  });
  const update = useMutation({
    mutationFn: (body: { status?: ContactStatus; note?: string }) => apiPatch<ContactMessageDetail>(`/admin/contact-messages/${id}`, body),
    onSuccess: async () => {
      setStatus(null);
      setNote(null);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => apiDelete(`/admin/contact-messages/${id}`),
    onSuccess: async () => {
      await refresh();
      onDeleted();
    },
  });

  if (detail.isPending) return <Spinner />;
  if (detail.isError) return <ErrorNotice error={detail.error} />;
  const m = detail.data;
  const currentStatus = status ?? m.status;
  const currentNote = note ?? m.note ?? '';
  const triageDirty = currentStatus !== m.status || currentNote !== (m.note ?? '');

  function submitReply(e: FormEvent) {
    e.preventDefault();
    if (reply.trim().length >= 2) send.mutate();
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700 lg:hidden">
        <ArrowLeft className="size-4" aria-hidden /> {t('messages.back')}
      </button>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-stone-900">{m.name}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: [${m.reference}]`)}`} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                <Mail className="size-3.5" aria-hidden /> {m.email}
              </a>
              {m.phone ? (
                <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                  <Phone className="size-3.5" aria-hidden /> {m.phone}
                </a>
              ) : null}
            </div>
          </div>
          <div className="text-right text-xs text-stone-500">
            <p className="font-mono text-sm font-semibold text-stone-700">{m.reference}</p>
            <p>{formatDateTime(m.createdAt)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone={STATUS_TONE[m.status]}>{t(`messages.status.${m.status}`)}</Badge>
          <Badge tone="gold">{t(`messages.topic.${m.topic}`)}</Badge>
          {m.handledByName ? <Badge>{t('messages.handledBy', { name: m.handledByName })}</Badge> : null}
        </div>
        <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-stone-800">{m.message}</p>

        {m.replies.length ? (
          <ol className="mt-4 space-y-3">
            {m.replies.map((r) => (
              <li key={r.id} className="rounded-lg border border-brand-100 bg-brand-50/50 p-4">
                <p className="mb-1.5 text-xs text-stone-500">{t('messages.replied', { name: r.sentByName ?? t('messages.staff'), when: formatDateTime(r.createdAt) })}</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-stone-800">{r.body}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>

      <Card>
        <form onSubmit={submitReply} className="space-y-3">
          <Field label={t('messages.reply')} hint={t('messages.replyHint', { email: m.email })}>
            {(p) => <Textarea {...p} rows={6} maxLength={8000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('messages.replyPlaceholder', { name: m.name.split(' ')[0] ?? m.name })} />}
          </Field>
          {send.isError ? <Alert>{errorMessage(send.error, t('common.error'))}</Alert> : null}
          {send.isSuccess ? <Alert tone="success">{t('messages.sent')}</Alert> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Checkbox label={t('messages.resolveAfter')} checked={resolve} onChange={(e) => setResolve(e.target.checked)} />
            <Button type="submit" disabled={send.isPending || reply.trim().length < 2}>
              <Send className="size-4" aria-hidden /> {send.isPending ? t('messages.sending') : t('messages.send')}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <Field label={t('common.status')}>
            {(p) => (
              <Select {...p} value={currentStatus} onChange={(e) => setStatus(e.target.value as ContactStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`messages.status.${s}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('messages.note')} hint={t('messages.noteHint')}>
            {(p) => <Textarea {...p} rows={2} maxLength={4000} value={currentNote} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
        {update.isError ? <Alert className="mt-3">{errorMessage(update.error, t('common.error'))}</Alert> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="danger"
            size="sm"
            disabled={remove.isPending}
            onClick={() => window.confirm(t('messages.confirmDelete', { reference: m.reference })) && remove.mutate()}
          >
            <Trash2 className="size-4" aria-hidden /> {t('common.delete')}
          </Button>
          <Button
            variant="secondary"
            disabled={!triageDirty || update.isPending}
            onClick={() => update.mutate({ ...(currentStatus !== m.status ? { status: currentStatus } : {}), ...(currentNote !== (m.note ?? '') ? { note: currentNote } : {}) })}
          >
            {update.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
