'use client';

import { ExternalLink } from 'lucide-react';
import { AI_CRAWLERS, type SettingValues } from '@bulava/validation';
import { LinesField, SettingsCard, SettingsPage, TextAreaField, TextField, useGroupEditor } from '@/components/settings';
import { Alert, Button, Checkbox, Select, Table, Td, Th } from '@/components/ui';
import { t, type AdminMessageKey } from '@/lib/i18n';
import type { SettingGroupView } from '@/lib/types';

type Seo = SettingValues['seo'];
type Rule = 'allow' | 'block';

const VERIFY: Array<{ key: keyof Seo['verification']; label: AdminMessageKey }> = [
  { key: 'google', label: 'seo.verify.google' },
  { key: 'bing', label: 'seo.verify.bing' },
  { key: 'yandex', label: 'seo.verify.yandex' },
  { key: 'pinterest', label: 'seo.verify.pinterest' },
  { key: 'facebook', label: 'seo.verify.facebook' },
];

export default function SeoPage() {
  return (
    <SettingsPage title={t('seo.title')} subtitle={t('seo.subtitle')}>
      {(overview) => <SeoForm view={overview.groups.seo} origin={overview.origins.web} />}
    </SettingsPage>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={value.length > max ? 'text-red-700' : 'text-stone-400'}>{t('seo.chars', { count: value.length, max })}</span>;
}

function SeoForm({ view, origin }: { view: SettingGroupView; origin: string }) {
  const editor = useGroupEditor<Seo>('seo', view);
  const { draft, set } = editor;
  const verification = draft.verification ?? {};
  const org = draft.organization ?? {};
  const rules = (draft.aiCrawlers ?? {}) as Record<string, Rule>;
  const host = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const setAll = (rule: (purpose: string) => Rule) => set('aiCrawlers', Object.fromEntries(AI_CRAWLERS.map((c) => [c.id, rule(c.purpose)])));

  return (
    <>
      <SettingsCard title={t('seo.appearance')} view={view} editor={editor}>
        <TextField label={t('seo.siteTitle')} value={draft.title} maxLength={70} required onChange={(v) => set('title', v)} />
        <p className="-mt-3 text-right text-xs">
          <Counter value={draft.title ?? ''} max={60} />
        </p>
        <TextField label={t('seo.titleTemplate')} hint={t('seo.titleTemplateHint')} value={draft.titleTemplate} maxLength={40} onChange={(v) => set('titleTemplate', v)} />
        <TextAreaField label={t('seo.description')} rows={3} maxLength={200} value={draft.description} onChange={(v) => set('description', v)} />
        <p className="-mt-3 text-right text-xs">
          <Counter value={draft.description ?? ''} max={160} />
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('seo.keywords')}
            hint={t('seo.keywordsHint')}
            value={(draft.keywords ?? []).join(', ')}
            onChange={(v) =>
              set(
                'keywords',
                v
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean),
              )
            }
          />
          <TextField label={t('seo.twitter')} placeholder="@bulava" value={draft.twitterHandle} onChange={(v) => set('twitterHandle', v)} />
        </div>

        <div className="rounded-lg border border-stone-200 p-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('seo.preview')}</p>
          <p className="truncate text-xs text-stone-600">{host}</p>
          <p className="truncate text-lg text-[#1a0dab]">{draft.title}</p>
          <p className="line-clamp-2 text-sm text-stone-700">{draft.description}</p>
        </div>

        <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('seo.indexing')}</h3>
        <Checkbox label={t('seo.indexingOn')} checked={draft.indexing} onChange={(e) => set('indexing', e.target.checked)} />
        {!draft.indexing ? <Alert tone="warning">{t('seo.indexingOff')}</Alert> : null}
        <LinesField label={t('seo.disallow')} hint={t('seo.disallowHint')} placeholder="/about/team" value={draft.robotsDisallow} onChange={(v) => set('robotsDisallow', v)} />

        <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('seo.verification')}</h3>
        <p className="-mt-2 text-xs text-stone-500">{t('seo.verificationHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {VERIFY.map((v) => (
            <TextField key={v.key} label={t(v.label)} className="font-mono" value={verification[v.key]} onChange={(value) => set('verification', { ...verification, [v.key]: value })} />
          ))}
        </div>

        <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('seo.organization')}</h3>
        <p className="-mt-2 text-xs text-stone-500">{t('seo.organizationHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('seo.legalName')} value={org.legalName} onChange={(v) => set('organization', { ...org, legalName: v })} />
          <TextField label={t('seo.foundingYear')} type="number" min={1900} max={2100} value={org.foundingYear ?? ''} onChange={(v) => set('organization', { ...org, foundingYear: v === '' ? undefined : Number(v) })} />
          <TextField label={t('seo.orgEmail')} type="email" value={org.email} onChange={(v) => set('organization', { ...org, email: v })} />
          <TextField label={t('seo.orgPhone')} type="tel" placeholder="+91…" value={org.phone} onChange={(v) => set('organization', { ...org, phone: v })} />
          <TextField className="sm:col-span-2" label={t('seo.address')} hint={t('seo.addressHint')} value={org.address} onChange={(v) => set('organization', { ...org, address: v })} />
          <TextField className="sm:col-span-2" label={t('seo.grievanceOfficer')} hint={t('seo.grievanceOfficerHint')} maxLength={120} value={org.grievanceOfficer} onChange={(v) => set('organization', { ...org, grievanceOfficer: v })} />
        </div>

        <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('seo.ai')}</h3>
        <p className="-mt-2 text-xs text-stone-500">{t('seo.aiHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAll(() => 'allow')}>
            {t('seo.aiAllowAll')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAll((purpose) => (purpose === 'training' ? 'block' : 'allow'))}>
            {t('seo.aiBlockTraining')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAll(() => 'block')}>
            {t('seo.aiBlockAll')}
          </Button>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{t('seo.bot')}</Th>
              <Th>{t('seo.owner')}</Th>
              <Th>{t('seo.purpose')}</Th>
              <Th className="w-36" />
            </tr>
          </thead>
          <tbody>
            {AI_CRAWLERS.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono text-xs">{c.id}</Td>
                <Td>{c.owner}</Td>
                <Td>{t(`seo.aiPurpose.${c.purpose}`)}</Td>
                <Td>
                  <Select
                    aria-label={c.id}
                    value={rules[c.id] ?? 'allow'}
                    className="min-h-8 py-0 text-xs"
                    onChange={(e) => set('aiCrawlers', { ...rules, [c.id]: e.target.value as Rule })}
                  >
                    <option value="allow">{t('seo.allow')}</option>
                    <option value="block">{t('seo.block')}</option>
                  </Select>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('seo.llms')}</h3>
        <TextAreaField label={t('seo.llms')} hint={t('seo.llmsHint')} mono rows={8} maxLength={20_000} value={draft.llmsTxt} onChange={(v) => set('llmsTxt', v)} />
        <p className="flex flex-wrap gap-4 text-sm">
          {['robots.txt', 'sitemap.xml', 'llms.txt'].map((file) => (
            <a key={file} href={`${origin.replace(/\/$/, '')}/${file}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 underline underline-offset-2">
              {t('seo.view', { file })} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ))}
        </p>
      </SettingsCard>
    </>
  );
}
