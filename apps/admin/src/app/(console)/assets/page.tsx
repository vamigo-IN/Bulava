'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, FileImage, Upload, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { EditLicenseForm, EMPTY_LICENSE, LicenseFields, licensePayload, LicenseSummary, type LicenseForm } from '@/components/license-fields';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, statusTone } from '@/components/ui';
import { apiGet, apiPost, errorMessage, uploadToStorage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Asset, AssetStatus, License } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

const ASSET_TYPES = ['IMAGE', 'SVG', 'VIDEO', 'AUDIO', 'FONT'] as const;
const STATUSES: AssetStatus[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'ARCHIVED'];
const ACCEPT = 'image/jpeg,image/png,image/webp,image/svg+xml,video/mp4,video/quicktime,audio/mpeg,audio/mp4,font/woff2';

function typeForMime(mime: string): (typeof ASSET_TYPES)[number] {
  if (mime === 'image/svg+xml') return 'SVG';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'FONT';
}

/** Read pixel size in the browser; the server stores it as metadata only. */
function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export default function AssetsPage() {
  return (
    <RequirePermission permission="asset.manage">
      <Assets />
    </RequirePermission>
  );
}

function Assets() {
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const invalidate = useInvalidate();
  const params = new URLSearchParams({ ...(status ? { status } : {}), ...(category ? { category } : {}) }).toString();
  const assets = useQuery({ queryKey: ['admin', 'assets', params], queryFn: () => apiGet<Asset[]>(`/admin/assets${params ? `?${params}` : ''}`) });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' | 'ARCHIVED' }) => apiPost(`/admin/assets/${id}/review`, { status: decision }),
    onSuccess: () => invalidate(['admin', 'assets']),
  });

  return (
    <>
      <PageHeader
        title={t('assets.title')}
        subtitle={t('assets.subtitle')}
        actions={
          <Button onClick={() => setUploading(true)}>
            <Upload className="size-4" /> {t('assets.upload')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label={t('assets.filterStatus')} value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">{`${t('common.status')}: ${t('common.all')}`}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Select>
        <Input placeholder={t('common.category')} aria-label={t('common.category')} value={category} onChange={(e) => setCategory(e.target.value)} className="max-w-56" />
      </div>
      {review.isError ? <Alert className="mb-4">{errorMessage(review.error, t('common.error'))}</Alert> : null}
      {assets.isPending ? <Spinner /> : null}
      {assets.isError ? <ErrorNotice error={assets.error} /> : null}
      {assets.data && !assets.data.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {assets.data?.map((a) => (
          <li key={a.id} className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="grid h-40 place-items-center bg-[repeating-conic-gradient(#f5f5f4_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
              {a.type === 'IMAGE' || a.type === 'SVG' ? (
                <img src={a.previewUrl} alt="" loading="lazy" className="max-h-40 max-w-full object-contain" />
              ) : a.type === 'VIDEO' ? (
                <video src={a.previewUrl} muted controls preload="metadata" className="max-h-40 max-w-full" />
              ) : a.type === 'AUDIO' ? (
                <audio src={a.previewUrl} controls preload="none" className="w-11/12" />
              ) : (
                <FileImage className="size-10 text-stone-300" aria-hidden />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-xs text-stone-500">
                    {t(`asset.${a.type}`)} · {a.category} · {formatBytes(a.sizeBytes)}
                    {a.width && a.height ? ` · ${t('assets.dimensions', { width: a.width, height: a.height })}` : ''}
                  </p>
                </div>
                <Badge tone={statusTone(a.status)}>{t(`status.${a.status}`)}</Badge>
              </div>
              <LicenseSummary license={a.license} />
              <p className="text-xs text-stone-500">{t('assets.usage', { count: a.usage })}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {a.status !== 'APPROVED' ? (
                  <Button size="sm" variant="success" disabled={review.isPending} onClick={() => review.mutate({ id: a.id, decision: 'APPROVED' })}>
                    <Check className="size-3.5" /> {t('common.approve')}
                  </Button>
                ) : null}
                {a.status === 'PENDING_REVIEW' ? (
                  <Button size="sm" variant="danger" disabled={review.isPending} onClick={() => review.mutate({ id: a.id, decision: 'REJECTED' })}>
                    <X className="size-3.5" /> {t('common.reject')}
                  </Button>
                ) : null}
                {a.license ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditingLicense(a.license)}>
                    {t('license.edit')}
                  </Button>
                ) : null}
                {a.status !== 'ARCHIVED' ? (
                  <Button size="sm" variant="ghost" disabled={review.isPending} onClick={() => window.confirm(t('common.confirm')) && review.mutate({ id: a.id, decision: 'ARCHIVED' })}>
                    {t('common.archive')}
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={uploading} onClose={() => setUploading(false)} title={t('assets.upload')} wide>
        <UploadAssetForm onDone={() => setUploading(false)} />
      </Modal>
      <Modal open={!!editingLicense} onClose={() => setEditingLicense(null)} title={t('license.edit')} wide>
        {editingLicense ? <EditLicenseForm license={editingLicense} invalidateKey={['admin', 'assets']} onDone={() => setEditingLicense(null)} /> : null}
      </Modal>
    </>
  );
}

function UploadAssetForm({ onDone }: { onDone: () => void }) {
  const invalidate = useInvalidate();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof ASSET_TYPES)[number]>('IMAGE');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [license, setLicense] = useState<LicenseForm>(EMPTY_LICENSE);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t('common.error'));
      const [storageKey, size] = await Promise.all([uploadToStorage('asset', file), imageSize(file)]);
      return apiPost('/admin/assets', {
        storageKey,
        name: name.trim(),
        type,
        category: category.trim(),
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        ...(size ?? {}),
        license: licensePayload(license),
      });
    },
    onSuccess: async () => {
      await invalidate(['admin', 'assets']);
      onDone();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    upload.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {upload.isError ? <Alert>{errorMessage(upload.error, upload.error instanceof Error ? upload.error.message : t('common.error'))}</Alert> : null}
      <Field label={t('assets.file')}>
        {(p) => (
          <Input
            {...p}
            type="file"
            required
            accept={ACCEPT}
            className="py-2"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) {
                setType(typeForMime(f.type));
                if (!name) setName(f.name.replace(/\.[^.]+$/, '').slice(0, 120));
              }
            }}
          />
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('common.name')}>{(p) => <Input {...p} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label={t('common.type')}>
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as (typeof ASSET_TYPES)[number])}>
              {ASSET_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t(`asset.${v}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('common.category')}>{(p) => <Input {...p} required maxLength={60} value={category} onChange={(e) => setCategory(e.target.value)} />}</Field>
      </div>
      <Field label={t('assets.tags')} hint={t('details.tagsHint')}>
        {(p) => <Input {...p} value={tags} onChange={(e) => setTags(e.target.value)} />}
      </Field>
      <LicenseFields value={license} onChange={setLicense} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={upload.isPending || !file}>
          <Upload className="size-4" /> {upload.isPending ? t('upload.uploading') : t('assets.upload')}
        </Button>
      </div>
    </form>
  );
}
