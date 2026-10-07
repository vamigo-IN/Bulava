'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, Upload } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { EMPTY_LICENSE, LicenseFields, licensePayload, type LicenseForm } from '@/components/license-fields';
import { useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Field, Input, Modal, Spinner, statusTone } from '@/components/ui';
import { apiGet, apiPost, errorMessage, uploadToStorage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Asset } from '@/lib/types';

function imageSize(file: File): Promise<{ width: number; height: number } | null> {
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

/**
 * Pick a licensed image from the library, or upload one (with its licence)
 * and use it straight away. Images awaiting approval can be placed, but the
 * template cannot be published until they are approved.
 */
export function AssetPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (asset: Asset) => void }) {
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const assets = useQuery({ queryKey: ['admin', 'assets', 'type=IMAGE'], queryFn: () => apiGet<Asset[]>('/admin/assets'), enabled: open });
  const q = query.trim().toLowerCase();
  const images = (assets.data ?? [])
    .filter((a) => a.type === 'IMAGE' && a.status !== 'REJECTED' && a.status !== 'ARCHIVED')
    .filter((a) => !q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.tags.some((tag) => tag.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.status === 'APPROVED') - Number(a.status === 'APPROVED') || b.createdAt.localeCompare(a.createdAt));

  return (
    <Modal open={open} onClose={onClose} title={t('canvas.assets.title')} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <Input aria-label={t('canvas.assets.search')} placeholder={t('canvas.assets.search')} className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant={uploading ? 'primary' : 'secondary'} onClick={() => setUploading((u) => !u)} aria-expanded={uploading}>
          <Upload className="size-4" /> {t('canvas.assets.upload')}
        </Button>
      </div>
      {uploading ? (
        <UploadForm
          onDone={(asset) => {
            setUploading(false);
            onPick(asset);
          }}
        />
      ) : null}
      {assets.isPending ? <Spinner /> : null}
      {assets.isError ? <Alert>{errorMessage(assets.error, t('common.error'))}</Alert> : null}
      {assets.isSuccess && !images.length ? <p className="py-6 text-center text-sm text-stone-500">{t('canvas.assets.empty')}</p> : null}
      <ul className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-auto p-0.5 sm:grid-cols-3 md:grid-cols-4">
        {images.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => onPick(a)} className="group flex w-full flex-col overflow-hidden rounded-lg border border-stone-200 bg-white text-left hover:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none" aria-label={`${t('canvas.assets.use')}: ${a.name}`}>
              <span className="grid h-28 w-full place-items-center bg-[repeating-conic-gradient(#f5f5f4_0%_25%,#fff_0%_50%)] bg-[length:12px_12px]">
                <img src={a.previewUrl} alt="" loading="lazy" className="max-h-28 max-w-full object-contain" />
              </span>
              <span className="flex items-start justify-between gap-1 p-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{a.name}</span>
                  <span className="block truncate text-[11px] text-stone-500">
                    {a.category}
                    {a.width && a.height ? ` · ${a.width}×${a.height}` : ''}
                  </span>
                </span>
                {a.status !== 'APPROVED' ? (
                  <Badge tone={statusTone(a.status)} className="shrink-0" title={t('canvas.assets.pending')}>
                    {t(`status.${a.status}`)}
                  </Badge>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function UploadForm({ onDone }: { onDone: (asset: Asset) => void }) {
  const invalidate = useInvalidate();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('canvas');
  const [tags, setTags] = useState('');
  const [license, setLicense] = useState<LicenseForm>(EMPTY_LICENSE);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t('common.error'));
      const [storageKey, size] = await Promise.all([uploadToStorage('asset', file), imageSize(file)]);
      return apiPost<Asset>('/admin/assets', {
        storageKey,
        name: name.trim(),
        type: 'IMAGE',
        category: category.trim(),
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        ...(size ?? {}),
        license: licensePayload(license),
      });
    },
    onSuccess: async (asset) => {
      await invalidate(['admin', 'assets']);
      onDone(asset);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    upload.mutate();
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      {upload.isError ? <Alert>{errorMessage(upload.error, upload.error instanceof Error ? upload.error.message : t('common.error'))}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('assets.file')}>
          {(p) => (
            <Input
              {...p}
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="py-2"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !name) setName(f.name.replace(/\.[^.]+$/, '').slice(0, 120));
              }}
            />
          )}
        </Field>
        <Field label={t('common.name')}>{(p) => <Input {...p} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label={t('common.category')}>{(p) => <Input {...p} required maxLength={60} value={category} onChange={(e) => setCategory(e.target.value)} />}</Field>
        <Field label={t('assets.tags')} hint={t('details.tagsHint')}>
          {(p) => <Input {...p} value={tags} onChange={(e) => setTags(e.target.value)} />}
        </Field>
      </div>
      <LicenseFields value={license} onChange={setLicense} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={upload.isPending || !file}>
          <Upload className="size-3.5" /> {upload.isPending ? t('upload.uploading') : t('assets.upload')}
        </Button>
      </div>
    </form>
  );
}
