'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Upload, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { EditLicenseForm, EMPTY_LICENSE, LicenseFields, licensePayload, LicenseSummary, type LicenseForm } from '@/components/license-fields';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, statusTone, Table, Td, Th } from '@/components/ui';
import { apiGet, apiPost, errorMessage, uploadToStorage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { License, MusicTrack } from '@/lib/types';
import { formatDuration } from '@/lib/utils';

/** Track length from the file itself, read by the browser's media decoder. */
function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    audio.src = url;
  });
}

export default function MusicPage() {
  return (
    <RequirePermission permission="asset.manage">
      <MusicLibrary />
    </RequirePermission>
  );
}

function MusicLibrary() {
  const [uploading, setUploading] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const invalidate = useInvalidate();
  const music = useQuery({ queryKey: ['admin', 'music'], queryFn: () => apiGet<MusicTrack[]>('/admin/music') });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' | 'ARCHIVED' }) => apiPost(`/admin/music/${id}/review`, { status: decision }),
    onSuccess: () => invalidate(['admin', 'music']),
  });

  return (
    <>
      <PageHeader
        title={t('music.title')}
        subtitle={t('music.subtitle')}
        actions={
          <Button onClick={() => setUploading(true)}>
            <Upload className="size-4" /> {t('music.upload')}
          </Button>
        }
      />
      {review.isError ? <Alert className="mb-4">{errorMessage(review.error, t('common.error'))}</Alert> : null}
      {music.isPending ? <Spinner /> : null}
      {music.isError ? <ErrorNotice error={music.error} /> : null}
      {music.data && !music.data.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
      {music.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('music.trackTitle')}</Th>
              <Th>{t('music.duration')}</Th>
              <Th>{t('license.title')}</Th>
              <Th>{t('common.status')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {music.data.map((m) => (
              <tr key={m.id}>
                <Td>
                  <p className="font-medium text-stone-900">{m.title}</p>
                  <p className="text-xs text-stone-500">
                    {m.artist ?? t('common.none')} · {t(`music.collection.${m.collection}`)}
                  </p>
                  <audio src={m.previewUrl} controls preload="none" className="mt-2 h-8 w-64 max-w-full" />
                </Td>
                <Td className="tabular-nums">{formatDuration(m.durationSeconds)}</Td>
                <Td>
                  <LicenseSummary license={m.license} />
                </Td>
                <Td>
                  <Badge tone={statusTone(m.status)}>{t(`status.${m.status}`)}</Badge>
                </Td>
                <Td className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {m.status !== 'APPROVED' ? (
                      <Button size="sm" variant="success" disabled={review.isPending} onClick={() => review.mutate({ id: m.id, decision: 'APPROVED' })}>
                        <Check className="size-3.5" /> {t('common.approve')}
                      </Button>
                    ) : null}
                    {m.status === 'PENDING_REVIEW' ? (
                      <Button size="sm" variant="danger" disabled={review.isPending} onClick={() => review.mutate({ id: m.id, decision: 'REJECTED' })}>
                        <X className="size-3.5" /> {t('common.reject')}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setEditingLicense(m.license)}>
                      {t('license.edit')}
                    </Button>
                    {m.status !== 'ARCHIVED' ? (
                      <Button size="sm" variant="ghost" disabled={review.isPending} onClick={() => window.confirm(t('common.confirm')) && review.mutate({ id: m.id, decision: 'ARCHIVED' })}>
                        {t('common.archive')}
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}

      <Modal open={uploading} onClose={() => setUploading(false)} title={t('music.upload')} wide>
        <UploadMusicForm onDone={() => setUploading(false)} />
      </Modal>
      <Modal open={!!editingLicense} onClose={() => setEditingLicense(null)} title={t('license.edit')} wide>
        {editingLicense ? <EditLicenseForm license={editingLicense} invalidateKey={['admin', 'music']} onDone={() => setEditingLicense(null)} /> : null}
      </Modal>
    </>
  );
}

function UploadMusicForm({ onDone }: { onDone: () => void }) {
  const invalidate = useInvalidate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [collection, setCollection] = useState<'ORIGINAL' | 'LICENSED'>('LICENSED');
  const [license, setLicense] = useState<LicenseForm>(EMPTY_LICENSE);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !duration) throw new Error(t('common.error'));
      const storageKey = await uploadToStorage('music', file);
      return apiPost('/admin/music', {
        storageKey,
        title: title.trim(),
        ...(artist.trim() ? { artist: artist.trim() } : {}),
        durationSeconds: duration,
        collection,
        license: licensePayload(license),
      });
    },
    onSuccess: async () => {
      await invalidate(['admin', 'music']);
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
            accept="audio/mpeg,audio/mp4"
            className="py-2"
            onChange={async (e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) {
                if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 120));
                const seconds = await audioDuration(f);
                if (seconds) setDuration(seconds);
              }
            }}
          />
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('music.trackTitle')}>{(p) => <Input {...p} required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label={t('music.artist')}>{(p) => <Input {...p} maxLength={120} value={artist} onChange={(e) => setArtist(e.target.value)} />}</Field>
        <Field label={`${t('music.duration')} (s)`}>
          {(p) => <Input {...p} type="number" required min={1} max={1200} value={duration} onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')} />}
        </Field>
        <Field label={t('music.collection')}>
          {(p) => (
            <Select {...p} value={collection} onChange={(e) => setCollection(e.target.value as 'ORIGINAL' | 'LICENSED')}>
              <option value="LICENSED">{t('music.collection.LICENSED')}</option>
              <option value="ORIGINAL">{t('music.collection.ORIGINAL')}</option>
            </Select>
          )}
        </Field>
      </div>
      <LicenseFields value={license} onChange={setLicense} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={upload.isPending || !file}>
          <Upload className="size-4" /> {upload.isPending ? t('upload.uploading') : t('music.upload')}
        </Button>
      </div>
    </form>
  );
}
