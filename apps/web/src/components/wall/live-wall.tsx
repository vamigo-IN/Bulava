'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nProvider, useT } from '@/lib/i18n';

interface WallPhoto {
  id: string;
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  uploaderName: string | null;
  createdAt: string;
}

interface WallData {
  event: { title: string; language: string; typeKey: string; partnerOne: string | null; partnerTwo: string | null };
  room: { name: string };
  /** The gallery the QR code opens (see and download the photos), when it is public. */
  galleryUrl: string | null;
  pollSeconds: number;
  items: WallPhoto[];
}

type Stored = WallPhoto & { fetchedAt: number };

/** Signed image URLs last an hour; take fresh ones from the poll after this. */
const URL_REFRESH_MS = 40 * 60_000;
const SLIDE_MS = 7000;
/** A photo counts as "just shared" for the first minute it is on the wall. */
const FRESH_MS = 60_000;

/**
 * Full-screen slideshow for a TV or projector at the venue. Polls the wall
 * endpoint, keeps each photo's first signed URL (so images are not refetched
 * every poll), shows newly shared photos next, and drops ones the host removes.
 */
function Wall({ token, data, unavailable }: { token: string; data: WallData | null; unavailable: boolean }) {
  const t = useT();
  const [photos, setPhotos] = useState<Stored[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  /** When each photo first reached this screen (0 for those already there when it opened). */
  const firstSeen = useRef(new Map<string, number>());
  const loaded = useRef(false);
  const queue = useRef<string[]>([]);
  const [idle, setIdle] = useState(false);

  // Merge each poll into the stored list.
  useEffect(() => {
    if (!data) return;
    setPhotos((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      const now = Date.now();
      const next = data.items.map((item) => {
        const old = byId.get(item.id);
        if (old && now - old.fetchedAt < URL_REFRESH_MS) return old;
        if (!old && !firstSeen.current.has(item.id)) {
          firstSeen.current.set(item.id, loaded.current ? now : 0);
          // Newly shared photos jump the queue.
          if (loaded.current) queue.current.push(item.id);
        }
        return { ...item, fetchedAt: now };
      });
      loaded.current = true;
      return next;
    });
  }, [data]);

  const advance = useCallback(() => {
    setCurrent((cur) => {
      const ids = photos.map((p) => p.id);
      if (!ids.length) return null;
      while (queue.current.length) {
        const next = queue.current.shift()!;
        if (ids.includes(next)) return next;
      }
      const i = cur ? ids.indexOf(cur) : -1;
      return ids[(i + 1) % ids.length] ?? ids[0]!;
    });
  }, [photos]);

  // Start the show once photos arrive, and keep it moving.
  useEffect(() => {
    if (!current || !photos.some((p) => p.id === current)) advance();
  }, [photos, current, advance]);
  useEffect(() => {
    const timer = setInterval(advance, SLIDE_MS);
    return () => clearInterval(timer);
  }, [advance]);

  // Preload the photo that will probably come next.
  useEffect(() => {
    const i = photos.findIndex((p) => p.id === current);
    const next = photos[queue.current.length ? photos.findIndex((p) => p.id === queue.current[0]) : (i + 1) % Math.max(photos.length, 1)];
    if (next) new Image().src = next.url;
  }, [current, photos]);

  // Hide the cursor and controls when nobody is touching the screen.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3000);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, []);

  const photo = photos.find((p) => p.id === current) ?? null;
  const fresh = photo ? Date.now() - (firstSeen.current.get(photo.id) ?? 0) < FRESH_MS : false;
  const couple = data?.event.partnerOne && data.event.partnerTwo ? `${data.event.partnerOne} & ${data.event.partnerTwo}` : null;
  const recent = photos.slice(0, 6);

  return (
    <main className={`fixed inset-0 overflow-hidden bg-[#1a0a0d] text-ivory ${idle ? 'cursor-none' : ''}`}>
      {/* Soft, blurred copy of the current photo fills the screen behind everything. */}
      {photo ? (
         
        <img key={`bg-${photo.id}`} src={photo.url} alt="" aria-hidden className="wall-backdrop absolute inset-0 size-full scale-110 object-cover blur-2xl" />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(10,3,5,0.85)_100%)]" />

      <div className="relative grid h-full gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,24%)] lg:p-10">
        <section className="flex min-h-0 flex-col items-center justify-center">
          {unavailable ? (
            <p className="max-w-lg text-center font-display text-3xl text-gold-200">{t('wall.screen.unavailable')}</p>
          ) : photo ? (
            <figure key={photo.id} className="wall-fade flex max-h-full min-h-0 flex-col items-center">
              <img src={photo.url} alt={photo.uploaderName ? t('wall.screen.sharedBy', { name: photo.uploaderName }) : ''} className="max-h-[80vh] min-h-0 rounded-2xl border-4 border-white/90 object-contain shadow-2xl shadow-black/60" />
              <figcaption className="mt-4 flex items-center gap-3 text-lg text-gold-100">
                {fresh ? <span className="rounded-full bg-gold-300 px-3 py-0.5 text-sm font-semibold text-[#3a1016]">✨ {t('wall.screen.justNow')}</span> : null}
                {photo.uploaderName ? <span>📷 {t('wall.screen.sharedBy', { name: photo.uploaderName })}</span> : null}
              </figcaption>
            </figure>
          ) : data ? (
            <div className="max-w-xl text-center">
              <p className="font-display text-4xl text-gold-200">{t('wall.screen.empty')}</p>
            </div>
          ) : null}
        </section>

        <aside className="hidden min-h-0 flex-col gap-5 lg:flex">
          <div className="text-center">
            {couple ? <p className="font-script text-5xl leading-tight text-gold-200">{couple}</p> : null}
            <p className={couple ? 'mt-1 text-sm tracking-[0.3em] text-gold-100/80 uppercase' : 'font-display text-3xl text-gold-200'}>{data?.event.title}</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold-300/40 px-3 py-1 text-xs tracking-widest uppercase">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
              </span>
              {t('wall.screen.live')} · {data?.room.name} · {t('wall.screen.count', { count: photos.length })}
            </p>
          </div>

          {data?.galleryUrl ? (
            <div className="rounded-2xl bg-white p-4 text-center text-stone-800 shadow-xl">
              <img src={`/api/v1/public/walls/${token}/qr.svg`} alt={t('wall.screen.scan')} className="mx-auto aspect-square w-full max-w-[220px]" />
              <p className="mt-2 font-semibold">{t('wall.screen.scan')}</p>
            </div>
          ) : null}

          {recent.length > 1 ? (
            <div className="grid min-h-0 grid-cols-3 gap-2">
              {recent.map((p) => (
                 
                <img key={p.id} src={p.thumbUrl ?? p.url} alt="" className={`aspect-square w-full rounded-lg object-cover transition ${p.id === current ? 'ring-2 ring-gold-300' : 'opacity-70'}`} />
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      {!idle ? (
        <button
          type="button"
          onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
          className="absolute top-4 right-4 rounded-full bg-black/40 px-4 py-2 text-sm text-white backdrop-blur hover:bg-black/60"
        >
          ⛶ {t('wall.screen.fullscreen')}
        </button>
      ) : null}
    </main>
  );
}

export function LiveWall({ token }: { token: string }) {
  const [data, setData] = useState<WallData | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let delay = 8000;
      try {
        const res = await fetch(`/api/v1/public/walls/${encodeURIComponent(token)}`, { cache: 'no-store', headers: { accept: 'application/json' } });
        const body = (await res.json().catch(() => null)) as { success: boolean; data?: WallData } | null;
        if (res.ok && body?.success && body.data) {
          setData(body.data);
          setUnavailable(false);
          delay = body.data.pollSeconds * 1000;
        } else if (res.status === 404) {
          // Switched off, rotated or closed: keep checking slowly in case it comes back.
          setUnavailable(true);
          delay = 60_000;
        }
      } catch {
        delay = 15_000;
      }
      if (!stopped) timer = setTimeout(poll, delay);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token]);

  return (
    <I18nProvider language={data?.event.language ?? 'en'}>
      <Wall token={token} data={data} unavailable={unavailable} />
    </I18nProvider>
  );
}
