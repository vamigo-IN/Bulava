'use client';

import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiPut, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { License } from '@/lib/types';
import { formatDate, fromDateInput, toDateInput } from '@/lib/utils';
import { useInvalidate } from './shell';
import { Alert, Badge, Button, Checkbox, Field, Input } from './ui';

export interface LicenseForm {
  licenseType: string;
  provider: string;
  source: string;
  purchaseReference: string;
  commercialUse: boolean;
  onDemandUse: boolean;
  socialMediaUse: boolean;
  attributionRequired: boolean;
  attributionText: string;
  expiresAt: string;
}

export const EMPTY_LICENSE: LicenseForm = {
  licenseType: '',
  provider: '',
  source: '',
  purchaseReference: '',
  commercialUse: false,
  onDemandUse: false,
  socialMediaUse: false,
  attributionRequired: false,
  attributionText: '',
  expiresAt: '',
};

/** The API payload for a licence (empty optional fields are omitted). */
export function licensePayload(f: LicenseForm) {
  return {
    licenseType: f.licenseType.trim(),
    provider: f.provider.trim(),
    ...(f.source.trim() ? { source: f.source.trim() } : {}),
    ...(f.purchaseReference.trim() ? { purchaseReference: f.purchaseReference.trim() } : {}),
    commercialUse: f.commercialUse,
    onDemandUse: f.onDemandUse,
    socialMediaUse: f.socialMediaUse,
    attributionRequired: f.attributionRequired,
    ...(f.attributionRequired && f.attributionText.trim() ? { attributionText: f.attributionText.trim() } : {}),
    expiresAt: fromDateInput(f.expiresAt),
  };
}

export function LicenseFields({ value, onChange }: { value: LicenseForm; onChange: (next: LicenseForm) => void }) {
  const set = <K extends keyof LicenseForm>(key: K, v: LicenseForm[K]) => onChange({ ...value, [key]: v });
  return (
    <fieldset className="space-y-3 rounded-xl border border-stone-200 p-4">
      <legend className="px-1 text-sm font-semibold">{t('license.title')}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('license.type')} hint={t('license.typeHint')}>
          {(p) => <Input {...p} required maxLength={60} value={value.licenseType} onChange={(e) => set('licenseType', e.target.value)} />}
        </Field>
        <Field label={t('license.provider')}>{(p) => <Input {...p} required maxLength={120} value={value.provider} onChange={(e) => set('provider', e.target.value)} />}</Field>
        <Field label={t('license.source')}>{(p) => <Input {...p} type="url" maxLength={500} value={value.source} onChange={(e) => set('source', e.target.value)} />}</Field>
        <Field label={t('license.reference')}>
          {(p) => <Input {...p} maxLength={200} value={value.purchaseReference} onChange={(e) => set('purchaseReference', e.target.value)} />}
        </Field>
      </div>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Checkbox label={t('license.commercial')} checked={value.commercialUse} onChange={(e) => set('commercialUse', e.target.checked)} />
        <Checkbox label={t('license.onDemand')} checked={value.onDemandUse} onChange={(e) => set('onDemandUse', e.target.checked)} />
        <Checkbox label={t('license.social')} checked={value.socialMediaUse} onChange={(e) => set('socialMediaUse', e.target.checked)} />
        <Checkbox label={t('license.attribution')} checked={value.attributionRequired} onChange={(e) => set('attributionRequired', e.target.checked)} />
      </div>
      {value.attributionRequired ? (
        <Field label={t('license.attributionText')}>
          {(p) => <Input {...p} maxLength={300} value={value.attributionText} onChange={(e) => set('attributionText', e.target.value)} />}
        </Field>
      ) : null}
      <Field label={t('license.expires')} hint={t('license.noExpiry')} className="max-w-56">
        {(p) => <Input {...p} type="date" value={value.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />}
      </Field>
    </fieldset>
  );
}

/** Compact licence facts for list rows. */
export function LicenseSummary({ license }: { license: License | null }) {
  if (!license) return <Badge tone="danger">{t('common.none')}</Badge>;
  const expired = license.expiresAt && new Date(license.expiresAt) <= new Date();
  return (
    <div className="space-y-1 text-xs">
      <p className="text-stone-700">{t('license.summary', { type: license.licenseType, provider: license.provider })}</p>
      <div className="flex flex-wrap gap-1">
        <Badge tone={license.commercialUse ? 'success' : 'danger'}>{t('license.commercial')}</Badge>
        <Badge tone={license.onDemandUse ? 'success' : 'danger'}>{t('license.onDemand')}</Badge>
        {license.attributionRequired ? <Badge tone="warning">{t('license.attribution')}</Badge> : null}
        {license.expiresAt ? <Badge tone={expired ? 'danger' : 'neutral'}>{t('license.expiresOn', { date: formatDate(license.expiresAt) })}</Badge> : null}
      </div>
    </div>
  );
}

export function licenseToForm(l: License): LicenseForm {
  return {
    licenseType: l.licenseType,
    provider: l.provider,
    source: l.source ?? '',
    purchaseReference: l.purchaseReference ?? '',
    commercialUse: l.commercialUse,
    onDemandUse: l.onDemandUse,
    socialMediaUse: l.socialMediaUse,
    attributionRequired: l.attributionRequired,
    attributionText: l.attributionText ?? '',
    expiresAt: toDateInput(l.expiresAt),
  };
}

/**
 * Correct a licence. The API moves anything the new terms no longer cover
 * back to review, so approvals always match the recorded licence.
 */
export function EditLicenseForm({ license, invalidateKey, onDone }: { license: License; invalidateKey: string[]; onDone: () => void }) {
  const invalidate = useInvalidate();
  const [value, setValue] = useState(() => licenseToForm(license));
  const save = useMutation({
    mutationFn: () => apiPut(`/admin/licenses/${license.id}`, licensePayload(value)),
    onSuccess: async () => {
      await invalidate(invalidateKey, ['admin', 'license-alerts']);
      onDone();
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {save.isError ? <Alert>{errorMessage(save.error, t('common.error'))}</Alert> : null}
      <LicenseFields value={value} onChange={setValue} />
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
