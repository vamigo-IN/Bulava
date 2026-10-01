'use client';

import { Pause, Play } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface LicensedTrack {
  id: string;
  title: string;
  artist: string | null;
  durationSeconds: number;
  previewUrl: string;
  license: { attributionRequired: boolean; attributionText: string | null };
}

const duration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Choose a licensed track (or none), with in-place previews. */
export function MusicPicker({ value, onChange }: { value: string | null | undefined; onChange: (musicId: string | null) => void }) {
  const t = useT();
  const tracks = useQuery({ queryKey: ['music'], queryFn: () => apiGet<LicensedTrack[]>('/music'), staleTime: 300_000 });
  const audio = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  function preview(track: LicensedTrack) {
    if (previewing === track.id) {
      audio.current?.pause();
      setPreviewing(null);
      return;
    }
    audio.current?.pause();
    audio.current = new Audio(track.previewUrl);
    audio.current.onended = () => setPreviewing(null);
    audio.current.play().catch(() => setPreviewing(null));
    setPreviewing(track.id);
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">{t('video.music')}</legend>
      <div role="radiogroup" className="space-y-1.5">
        <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm', !value ? 'border-brand-700 bg-brand-50' : 'border-gold-200')}>
          <input type="radio" name="music" className="accent-brand-700" checked={!value} onChange={() => onChange(null)} />
          {t('video.music.none')}
        </label>
        {tracks.data?.map((track) => (
          <div
            key={track.id}
            className={cn('flex min-h-11 items-center gap-3 rounded-xl border px-3 py-1.5 text-sm', value === track.id ? 'border-brand-700 bg-brand-50' : 'border-gold-200')}
          >
            <label className="flex flex-1 cursor-pointer items-center gap-3">
              <input type="radio" name="music" className="accent-brand-700" checked={value === track.id} onChange={() => onChange(track.id)} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{track.title}</span>
                <span className="block truncate text-xs text-stone-500">
                  {[track.artist, duration(track.durationSeconds)].filter(Boolean).join(' · ')}
                  {track.license.attributionRequired && track.license.attributionText ? ` · ${track.license.attributionText}` : ''}
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => preview(track)}
              aria-label={`${previewing === track.id ? t('template.music.pause') : t('template.music.play')}: ${track.title}`}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold-300 text-brand-700 hover:bg-gold-100"
            >
              {previewing === track.id ? <Pause aria-hidden className="size-4 fill-current" /> : <Play aria-hidden className="size-4 translate-x-px fill-current" />}
            </button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
