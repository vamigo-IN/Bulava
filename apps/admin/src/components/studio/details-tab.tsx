'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiGet, apiPatch, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { AdminTemplate, EventTypeOption } from '@/lib/types';
import { useInvalidate } from '../shell';
import { Alert, Button, Card, CardTitle, Checkbox, Field, Input, Select, Textarea } from '../ui';
import { EditError, type EditorProps } from './common';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export function DetailsTab({ template, definition, edit }: EditorProps & { template: AdminTemplate }) {
  const eventTypes = useQuery({ queryKey: ['meta', 'event-types'], queryFn: () => apiGet<EventTypeOption[]>('/meta/event-types'), staleTime: 300_000 });
  const languages = useQuery({ queryKey: ['meta', 'languages'], queryFn: () => apiGet<LanguageOption[]>('/meta/languages'), staleTime: 300_000 });
  const [defError, setDefError] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <ListingForm key={template.updatedAt} template={template} eventTypes={eventTypes.data ?? []} onEventTypes={(types) => edit((d) => void (d.eventTypes = types))} />

      <Card>
        <CardTitle>{t('details.definition')}</CardTitle>
        <div className="space-y-4">
          <Field label={t('details.definitionName')}>
            {(p) => (
              <Input
                {...p}
                key={definition.name}
                maxLength={80}
                defaultValue={definition.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== definition.name && setDefError(edit((d) => void (d.name = e.target.value.trim())))}
              />
            )}
          </Field>
          <Field label={t('details.description')}>
            {(p) => (
              <Textarea
                {...p}
                key={definition.description}
                maxLength={500}
                rows={3}
                defaultValue={definition.description}
                onBlur={(e) => e.target.value !== definition.description && setDefError(edit((d) => void (d.description = e.target.value)))}
              />
            )}
          </Field>
          <fieldset>
            <legend className="mb-1 text-xs font-semibold tracking-wide text-stone-600 uppercase">{t('details.languages')}</legend>
            <div className="flex flex-wrap gap-x-5">
              {(languages.data ?? []).map((l) => (
                <Checkbox
                  key={l.code}
                  label={`${l.name} (${l.nativeName})`}
                  checked={definition.languages.includes(l.code)}
                  onChange={(e) =>
                    setDefError(
                      edit((d) => {
                        d.languages = e.target.checked ? [...d.languages, l.code] : d.languages.filter((x) => x !== l.code);
                      }),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          <EditError message={defError} />
        </div>
      </Card>
    </div>
  );
}

function ListingForm({ template, eventTypes, onEventTypes }: { template: AdminTemplate; eventTypes: EventTypeOption[]; onEventTypes: (types: string[]) => void }) {
  const invalidate = useInvalidate();
  const [form, setForm] = useState({
    name: template.name,
    description: template.description ?? '',
    category: template.category,
    style: template.style ?? '',
    tier: template.tier,
    badge: template.badge ?? '',
    featured: template.featured,
    tags: template.tags.join(', '),
    eventTypes: template.eventTypes,
    sortOrder: template.sortOrder,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      apiPatch(`/admin/templates/${template.id}`, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim(),
        style: form.style.trim() || null,
        tier: form.tier,
        badge: form.badge || null,
        featured: form.featured,
        tags: form.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        eventTypes: form.eventTypes,
        sortOrder: form.sortOrder,
      }),
    onSuccess: async () => {
      // Keep the definition's event types (used by the test matrix) in step with the catalog.
      onEventTypes(form.eventTypes);
      await invalidate(['admin', 'template', template.id], ['admin', 'templates']);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Card>
      <CardTitle>{t('studio.tab.details')}</CardTitle>
      <p className="-mt-2 mb-4 text-xs text-stone-500">{t('details.catalogHint')}</p>
      <form onSubmit={submit} className="space-y-4">
        {save.isError ? <Alert>{errorMessage(save.error, t('common.error'))}</Alert> : null}
        {save.isSuccess ? <Alert tone="success">{t('common.saved')}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.name')}>{(p) => <Input {...p} required maxLength={80} value={form.name} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label={t('common.category')}>{(p) => <Input {...p} required maxLength={60} value={form.category} onChange={(e) => set('category', e.target.value)} />}</Field>
        </div>
        <Field label={t('details.description')}>{(p) => <Textarea {...p} rows={2} maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} />}</Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('details.style')}>{(p) => <Input {...p} maxLength={40} value={form.style} onChange={(e) => set('style', e.target.value)} />}</Field>
          <Field label={t('details.tier')}>
            {(p) => (
              <Select {...p} value={form.tier} onChange={(e) => set('tier', e.target.value as typeof form.tier)}>
                {(['FREE', 'STANDARD', 'PREMIUM'] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`tier.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('details.badge')}>
            {(p) => (
              <Select {...p} value={form.badge} onChange={(e) => set('badge', e.target.value as typeof form.badge)}>
                <option value="">{t('details.noBadge')}</option>
                {(['NEW', 'POPULAR', 'BESTSELLER'] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`badge.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label={t('details.tags')} hint={t('details.tagsHint')}>
            {(p) => <Input {...p} value={form.tags} onChange={(e) => set('tags', e.target.value)} />}
          </Field>
          <Field label={t('details.sortOrder')}>
            {(p) => <Input {...p} type="number" min={0} max={100000} value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value) || 0)} />}
          </Field>
        </div>
        <Checkbox label={t('details.featured')} checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
        <fieldset>
          <legend className="mb-1 text-xs font-semibold tracking-wide text-stone-600 uppercase">{t('details.eventTypes')}</legend>
          <p className="mb-2 text-xs text-stone-500">{t('details.eventTypesHint')}</p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {eventTypes.map((et) => (
              <Checkbox
                key={et.key}
                label={et.name}
                checked={form.eventTypes.includes(et.key)}
                onChange={(e) => set('eventTypes', e.target.checked ? [...form.eventTypes, et.key] : form.eventTypes.filter((k) => k !== et.key))}
              />
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('details.saveListing')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
