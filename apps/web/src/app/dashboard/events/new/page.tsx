'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreateEventSchema } from '@bulava/validation';
import { ApiError, apiPost, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { keys, useEventTypes, useLanguages } from '@/lib/queries';
import type { AccessMode, EventSummary } from '@/lib/types';
import { Alert, Button, Card, Checkbox, Field, Input, Select, Spinner } from '@/components/ui/primitives';

const ACCESS_MODES: AccessMode[] = ['INVITE_ONLY', 'PRIVATE_LINK', 'GROUP_RESTRICTED', 'SECRET_TOKEN', 'PUBLIC'];

function NewEventForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const templateKey = params.get('template');
  const client = useQueryClient();
  const types = useEventTypes();
  const languages = useLanguages();

  const [typeKey, setTypeKey] = useState('WEDDING');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('en');
  const [accessMode, setAccessMode] = useState<AccessMode>('INVITE_ONLY');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [applyDefaults, setApplyDefaults] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const type = types.data?.find((x) => x.key === typeKey);
  const detailFields =
    type?.detailsSchemaKey === 'couple'
      ? (['partnerOne', 'partnerTwo'] as const)
      : type?.detailsSchemaKey === 'honoree'
        ? (['name'] as const)
        : [];
  const detailLabel = { partnerOne: t('event.field.partnerOne'), partnerTwo: t('event.field.partnerTwo'), name: t('event.field.honoree') };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      typeKey,
      title,
      language,
      accessMode,
      applyDefaults,
      details: Object.fromEntries(detailFields.map((f) => [f, details[f] ?? ''])),
    };
    const parsed = CreateEventSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const event = await apiPost<EventSummary>('/events', payload);
      await client.invalidateQueries({ queryKey: keys.events });
      // Came from 'Use this template': apply it, or offer the upgrade for paid designs.
      if (templateKey) {
        try {
          await apiPut(`/events/${event.id}/design/website`, { templateKey });
          router.push(`/dashboard/events/${event.id}/design`);
        } catch (err) {
          const upgrade = err instanceof ApiError && err.code === 'PLAN_UPGRADE_REQUIRED';
          router.push(upgrade ? `/dashboard/events/${event.id}/upgrade?template=${encodeURIComponent(templateKey)}` : `/dashboard/events/${event.id}/design`);
        }
        return;
      }
      router.push(`/dashboard/events/${event.id}`);
    } catch (err) {
      setError(errorMessage(t, err));
      setSubmitting(false);
    }
  };

  if (types.isPending || languages.isPending) return <Spinner label={t('common.loading')} />;

  return (
    <Card className="mx-auto max-w-xl rounded-3xl p-6 sm:p-8">
      <h1 className="font-display text-3xl">{t('event.create.title')}</h1>
      <p className="mb-5 text-sm text-stone-600">{t('dash.newEvent.subtitle')}</p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label={t('event.field.type')}>
          {(p) => (
            <Select {...p} value={typeKey} onChange={(e) => setTypeKey(e.target.value)}>
              {types.data?.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('event.field.title')} error={fieldErrors.title}>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aman & Riya Wedding" />}
        </Field>
        {detailFields.map((f) => (
          <Field key={f} label={detailLabel[f]} error={fieldErrors[`details.${f}`]}>
            {(p) => <Input {...p} value={details[f] ?? ''} onChange={(e) => setDetails({ ...details, [f]: e.target.value })} />}
          </Field>
        ))}
        <Field label={t('event.field.language')}>
          {(p) => (
            <Select {...p} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {languages.data?.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} ({l.name})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('event.field.accessMode')}>
          {(p) => (
            <Select {...p} value={accessMode} onChange={(e) => setAccessMode(e.target.value as AccessMode)}>
              {ACCESS_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`access.${m}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {type && type.defaultFunctions.length > 0 ? (
          <Checkbox
            checked={applyDefaults}
            onChange={(e) => setApplyDefaults(e.target.checked)}
            label={`${t('event.field.applyDefaults')}: ${type.defaultFunctions.map((f) => f.name).join(', ')}`}
          />
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t('common.saving') : t('common.create')}
        </Button>
      </form>
    </Card>
  );
}

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEventForm />
    </Suspense>
  );
}
