'use client';

import { useEffect, useRef, useState } from 'react';
import { INTRO_OPEN_EVENT } from './intro';

/**
 * Background music for website invitations. Browsers only allow audio after a
 * user gesture, so playback starts when the guest opens the intro (or taps this
 * button), never on page load. Pauses while the tab is hidden. The button is a
 * record for noir pages, a deep round button with pause and play glyphs for the
 * deckle look (`round`, which waits until an opening has lifted, as a printed invitation's
 * would), else a small disc with a sound-bar meter.
 */
export function MusicPlayer({ url, title, labels, vinyl = false, round = false }: { url: string; title: string; labels: { play: string; pause: string }; vinyl?: boolean; round?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const resumeOnShow = useRef(false);
  // An opening locks the page's scroll while it covers it (IntroOverlay): the round button waits for it to lift.
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    if (!round) return;
    const html = document.documentElement;
    const check = () => setCovered(html.style.overflow === 'hidden');
    check();
    const observer = new MutationObserver(check);
    observer.observe(html, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, [round]);

  useEffect(() => {
    const start = () => {
      audio.current?.play().catch(() => undefined);
    };
    window.addEventListener(INTRO_OPEN_EVENT, start);
    const onVisibility = () => {
      const el = audio.current;
      if (!el) return;
      if (document.hidden) {
        resumeOnShow.current = !el.paused;
        el.pause();
      } else if (resumeOnShow.current) {
        el.play().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(INTRO_OPEN_EVENT, start);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => undefined);
    else el.pause();
  };

  return (
    <>
      <audio ref={audio} src={url} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      {vinyl ? (
        // A spinning record with a gold label: turns while the music plays.
        <button
          type="button"
          onClick={toggle}
          aria-pressed={playing}
          aria-label={`${playing ? labels.pause : labels.play}: ${title}`}
          title={title}
          className="fixed right-4 bottom-4 z-50 size-16 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.55)] transition-transform hover:scale-105"
        >
          <span
            className={`bulava-vinyl block size-full rounded-full ${playing ? '' : '[animation-play-state:paused]'}`}
            style={{ background: 'repeating-radial-gradient(circle, #111 0 2px, #1d1d1d 2px 4px)' }}
            aria-hidden="true"
          >
            <span className="absolute inset-[30%] rounded-full bg-[var(--t-accent)]" />
            <span className="absolute inset-[46%] rounded-full bg-black" />
          </span>
          {!playing ? (
            <span className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[var(--t-accent)] text-[0.6rem] text-black" aria-hidden="true">
              ▶
            </span>
          ) : null}
        </button>
      ) : round ? (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={playing}
          aria-label={`${playing ? labels.pause : labels.play}: ${title}`}
          title={title}
          tabIndex={covered ? -1 : undefined}
          aria-hidden={covered || undefined}
          className={`fixed right-5 bottom-5 z-50 flex size-[60px] items-center justify-center rounded-full bg-[var(--t-primary)] text-[var(--t-on-primary)] shadow-[0_4px_6px_rgba(0,0,0,0.1)] transition-[opacity,transform] duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)] ${covered ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        >
          <svg viewBox="0 0 24 24" className="size-[30px]" fill="currentColor" aria-hidden="true">
            {playing ? (
              <>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </>
            ) : (
              <polygon points="7,4 19,12 7,20" />
            )}
          </svg>
        </button>
      ) : (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={`${playing ? labels.pause : labels.play}: ${title}`}
        title={title}
        className="fixed right-4 bottom-4 z-50 flex size-12 items-center justify-center rounded-full bg-[var(--t-primary)] text-[var(--t-on-primary)] shadow-lg ring-2 ring-[var(--t-secondary)]/60 transition-transform hover:scale-105"
      >
        {playing ? (
          <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="bulava-eq w-[3px] rounded-sm bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
            <circle cx="16.5" cy="16" r="2.5" fill="currentColor" />
          </svg>
        )}
      </button>
      )}
    </>
  );
}
