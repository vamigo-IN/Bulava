'use client';

import { CameraOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

/** A guest's check-in code from what a pass's QR code holds: its /checkin/<code> link, or the bare code. */
export function checkInCodeFrom(text: string): string | null {
  const value = text.trim();
  const fromUrl = /\/checkin\/([A-Za-z0-9]{8,24})(?:[/?#]|$)/.exec(value)?.[1];
  if (fromUrl) return fromUrl;
  return /^[A-Za-z0-9]{8,24}$/.test(value) ? value : null;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

/** The browser's own QR reader when it has one (Chrome on Android, Edge); otherwise jsQR, loaded only now. */
async function makeReader(): Promise<(video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (Native && (await Native.getSupportedFormats?.().catch((): string[] => []))?.includes('qr_code')) {
    const detector = new Native({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import('jsqr');
  return async (video, canvas) => {
    // Downscale: a 640-px frame decodes quickly on phones and is plenty for a pass held up to the camera.
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

/**
 * Full-screen camera scanner for guests' entry passes. Reads QR codes with the
 * back camera until one holds a check-in code, then hands it over; anything
 * else (another QR code) is reported and scanning goes on. The camera stops
 * when the scanner closes.
 */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'starting' | 'scanning' | 'denied' | 'unavailable'>('starting');
  const [notPass, setNotPass] = useState(false);
  const done = useRef(false);
  const handlers = useRef({ onCode, onClose });
  handlers.current = { onCode, onClose };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (error) {
        return setState((error as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      }
      if (stopped || !video.current) return stop();
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      setState('scanning');
      const read = await makeReader();
      const tick = async () => {
        if (stopped || done.current || !video.current || !canvas.current) return;
        const text = video.current.readyState >= 2 ? await read(video.current, canvas.current).catch(() => null) : null;
        const code = text ? checkInCodeFrom(text) : null;
        if (code) {
          done.current = true;
          navigator.vibrate?.(60);
          stop();
          handlers.current.onCode(code);
          return;
        }
        if (text) {
          setNotPass(true);
          setTimeout(() => setNotPass(false), 2000);
        }
        timer = setTimeout(() => void tick(), 220);
      };
      void tick();
    })();
    return stop;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handlers.current.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={t('checkin.scan.title')} className="fixed inset-0 z-50 flex flex-col bg-black text-ivory">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="font-display text-xl">{t('checkin.scan.title')}</p>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-gold-300">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
        <canvas ref={canvas} hidden />
        {state === 'scanning' ? (
          <div aria-hidden className="relative size-64 max-w-[75vw] rounded-3xl border-4 border-gold-300/90 shadow-[0_0_0_200vmax_rgba(0,0,0,0.45)]">
            <span className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-gold-300/80 motion-reduce:animate-none" />
          </div>
        ) : null}
        {state === 'denied' || state === 'unavailable' ? (
          <div className="relative max-w-sm px-6 text-center">
            <CameraOff aria-hidden className="mx-auto size-10 text-gold-300" />
            <p className="mt-3 text-lg">{state === 'denied' ? t('checkin.scan.denied') : t('checkin.scan.unavailable')}</p>
          </div>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="px-6 py-4 text-center text-sm text-ivory/85">
        {notPass ? t('checkin.scan.notPass') : state === 'starting' ? t('checkin.scan.starting') : state === 'scanning' ? t('checkin.scan.hint') : ''}
      </p>
    </div>
  );
}
