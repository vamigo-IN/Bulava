'use client';

import type { SettingValues } from '@bulava/validation';
import { LinesField, SettingsCard, SettingsPage, TextAreaField, TextField, useGroupEditor } from '@/components/settings';
import { Alert, Checkbox } from '@/components/ui';
import { t, type AdminMessageKey } from '@/lib/i18n';
import type { SettingGroupView } from '@/lib/types';

type Tracking = SettingValues['tracking'];
type Code = SettingValues['code'];

const TRACKERS: Array<{ key: keyof Tracking; label: AdminMessageKey; placeholder: string }> = [
  { key: 'ga4Id', label: 'code.ga4', placeholder: 'G-XXXXXXXXXX' },
  { key: 'gtmId', label: 'code.gtm', placeholder: 'GTM-XXXXXXX' },
  { key: 'googleAdsId', label: 'code.googleAds', placeholder: 'AW-123456789' },
  { key: 'metaPixelId', label: 'code.metaPixel', placeholder: '123456789012345' },
  { key: 'clarityId', label: 'code.clarity', placeholder: 'abcd1234ef' },
  { key: 'linkedinPartnerId', label: 'code.linkedin', placeholder: '1234567' },
  { key: 'posthogKey', label: 'code.posthogKey', placeholder: 'phc_…' },
  { key: 'posthogHost', label: 'code.posthogHost', placeholder: 'https://eu.i.posthog.com' },
];

const SOURCES: Array<{ key: keyof Code['allowedSources']; label: AdminMessageKey }> = [
  { key: 'script', label: 'code.sources.script' },
  { key: 'connect', label: 'code.sources.connect' },
  { key: 'img', label: 'code.sources.img' },
  { key: 'frame', label: 'code.sources.frame' },
];

export default function TrackingCodePage() {
  return (
    <SettingsPage title={t('code.title')} subtitle={t('code.subtitle')}>
      {(overview) => (
        <>
          <TrackingForm view={overview.groups.tracking} />
          <CodeForm view={overview.groups.code} />
        </>
      )}
    </SettingsPage>
  );
}

function TrackingForm({ view }: { view: SettingGroupView }) {
  const editor = useGroupEditor<Tracking>('tracking', view);
  return (
    <SettingsCard title={t('code.trackers')} description={t('code.trackersHint')} view={view} editor={editor}>
      <div className="grid gap-4 sm:grid-cols-2">
        {TRACKERS.map((tracker) => (
          <TextField
            key={tracker.key}
            label={t(tracker.label)}
            placeholder={tracker.placeholder}
            spellCheck={false}
            className="[&_input]:font-mono"
            value={editor.draft[tracker.key]}
            onChange={(v) => editor.set(tracker.key, v)}
          />
        ))}
      </div>
    </SettingsCard>
  );
}

function CodeForm({ view }: { view: SettingGroupView }) {
  const editor = useGroupEditor<Code>('code', view);
  const { draft, set } = editor;
  const sources = draft.allowedSources ?? { script: [], connect: [], img: [], frame: [] };
  return (
    <SettingsCard title={t('code.injection')} view={view} editor={editor}>
      <Alert tone="warning">{t('code.injectionWarning')}</Alert>
      <Checkbox label={t('code.enabled')} checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} />
      <TextAreaField label={t('code.head')} mono rows={6} maxLength={20_000} value={draft.headHtml} onChange={(v) => set('headHtml', v)} />
      <TextAreaField label={t('code.body')} mono rows={6} maxLength={20_000} value={draft.bodyHtml} onChange={(v) => set('bodyHtml', v)} />
      <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('code.sources')}</h3>
      <p className="-mt-2 text-xs text-stone-500">{t('code.sourcesHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((s) => (
          <LinesField key={s.key} label={t(s.label)} placeholder="https://widget.example.com" value={sources[s.key]} onChange={(v) => set('allowedSources', { ...sources, [s.key]: v })} />
        ))}
      </div>
    </SettingsCard>
  );
}
