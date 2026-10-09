'use client';

import { Download, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { I18nProvider, useT } from '@/lib/i18n';
import { useInviteToken } from '@/components/photos/upload-room';
import { Spinner } from '@/components/ui/primitives';

interface GalleryItem {
  id: string;
  albumId: string | null;
  kind: string;
  uploaderName: string | null;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  viewUrl: string;
  downloadUrl: string | null;
}

interface GalleryData {
  event: { title: string; language: string };
  /** This visitor may add photos (an invited guest, when the hosts allow it). */
  canUpload: boolean;
  /** Folders the host shows in the gallery that have photos. */
  albums: Array<{ id: string; name: string; count: number }>;
  items: GalleryItem[];
}

function Gallery({ code, data }: { code: string; data: GalleryData }) {
  const t = useT();
  const [folder, setFolder] = useState<string | null>(null);
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const items = folder ? data.items.filter((i) => i.albumId === folder) : data.items;
  const chip = (active: boolean) => `shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${active ? 'border-gold-300 bg-gold-300 text-ink' : 'border-white/20 text-ivory/80 hover:border-gold-300/60'}`;

  return (
    <main className="min-h-dvh bg-ink px-3 py-8 text-ivory">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate text-xs tracking-[0.25em] text-gold-300 uppercase">{data.event.title}</p>
            <h1 className="font-display text-3xl">{t('gallery.title')}</h1>
          </div>
          {data.canUpload ? (
            <Link href={`/p/${code}`} className="shrink-0 text-sm text-gold-300 underline">
              {t('invite.photos.upload')}
            </Link>
          ) : null}
        </div>
        {data.albums.length > 1 ? (
          <nav aria-label={t('gallery.title')} className="-mx-3 mb-5 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
            <button type="button" aria-pressed={folder === null} className={chip(folder === null)} onClick={() => setFolder(null)}>
              {t('gallery.all')} <span className="opacity-70">{data.items.length}</span>
            </button>
            {data.albums.map((a) => (
              <button key={a.id} type="button" aria-pressed={folder === a.id} className={chip(folder === a.id)} onClick={() => setFolder(a.id)}>
                {a.name} <span className="opacity-70">{a.count}</span>
              </button>
            ))}
          </nav>
        ) : null}
        {items.length === 0 ? (
          <p className="py-20 text-center text-ivory/70">{t('gallery.empty')}</p>
        ) : (
          <ul className="columns-2 gap-2 sm:columns-3 lg:columns-4 [&>li]:mb-2">
            {items.map((item) => (
              <li key={item.id} className="relative break-inside-avoid">
                {item.downloadUrl ? (
                  <a
                    href={item.downloadUrl}
                    aria-label={t('gallery.downloadPhoto')}
                    title={t('gallery.downloadPhoto')}
                    className="absolute top-2 right-2 z-10 grid size-9 place-items-center rounded-full bg-black/55 text-ivory backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-gold-300"
                  >
                    <Download aria-hidden className="size-4" />
                  </a>
                ) : null}
                <button type="button" onClick={() => setOpen(item)} className="block w-full overflow-hidden rounded-lg">
                  {item.kind === 'video' ? (
                    <video src={item.viewUrl} preload="metadata" muted className="w-full" />
                  ) : (
                    <img
                      src={item.thumbUrl ?? item.viewUrl}
                      alt={item.uploaderName ? `Photo by ${item.uploaderName}` : 'Photo'}
                      loading="lazy"
                      decoding="async"
                      className="w-full"
                      width={item.width ?? undefined}
                      height={item.height ?? undefined}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between p-3 text-sm">
            <span className="text-ivory/70">{open.uploaderName ?? ''}</span>
            <span className="flex items-center gap-4">
              {open.downloadUrl ? (
                <a href={open.downloadUrl} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-gold-300 underline">
                  <Download aria-hidden className="size-4" />
                  {t('gallery.download')}
                </a>
              ) : null}
              <button type="button" aria-label="Close" className="grid size-9 place-items-center rounded-full text-ivory hover:bg-white/10">
                <X aria-hidden className="size-5" />
              </button>
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center p-3">
            {open.kind === 'video' ? (
              <video src={open.viewUrl} controls autoPlay className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />
            ) : (
              <img src={open.viewUrl} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

/** The album's guest gallery, in the event's language, with a tab per folder the host shows. */
export default function GalleryPage() {
  const { code } = useParams<{ code: string }>();
  const token = useInviteToken();
  const [data, setData] = useState<GalleryData | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (token === undefined) return;
    const headers: Record<string, string> = token ? { 'x-bulava-invite': token } : {};
    fetch(`/api/v1/public/media-rooms/${code}/gallery`, { headers, cache: 'no-store' })
      .then(async (r) => {
        const body = (await r.json()) as { success: boolean; data?: GalleryData; error?: { code: string } };
        if (!body.success || !body.data) throw new ApiError(body.error?.code ?? 'ERROR', '', r.status);
        setData(body.data);
      })
      .catch(() => setDenied(true));
  }, [code, token]);

  if (!data) {
    return (
      <I18nProvider language="en">
        <GalleryState denied={denied} />
      </I18nProvider>
    );
  }
  return (
    <I18nProvider language={data.event.language}>
      <Gallery code={code} data={data} />
    </I18nProvider>
  );
}

function GalleryState({ denied }: { denied: boolean }) {
  const t = useT();
  return (
    <main className="min-h-dvh bg-ink px-3 py-8 text-ivory">
      <div className="mx-auto max-w-6xl">{denied ? <p className="py-20 text-center text-ivory/70">{t('gallery.private')}</p> : <Spinner label={t('common.loading')} />}</div>
    </main>
  );
}
