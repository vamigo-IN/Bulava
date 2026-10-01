'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Star } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { apiDelete, apiGet, apiPost, apiPut, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Testimonial } from '@/lib/types';
import { formatDate, fromDateInput, toDateInput } from '@/lib/utils';

export default function TestimonialsPage() {
  return (
    <RequirePermission permission="content.manage">
      <Testimonials />
    </RequirePermission>
  );
}

function Testimonials() {
  const invalidate = useInvalidate();
  const list = useQuery({ queryKey: ['admin', 'testimonials'], queryFn: () => apiGet<Testimonial[]>('/admin/testimonials') });
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/testimonials/${id}`),
    onSuccess: () => invalidate(['admin', 'testimonials']),
  });

  return (
    <>
      <PageHeader
        title={t('testimonials.title')}
        subtitle={t('testimonials.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> {t('testimonials.new')}
          </Button>
        }
      />
      {remove.isError ? <Alert className="mb-4">{errorMessage(remove.error, t('common.error'))}</Alert> : null}
      {list.isPending ? <Spinner /> : null}
      {list.isError ? <ErrorNotice error={list.error} /> : null}
      {list.data && !list.data.length ? <EmptyState>{t('testimonials.none')}</EmptyState> : null}
      <ul className="grid gap-4 md:grid-cols-2">
        {list.data?.map((item) => (
          <li key={item.id} className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex text-gold-500" aria-label={`${item.rating}/5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className="size-4" fill={i < item.rating ? 'currentColor' : 'none'} aria-hidden />
                ))}
              </span>
              <Badge tone={item.published ? 'success' : 'neutral'}>{item.published ? t('status.PUBLISHED') : t('status.DRAFT')}</Badge>
            </div>
            <blockquote className="mt-3 flex-1 font-display text-lg leading-snug text-stone-800">“{item.quote}”</blockquote>
            <p className="mt-3 text-sm font-medium">{item.authorName}</p>
            <p className="text-xs text-stone-500">{[item.eventLabel, item.location].filter(Boolean).join(' · ')}</p>
            <p className="mt-1 text-xs text-stone-400">{`${t('testimonials.consent')}: ${formatDate(item.consentAt)}`}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(item)}>
                {t('common.edit')}
              </Button>
              <Button size="sm" variant="danger" disabled={remove.isPending} onClick={() => window.confirm(t('testimonials.confirmDelete')) && remove.mutate(item.id)}>
                {t('common.delete')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('testimonials.new') : t('common.edit')} wide>
        {editing ? <TestimonialForm initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </>
  );
}

function TestimonialForm({ initial, onDone }: { initial: Testimonial | null; onDone: () => void }) {
  const invalidate = useInvalidate();
  const [form, setForm] = useState({
    quote: initial?.quote ?? '',
    authorName: initial?.authorName ?? '',
    location: initial?.location ?? '',
    eventLabel: initial?.eventLabel ?? '',
    rating: initial?.rating ?? 5,
    consentAt: toDateInput(initial?.consentAt),
    published: initial?.published ?? false,
    sortOrder: initial?.sortOrder ?? 0,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        quote: form.quote.trim(),
        authorName: form.authorName.trim(),
        ...(form.location.trim() ? { location: form.location.trim() } : {}),
        ...(form.eventLabel.trim() ? { eventLabel: form.eventLabel.trim() } : {}),
        rating: form.rating,
        consentAt: fromDateInput(form.consentAt),
        published: form.published,
        sortOrder: form.sortOrder,
      };
      return initial ? apiPut(`/admin/testimonials/${initial.id}`, body) : apiPost('/admin/testimonials', body);
    },
    onSuccess: async () => {
      await invalidate(['admin', 'testimonials']);
      onDone();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Alert tone="info">{t('testimonials.subtitle')}</Alert>
      {save.isError ? <Alert>{errorMessage(save.error, t('common.error'))}</Alert> : null}
      <Field label={t('testimonials.quote')}>
        {(p) => <Textarea {...p} required minLength={10} maxLength={600} rows={4} value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('testimonials.author')}>{(p) => <Input {...p} required maxLength={80} value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} />}</Field>
        <Field label={t('testimonials.location')}>{(p) => <Input {...p} maxLength={80} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
        <Field label={t('testimonials.eventLabel')}>{(p) => <Input {...p} maxLength={80} value={form.eventLabel} onChange={(e) => setForm({ ...form, eventLabel: e.target.value })} />}</Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('testimonials.rating')}>
          {(p) => (
            <Select {...p} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {'★'.repeat(n)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('testimonials.consent')}>
          {(p) => <Input {...p} type="date" required max={toDateInput(new Date().toISOString())} value={form.consentAt} onChange={(e) => setForm({ ...form, consentAt: e.target.value })} />}
        </Field>
        <Field label={t('details.sortOrder')}>
          {(p) => <Input {...p} type="number" min={0} max={1000} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />}
        </Field>
      </div>
      <Checkbox label={t('testimonials.published')} checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}
