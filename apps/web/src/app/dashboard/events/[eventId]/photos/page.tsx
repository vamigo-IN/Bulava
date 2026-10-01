'use client';

import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Copy,
  Folder,
  FolderOpen,
  FolderPlus,
  Hourglass,
  ImageUp,
  Pencil,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { LiveWallControls } from '@/components/events/live-wall-controls';
import { putWithProgress } from '@/components/photos/upload-room';
import { errorMessage, useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { useAlbum, useAlbumItems, useEvent, useInvalidateEvent } from '@/lib/queries';
import type { EventAlbum, SubAlbum } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Select, Spinner } from '@/components/ui/primitives';

const VISIBILITY = ['INVITE_ONLY', 'FUNCTION_RESTRICTED', 'PUBLIC', 'PRIVATE'] as const;
const MODERATION = ['AUTO_APPROVE', 'MANUAL_APPROVAL'] as const;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

/** The folder a photographer most likely wants: the function happening today, else General. */
function suggestedFolder(albums: SubAlbum[]): string {
  const now = Date.now();
  let best: { id: string; distance: number } | null = null;
  for (const a of albums) {
    if (!a.functionStartsAt) continue;
    const distance = Math.abs(new Date(a.functionStartsAt).getTime() - now);
    if (distance <= 86_400_000 && (!best || distance < best.distance)) best = { id: a.id, distance };
  }
  return best?.id ?? albums.find((a) => a.kind === 'GENERAL')?.id ?? albums[0]?.id ?? '';
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      {copied ? t('common.copied') : label}
    </Button>
  );
}

/** The album's one QR code and links, and (for photo managers) its settings and live wall. */
function AlbumCard({ eventId, album, canModerate, onChanged }: { eventId: string; album: EventAlbum; canModerate: boolean; onChanged: () => Promise<unknown> }) {
  const t = useT();
  const save = (patch: Record<string, unknown>) => apiPatch(`/events/${eventId}/album`, patch).then(onChanged);
  return (
    <Card className="rounded-3xl">
      <div className="flex flex-wrap gap-6">
        {album.qrCode ? (
          <img src={`/api/v1/events/${eventId}/album/qr.svg`} alt={t('photos.qr')} width={128} height={128} className="size-32 rounded-2xl border border-gold-200 bg-white p-1.5" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl">{album.name}</h3>
            <Badge>{t(album.itemCount === 1 ? 'album.countOne' : 'album.count', { count: album.itemCount })}</Badge>
            <Badge tone={album.uploadsEnabled ? 'success' : 'neutral'}>{t('photos.uploadsOpen')}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {album.uploadUrl ? (
              <div className="rounded-2xl border border-gold-200/80 bg-ivory/60 p-3">
                <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{t('album.uploadLink')}</p>
                <p className="mt-1 truncate font-mono text-sm" title={album.uploadUrl}>
                  {album.uploadUrl}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyButton text={album.uploadUrl} label={t('album.copyUpload')} />
                  <Button size="sm" variant="ghost" onClick={() => window.open(`/api/v1/events/${eventId}/album/qr.svg`, '_blank', 'noopener')?.focus()}>
                    <Printer aria-hidden className="size-4" />
                    {t('photos.printQr')}
                  </Button>
                </div>
              </div>
            ) : null}
            {album.galleryUrl ? (
              <div className="rounded-2xl border border-gold-200/80 bg-ivory/60 p-3">
                <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{t('album.galleryLink')}</p>
                <p className="mt-1 truncate font-mono text-sm" title={album.galleryUrl}>
                  {album.galleryUrl}
                </p>
                <div className="mt-2">
                  <CopyButton text={album.galleryUrl} label={t('album.copyGallery')} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {canModerate ? (
        <div className="mt-6 grid gap-5 border-t border-gold-100 pt-5 lg:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-display text-xl">{t('album.settings')}</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('photos.visibility')}>
                {(p) => (
                  <Select {...p} value={album.galleryVisibility} onChange={(e) => void save({ galleryVisibility: e.target.value })}>
                    {VISIBILITY.map((v) => (
                      <option key={v} value={v}>
                        {t(`photos.visibility.${v}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('photos.moderation')}>
                {(p) => (
                  <Select {...p} value={album.moderationMode === 'AI_ASSISTED' ? 'MANUAL_APPROVAL' : album.moderationMode} onChange={(e) => void save({ moderationMode: e.target.value })}>
                    {MODERATION.map((v) => (
                      <option key={v} value={v}>
                        {t(`photos.moderation.${v}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-6">
              <Checkbox label={t('photos.uploadsOpen')} checked={album.uploadsEnabled} onChange={(e) => void save({ uploadsEnabled: e.target.checked })} />
              <Checkbox label={t('photos.downloads')} checked={album.downloadPolicy.guestsCanDownload} onChange={(e) => void save({ guestsCanDownload: e.target.checked })} />
              <Checkbox label={t('photos.original')} checked={album.downloadPolicy.originalQuality} onChange={(e) => void save({ originalQuality: e.target.checked })} />
            </div>
          </div>
          <LiveWallControls eventId={eventId} room={album} onChanged={onChanged} />
        </div>
      ) : null}
    </Card>
  );
}

interface Upload {
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'failed';
  error?: string;
}

/** Photographers (and anyone with media.upload) upload straight into a folder; their photos need no approval. */
function TeamUploader({ eventId, album, onUploaded }: { eventId: string; album: EventAlbum; onUploaded: () => Promise<unknown> }) {
  const t = useT();
  const [folder, setFolder] = useState(() => suggestedFolder(album.albums));
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const update = (i: number, patch: Partial<Upload>) => setUploads((u) => u.map((x, n) => (n === i ? { ...x, ...patch } : x)));

  const start = async () => {
    setBusy(true);
    for (let i = 0; i < uploads.length; i++) {
      const u = uploads[i]!;
      if (u.status !== 'queued' && u.status !== 'failed') continue;
      update(i, { status: 'uploading', progress: 0, error: undefined });
      try {
        const ticket = await apiPost<{ itemId: string; uploadUrl: string }>(`/events/${eventId}/album/uploads`, {
          albumId: folder,
          fileName: u.file.name.slice(0, 200),
          contentType: u.file.type,
          sizeBytes: u.file.size,
        });
        await putWithProgress(ticket.uploadUrl, u.file, (p) => update(i, { progress: p }));
        await apiPost(`/events/${eventId}/album/uploads/${ticket.itemId}/complete`, {});
        update(i, { status: 'done', progress: 100 });
      } catch (err) {
        update(i, { status: 'failed', error: errorMessage(t, err) });
      }
    }
    setBusy(false);
    await onUploaded();
  };

  const done = uploads.filter((u) => u.status === 'done').length;
  const failed = uploads.filter((u) => u.status === 'failed').length;
  const pending = uploads.filter((u) => u.status === 'queued' || u.status === 'failed').length;

  return (
    <Card className="rounded-3xl">
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-gold-200">
          <ImageUp className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl">{t('album.upload')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field label={t('album.uploadTo')}>
              {(p) => (
                <Select {...p} value={folder} onChange={(e) => setFolder(e.target.value)} disabled={busy}>
                  {album.albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <input
              ref={pick}
              type="file"
              accept={ACCEPT.join(',')}
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).filter((f) => ACCEPT.includes(f.type));
                setUploads((u) => [...u.filter((x) => x.status !== 'done'), ...files.map((file) => ({ file, progress: 0, status: 'queued' as const }))]);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" onClick={() => pick.current?.click()} disabled={busy}>
              {t('album.choose')}
            </Button>
          </div>
          {uploads.length ? (
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {uploads.map((u, i) => (
                <li key={`${u.file.name}-${i}`} className="rounded-xl bg-sand/60 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{u.file.name}</span>
                    <span className="shrink-0 text-xs text-stone-500">{u.status === 'done' ? <Check aria-hidden className="size-4 text-emerald-700" /> : u.status === 'failed' ? '!' : `${u.progress}%`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                    <div className={cn('h-full rounded-full', u.status === 'failed' ? 'bg-red-500' : 'bg-brand-700')} style={{ width: `${u.progress}%` }} />
                  </div>
                  {u.error ? <p className="mt-1 text-xs text-red-700">{u.error}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {busy ? <p className="mt-3 text-sm text-stone-600">{t('album.uploading', { done, total: uploads.length })}</p> : null}
          {!busy && done > 0 ? (
            <div className="mt-3">
              <Alert tone="success">{t('album.uploaded', { count: done })}</Alert>
            </div>
          ) : null}
          {!busy && failed > 0 ? <p className="mt-2 text-sm text-red-700">{t('album.uploadFailed', { count: failed })}</p> : null}
          <Button className="mt-4" disabled={busy || pending === 0 || !folder} onClick={start}>
            {pending ? t('album.uploadSubmit', { count: pending }) : t('album.upload')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** A folder's photos, with approve, reject, move and delete for those allowed to. */
function FolderItems({ eventId, folder, folders, canModerate, canDelete }: { eventId: string; folder: SubAlbum; folders: SubAlbum[]; canModerate: boolean; canDelete: boolean }) {
  const t = useT();
  const items = useAlbumItems(eventId, folder.id);
  const invalidate = useInvalidateEvent(eventId);
  const [moving, setMoving] = useState<string | null>(null);
  const act = (fn: () => Promise<unknown>) => fn().then(invalidate);
  if (items.isPending) return <Spinner label={t('common.loading')} />;
  if (items.isError) return <Alert>{errorMessage(t, items.error)}</Alert>;
  if (!items.data?.length) return <EmptyState>{t('album.empty')}</EmptyState>;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
      {items.data.map((item) => (
        <li key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-sand">
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt={item.uploaderName ?? ''} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-500">{item.kind === 'video' ? <Clapperboard aria-hidden className="size-5 text-stone-400" /> : '…'}</div>
          )}
          {item.status === 'PROCESSING' ? (
            <span className="absolute top-1 left-1 grid size-6 place-items-center rounded-full bg-white/90">
              <Hourglass aria-hidden className="size-3.5 text-stone-600" />
            </span>
          ) : null}
          {item.status === 'PENDING_MODERATION' && canModerate ? (
            <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/60 p-1">
              <button type="button" className="flex-1 rounded bg-emerald-700 py-1 text-xs text-white" onClick={() => act(() => apiPost(`/events/${eventId}/media/${item.id}/moderate`, { decision: 'APPROVE' }))}>
                {t('photos.approve')}
              </button>
              <button type="button" className="flex-1 rounded bg-stone-700 py-1 text-xs text-white" onClick={() => act(() => apiPost(`/events/${eventId}/media/${item.id}/moderate`, { decision: 'REJECT' }))}>
                {t('photos.reject')}
              </button>
            </div>
          ) : null}
          {item.status !== 'PENDING_MODERATION' && (canModerate || canDelete) ? (
            <div className="absolute top-1 right-1 hidden gap-1 group-focus-within:flex group-hover:flex">
              {canModerate ? (
                <button type="button" aria-label={t('album.moveTo')} title={t('album.moveTo')} className="grid size-7 place-items-center rounded-full bg-black/60 text-white" onClick={() => setMoving(moving === item.id ? null : item.id)}>
                  <ArrowRightLeft aria-hidden className="size-3.5" />
                </button>
              ) : null}
              {canDelete ? (
                <button type="button" aria-label={t('common.delete')} title={t('common.delete')} className="grid size-7 place-items-center rounded-full bg-black/60 text-white" onClick={() => act(() => apiDelete(`/events/${eventId}/media/${item.id}`))}>
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          {moving === item.id ? (
            <div className="absolute inset-x-1 bottom-1 rounded-lg bg-white p-1 shadow-lift">
              <label className="sr-only" htmlFor={`move-${item.id}`}>
                {t('album.moveTo')}
              </label>
              <select
                id={`move-${item.id}`}
                className="w-full rounded-md border border-stone-300 bg-white px-1 py-1 text-xs"
                defaultValue=""
                onChange={(e) => e.target.value && void act(() => apiPost(`/events/${eventId}/media/${item.id}/move`, { albumId: e.target.value })).then(() => setMoving(null))}
              >
                <option value="" disabled>
                  {t('album.moveTo')}
                </option>
                {folders
                  .filter((f) => f.id !== folder.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** One folder: counts, the gallery and live-wall switches, rename/remove for added folders, and its photos. */
function FolderCard({
  eventId,
  folder,
  folders,
  open,
  onToggle,
  canModerate,
  canDelete,
  onChanged,
}: {
  eventId: string;
  folder: SubAlbum;
  folders: SubAlbum[];
  open: boolean;
  onToggle: () => void;
  canModerate: boolean;
  canDelete: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const save = (patch: Record<string, unknown>) =>
    apiPatch(`/events/${eventId}/album/sub-albums/${folder.id}`, patch)
      .then(onChanged)
      .catch((err: unknown) => setError(errorMessage(t, err)));
  const Icon = open ? FolderOpen : Folder;
  return (
    <li className={cn('rounded-3xl border bg-white shadow-soft transition-colors', open ? 'border-gold-300 lg:col-span-2' : 'border-gold-200/70')}>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden className={cn('grid size-10 shrink-0 place-items-center rounded-xl', folder.kind === 'FUNCTION' ? 'bg-brand-50 text-brand-700' : 'bg-gold-100 text-gold-700')}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            {renaming ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save({ name }).then(() => setRenaming(false));
                }}
              >
                <label className="sr-only" htmlFor={`rename-${folder.id}`}>
                  {t('album.folderName')}
                </label>
                <Input id={`rename-${folder.id}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="min-h-9" />
                <Button type="submit" size="sm" disabled={!name.trim()}>
                  {t('common.save')}
                </Button>
                <Button size="sm" variant="ghost" aria-label={t('common.cancel')} onClick={() => setRenaming(false)}>
                  <X aria-hidden className="size-4" />
                </Button>
              </form>
            ) : (
              <h4 className="truncate font-display text-xl leading-tight">{folder.name}</h4>
            )}
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-stone-500">
              <span>{t(folder.itemCount === 1 ? 'album.countOne' : 'album.count', { count: folder.itemCount })}</span>
              {folder.pendingCount ? <span className="font-medium text-amber-800">{t('album.pending', { count: folder.pendingCount })}</span> : null}
              {folder.functionRemoved ? <span>{t('album.functionRemoved')}</span> : null}
            </p>
          </div>
        </div>
        {error ? (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        {canModerate ? (
          <div className="mt-3 flex flex-wrap gap-x-5">
            <Checkbox label={t('album.inGallery')} checked={folder.showInGallery} onChange={(e) => void save({ showInGallery: e.target.checked })} />
            <Checkbox label={t('album.onWall')} checked={folder.showOnWall} onChange={(e) => void save({ showOnWall: e.target.checked })} />
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant={open ? 'secondary' : 'ghost'} onClick={onToggle} aria-expanded={open}>
            {open ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}
            {open ? t('album.hide') : t('album.open')}
          </Button>
          {canModerate && folder.kind !== 'FUNCTION' && !renaming ? (
            <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
              <Pencil aria-hidden className="size-4" />
              {t('album.rename')}
            </Button>
          ) : null}
          {canModerate && folder.kind === 'CUSTOM' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.confirm(t('album.confirmRemove', { name: folder.name })) && void apiDelete(`/events/${eventId}/album/sub-albums/${folder.id}`).then(onChanged)}
            >
              <Trash2 aria-hidden className="size-4" />
              {t('album.removeFolder')}
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="border-t border-gold-100 p-5">
          <FolderItems eventId={eventId} folder={folder} folders={folders} canModerate={canModerate} canDelete={canDelete} />
        </div>
      ) : null}
    </li>
  );
}

export default function PhotosPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const album = useAlbum(eventId);
  const invalidate = useInvalidateEvent(eventId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canModerate = can(event.data, 'media.moderate');
  const canUpload = can(event.data, 'media.upload');
  const canDelete = can(event.data, 'media.delete');
  const folders = useMemo(() => album.data?.albums ?? [], [album.data]);

  if (album.isPending || event.isPending) return <Spinner label={t('common.loading')} />;
  if (album.isError) return <Alert>{errorMessage(t, album.error)}</Alert>;
  const data = album.data;

  const addFolder = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiPost(`/events/${eventId}/album/sub-albums`, { name: newFolder });
      setNewFolder('');
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{t('photos.title')}</h2>
        <p className="mt-1 max-w-2xl text-stone-600">{t('photos.subtitle')}</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {canModerate && data.pendingCount ? <Alert tone="warning">{t(data.pendingCount === 1 ? 'album.pendingTitleOne' : 'album.pendingTitle', { count: data.pendingCount })}</Alert> : null}

      <AlbumCard eventId={eventId} album={data} canModerate={canModerate} onChanged={invalidate} />
      {canUpload ? <TeamUploader eventId={eventId} album={data} onUploaded={invalidate} /> : null}

      <section aria-labelledby="folders-title" className="space-y-4">
        <div>
          <h3 id="folders-title" className="font-display text-2xl">
            {t('album.folders')}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">{t('album.folders.subtitle')}</p>
        </div>
        <ul className="grid gap-4 lg:grid-cols-2">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              eventId={eventId}
              folder={folder}
              folders={folders}
              open={openId === folder.id}
              onToggle={() => setOpenId(openId === folder.id ? null : folder.id)}
              canModerate={canModerate}
              canDelete={canDelete}
              onChanged={invalidate}
            />
          ))}
        </ul>
        {canModerate ? (
          <form onSubmit={addFolder} className="flex flex-wrap items-end gap-3 rounded-3xl border border-dashed border-gold-300 bg-white/60 p-4">
            <div className="min-w-56 flex-1">
              <Field label={t('album.folderName')}>{(p) => <Input {...p} value={newFolder} maxLength={80} onChange={(e) => setNewFolder(e.target.value)} placeholder="Pre-wedding shoot" />}</Field>
            </div>
            <Button type="submit" disabled={!newFolder.trim()}>
              <FolderPlus aria-hidden className="size-4" />
              {t('album.addFolder')}
            </Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
