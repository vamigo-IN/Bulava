'use client';

import { Camera, ImagePlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';
import { Alert, Button, Input, Spinner } from '@/components/ui/primitives';

export interface RoomInfo {
  event: { title: string; language: string; typeKey: string; partnerOne: string | null; partnerTwo: string | null };
  room: { name: string; functionName: string | null; uploadsEnabled: boolean; moderated: boolean };
  /** Folders the visitor can upload into: their functions, the host's own, and General. */
  albums: Array<{ id: string; kind: 'GENERAL' | 'FUNCTION' | 'CUSTOM'; name: string }>;
  /** Today's function, else General. */
  defaultAlbumId: string | null;
  /** This visitor may add photos: an invited guest (from their invitation) when the host allows guest uploads. */
  canUpload: boolean;
  canViewGallery: boolean;
  accept: string[];
}

interface Upload {
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'failed';
  error?: string;
}

/** Reads the invitation token from the URL fragment (never sent to servers) and keeps it for this tab. */
/** undefined = not read yet; null = no token. */
export function useInviteToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const fromHash = /(?:^|&)t=([A-Za-z0-9_-]{43})/.exec(window.location.hash.slice(1))?.[1];
    try {
      if (fromHash) sessionStorage.setItem('bulava_invite', fromHash);
      setToken(fromHash ?? sessionStorage.getItem('bulava_invite'));
    } catch {
      setToken(fromHash ?? null);
    }
  }, []);
  return token;
}

/** PUT a file straight to storage with progress (fetch has no upload progress). */
export function putWithProgress(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
}

/**
 * The album link is for viewing: it opens the gallery. Invited guests whose
 * hosts allow guest uploads arrive with their invitation token and get the
 * upload form; the team adds photos from the dashboard.
 */
function Room({ code, initial }: { code: string; initial: RoomInfo }) {
  const t = useT();
  const router = useRouter();
  const token = useInviteToken();
  const [room, setRoom] = useState<RoomInfo | null>(null);

  // The server rendered the album for an anonymous visitor; the invitation token (in the URL fragment) can change that.
  useEffect(() => {
    if (token === undefined) return;
    if (!token) return setRoom(initial);
    api<RoomInfo>(`/public/media-rooms/${code}`, { headers: { 'x-bulava-invite': token } })
      .then(setRoom)
      .catch(() => setRoom(initial));
  }, [code, token, initial]);

  useEffect(() => {
    if (room && !room.canUpload && room.canViewGallery) router.replace(`/p/${code}/gallery`);
  }, [room, code, router]);

  if (!room || (!room.canUpload && room.canViewGallery)) {
    return (
      <main className="paper flex min-h-dvh items-center justify-center px-4">
        <Spinner label={t('common.loading')} />
      </main>
    );
  }
  return <UploadForm code={code} room={room} token={token ?? null} />;
}

function UploadForm({ code, room, token }: { code: string; room: RoomInfo; token: string | null }) {
  const t = useT();
  const [name, setName] = useState('');
  const [albumId, setAlbumId] = useState(room.defaultAlbumId ?? room.albums[0]?.id ?? '');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const couple = room.event.partnerOne && room.event.partnerTwo ? `${room.event.partnerOne} & ${room.event.partnerTwo}` : room.event.title;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted = Array.from(list).filter((f) => room.accept.includes(f.type));
    setUploads((u) => [...u.filter((x) => x.status !== 'done'), ...accepted.map((file) => ({ file, progress: 0, status: 'queued' as const }))]);
  };

  const update = (index: number, patch: Partial<Upload>) => setUploads((u) => u.map((x, i) => (i === index ? { ...x, ...patch } : x)));

  const start = async () => {
    setBusy(true);
    setError(null);
    for (let i = 0; i < uploads.length; i++) {
      const u = uploads[i]!;
      if (u.status !== 'queued' && u.status !== 'failed') continue;
      update(i, { status: 'uploading', progress: 0, error: undefined });
      try {
        const ticket = await api<{ itemId: string; uploadUrl: string }>(`/public/media-rooms/${code}/uploads`, {
          method: 'POST',
          body: { fileName: u.file.name.slice(0, 200), contentType: u.file.type, sizeBytes: u.file.size, uploaderName: name.trim() || undefined, ...(albumId ? { albumId } : {}) },
          headers: token ? { 'x-bulava-invite': token } : undefined,
        });
        await putWithProgress(ticket.uploadUrl, u.file, (p) => update(i, { progress: p }));
        await api(`/public/media-rooms/${code}/uploads/${ticket.itemId}/complete`, { method: 'POST', body: {} });
        update(i, { status: 'done', progress: 100 });
      } catch (err) {
        update(i, { status: 'failed', error: errorMessage(t, err) });
      }
    }
    setBusy(false);
  };

  const done = uploads.filter((u) => u.status === 'done').length;
  const failed = uploads.filter((u) => u.status === 'failed').length;
  const pending = uploads.filter((u) => u.status === 'queued' || u.status === 'failed').length;

  return (
    <main className="paper min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-md">
        <header className="text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-gold-600 uppercase">{room.room.functionName ?? room.room.name}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-brand-700">{couple}</h1>
          <p className="mt-3 text-stone-600">{t('upload.subtitle', { event: room.event.title })}</p>
        </header>

        {!room.canUpload ? (
          <div className="mt-8">
            <Alert tone="info">{room.room.uploadsEnabled ? t('upload.fromInvitation') : t('upload.teamOnly')}</Alert>
          </div>
        ) : (
          <section className="mt-8 rounded-3xl border border-gold-200 bg-white p-5 shadow-sm">
            <h2 className="sr-only">{t('upload.title')}</h2>
            {room.albums.length > 1 ? (
              <fieldset className="mb-5">
                <legend className="mb-2 text-sm font-medium text-stone-700">{t('upload.album')}</legend>
                <div className="flex flex-wrap gap-2">
                  {room.albums.map((a) => (
                    <label
                      key={a.id}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
                        albumId === a.id ? 'border-brand-700 bg-brand-700 text-ivory' : 'border-gold-300 bg-white text-stone-700 hover:border-brand-600'
                      }`}
                    >
                      <input type="radio" name="album" value={a.id} checked={albumId === a.id} onChange={() => setAlbumId(a.id)} disabled={busy} className="sr-only" />
                      {a.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <input ref={pickRef} type="file" accept={room.accept.join(',')} multiple hidden onChange={(e) => addFiles(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" className="min-h-14 rounded-2xl" onClick={() => pickRef.current?.click()}>
                <ImagePlus aria-hidden className="size-5" />
                {t('upload.select')}
              </Button>
              <Button variant="secondary" className="min-h-14 rounded-2xl" onClick={() => cameraRef.current?.click()}>
                <Camera aria-hidden className="size-5" />
                {t('upload.camera')}
              </Button>
            </div>
            <label className="mt-4 block text-sm font-medium text-stone-700">
              {t('upload.name')} <span className="font-normal text-stone-500">({t('common.optional')})</span>
              <Input className="mt-1" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>

            {uploads.length ? (
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {uploads.map((u, i) => (
                  <li key={`${u.file.name}-${i}`} className="rounded-xl bg-sand/60 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{u.file.name}</span>
                      <span className="shrink-0 text-xs text-stone-500">{u.status === 'done' ? '✓' : u.status === 'failed' ? '!' : `${u.progress}%`}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                      <div className={`h-full rounded-full ${u.status === 'failed' ? 'bg-red-500' : 'bg-brand-700'}`} style={{ width: `${u.progress}%` }} />
                    </div>
                    {u.error ? <p className="mt-1 text-xs text-red-700">{u.error}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <div className="mt-4">
                <Alert>{error}</Alert>
              </div>
            ) : null}
            {busy ? <p className="mt-4 text-center text-sm text-stone-600">{t('upload.uploading', { done, total: uploads.length })}</p> : null}
            {!busy && done > 0 ? (
              <div className="mt-4">
                <Alert tone="success">
                  {t('upload.done', { count: done })} {room.room.moderated ? t('upload.moderated') : ''}
                </Alert>
              </div>
            ) : null}
            {!busy && failed > 0 ? <p className="mt-2 text-sm text-red-700">{t('upload.failed', { count: failed })}</p> : null}

            <Button size="lg" className="mt-5 w-full rounded-full" disabled={busy || pending === 0} onClick={start}>
              {pending ? t('upload.submit', { count: pending }) : t('upload.submitNone')}
            </Button>
          </section>
        )}

        {room.canViewGallery || token ? (
          <p className="mt-6 text-center">
            <Link href={`/p/${code}/gallery`} className="font-medium text-brand-700 underline">
              {t('upload.gallery')} →
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}

export function UploadRoom({ code, room }: { code: string; room: RoomInfo }) {
  return (
    <I18nProvider language={room.event.language}>
      <Room code={code} initial={room} />
    </I18nProvider>
  );
}
