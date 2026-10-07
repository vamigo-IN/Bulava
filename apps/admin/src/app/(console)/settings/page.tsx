'use client';

import { useMutation } from '@tanstack/react-query';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { SettingValues } from '@bulava/validation';
import { SettingsCard, SettingsPage, TextAreaField, TextField, useGroupEditor } from '@/components/settings';
import { useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Card, Checkbox, Field, Input } from '@/components/ui';
import { ApiError, apiDelete, apiPost, errorMessage } from '@/lib/api';
import { t, type AdminMessageKey } from '@/lib/i18n';
import type { SettingGroupView, SettingsOverview } from '@/lib/types';

type Site = SettingValues['site'];
type AssetKind = 'logo' | 'favicon' | 'ogImage';

const ASSETS: Array<{ kind: AssetKind; label: AdminMessageKey; hint: AdminMessageKey; accept: string; preview: string }> = [
  { kind: 'logo', label: 'site.logo', hint: 'site.logoHint', accept: 'image/png,image/svg+xml,image/webp', preview: 'h-16 w-full object-contain' },
  { kind: 'favicon', label: 'site.favicon', hint: 'site.faviconHint', accept: 'image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico', preview: 'size-16 object-contain' },
  { kind: 'ogImage', label: 'site.ogImage', hint: 'site.ogImageHint', accept: 'image/png,image/jpeg,image/webp', preview: 'aspect-[1200/630] w-full object-cover' },
];

const SOCIAL = ['instagram', 'facebook', 'youtube', 'x', 'linkedin', 'pinterest'] as const;
const SOCIAL_LABEL: Record<(typeof SOCIAL)[number], string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', x: 'X (Twitter)', linkedin: 'LinkedIn', pinterest: 'Pinterest' };

export default function BrandingPage() {
  return (
    <SettingsPage title={t('site.title')} subtitle={t('site.subtitle')}>
      {(overview) => (
        <>
          <SiteAssets overview={overview} />
          <SiteForm view={overview.groups.site} />
        </>
      )}
    </SettingsPage>
  );
}

function SiteForm({ view }: { view: SettingGroupView }) {
  // Logo, favicon and share image are saved by their uploads, not by this form.
  const editor = useGroupEditor<Site>('site', view, { ignoreKeys: ['logoKey', 'faviconKey', 'ogImageKey'] });
  const { draft, set } = editor;
  const announcement = draft.announcement ?? { enabled: false, text: '', linkText: '' };
  const social = draft.social ?? {};
  const footer = draft.footer ?? { eyebrow: '', about: '', copyright: '', note: '' };
  return (
    <SettingsCard title={t('site.brand')} view={view} editor={editor}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('site.name')} hint={t('site.nameHint')} value={draft.name} maxLength={60} required onChange={(v) => set('name', v)} />
        <TextField label={t('site.tagline')} value={draft.tagline} maxLength={120} onChange={(v) => set('tagline', v)} />
        <Field label={t('site.themeColor')} hint={t('site.themeColorHint')}>
          {(p) => (
            <div className="flex items-center gap-2">
              <input type="color" aria-label={t('site.themeColor')} value={draft.themeColor} onChange={(e) => set('themeColor', e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-stone-300 bg-white p-1" />
              <Input {...p} value={draft.themeColor} maxLength={7} className="max-w-32 font-mono" onChange={(e) => set('themeColor', e.target.value)} />
            </div>
          )}
        </Field>
      </div>

      <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('site.contact')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('site.supportEmail')} type="email" value={draft.supportEmail} onChange={(v) => set('supportEmail', v)} />
        <TextField label={t('site.supportPhone')} type="tel" placeholder="+91…" value={draft.supportPhone} onChange={(v) => set('supportPhone', v)} />
        <TextField label={t('site.whatsappNumber')} hint={t('site.whatsappNumberHint')} type="tel" placeholder="+91…" value={draft.whatsappNumber} onChange={(v) => set('whatsappNumber', v)} />
        <TextField label={t('site.whatsappMessage')} value={draft.whatsappMessage} maxLength={200} onChange={(v) => set('whatsappMessage', v)} />
      </div>

      <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('site.announcement')}</h3>
      <Checkbox label={t('site.announcementEnabled')} checked={announcement.enabled} onChange={(e) => set('announcement', { ...announcement, enabled: e.target.checked })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField className="sm:col-span-3" label={t('site.announcementText')} maxLength={160} value={announcement.text} onChange={(v) => set('announcement', { ...announcement, text: v })} />
        <TextField className="sm:col-span-2" label={t('site.announcementLink')} hint={t('site.announcementLinkHint')} value={announcement.link} onChange={(v) => set('announcement', { ...announcement, link: v })} />
        <TextField label={t('site.announcementLinkText')} maxLength={40} value={announcement.linkText} onChange={(v) => set('announcement', { ...announcement, linkText: v })} />
      </div>

      <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('site.social')}</h3>
      <p className="-mt-2 text-xs text-stone-500">{t('site.socialHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {SOCIAL.map((key) => (
          <TextField key={key} label={SOCIAL_LABEL[key]} type="url" placeholder="https://" value={social[key]} onChange={(v) => set('social', { ...social, [key]: v })} />
        ))}
      </div>

      <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('site.footer')}</h3>
      <p className="-mt-2 text-xs text-stone-500">{t('site.footerHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('site.footerEyebrow')} maxLength={60} value={footer.eyebrow} onChange={(v) => set('footer', { ...footer, eyebrow: v })} />
        <TextField label={t('site.footerCopyright')} hint={t('site.footerCopyrightHint')} maxLength={200} value={footer.copyright} onChange={(v) => set('footer', { ...footer, copyright: v })} />
        <TextAreaField className="sm:col-span-2" label={t('site.footerAbout')} rows={2} maxLength={300} value={footer.about} onChange={(v) => set('footer', { ...footer, about: v })} />
        <TextField className="sm:col-span-2" label={t('site.footerNote')} hint={t('site.footerNoteHint')} maxLength={300} value={footer.note} onChange={(v) => set('footer', { ...footer, note: v })} />
      </div>
    </SettingsCard>
  );
}

/** Uploads go straight to storage with a signed URL; the API checks the stored file before using it. */
function SiteAssets({ overview }: { overview: SettingsOverview }) {
  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-stone-900">{t('site.assets')}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {ASSETS.map((asset) => (
          <AssetTile key={asset.kind} {...asset} previewUrl={overview.assetPreviews[asset.kind]} />
        ))}
      </div>
    </Card>
  );
}

function AssetTile({ kind, label, hint, accept, preview, previewUrl }: (typeof ASSETS)[number] & { previewUrl: string | null }) {
  const invalidate = useInvalidate();
  const input = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const signed = await apiPost<{ storageKey: string; uploadUrl: string; headers: Record<string, string> }>('/admin/settings/site-assets', {
        kind,
        contentType: file.type || (file.name.endsWith('.ico') ? 'image/x-icon' : ''),
        sizeBytes: file.size,
      });
      const put = await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: signed.headers });
      if (!put.ok) throw new ApiError('UPLOAD_FAILED', `Upload failed (${put.status}).`, put.status);
      return apiPost<{ previewUrl: string }>('/admin/settings/site-assets/complete', { kind, storageKey: signed.storageKey });
    },
    onSuccess: async (r) => {
      setLocal(r.previewUrl);
      await invalidate(['admin', 'settings']);
    },
  });
  const remove = useMutation({
    mutationFn: () => apiDelete(`/admin/settings/site-assets/${kind}`),
    onSuccess: async () => {
      setLocal(null);
      await invalidate(['admin', 'settings']);
    },
  });
  const src = local ?? previewUrl;
  const busy = upload.isPending || remove.isPending;
  return (
    <div className="flex flex-col rounded-lg border border-stone-200 p-3">
      <p className="text-sm font-semibold text-stone-800">{t(label)}</p>
      <div className="my-3 grid min-h-24 place-items-center rounded-md bg-[repeating-conic-gradient(#f5f5f4_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2">
        {src ? <img src={src} alt={t(label)} className={preview} /> : <Badge>{t('site.defaultAsset')}</Badge>}
      </div>
      <p className="mb-3 text-xs text-stone-500">{t(hint)}</p>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={t(label)}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload.mutate(file);
        }}
      />
      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
          <ImageUp className="size-3.5" aria-hidden /> {upload.isPending ? t('site.uploading') : src ? t('site.replace') : t('site.upload')}
        </Button>
        {src ? (
          <Button size="sm" variant="ghost" className="text-red-700" disabled={busy} onClick={() => window.confirm(t('site.confirmRemove')) && remove.mutate()}>
            <Trash2 className="size-3.5" aria-hidden /> {t('site.remove')}
          </Button>
        ) : null}
      </div>
      {upload.isError ? <Alert className="mt-3">{errorMessage(upload.error, t('common.error'))}</Alert> : null}
      {remove.isError ? <Alert className="mt-3">{errorMessage(remove.error, t('common.error'))}</Alert> : null}
    </div>
  );
}
