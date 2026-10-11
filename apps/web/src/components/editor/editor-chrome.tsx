'use client';

import { Maximize, Moon, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { IconButton } from '@/components/cards/editor-ui';
import { cn } from '@/lib/utils';

/**
 * Pieces both editors share (the card editor and the invitation's canvas
 * editor): their light or dark look, the floating zoom bar and the phone
 * around a website's artboard. The look is the `editor-ui` styles in
 * globals.css: `data-editor-theme` on the editor, `editor-chrome` on its bars,
 * panels and dialogs (never on the canvas, which keeps the design's colours).
 */

export type EditorTheme = 'light' | 'dark';
const THEME_KEY = 'bulava.editor.theme';

/** The person's choice on this device, else their system's. Only in components that render on the client. */
export function readEditorTheme(): EditorTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage blocked: follow the system.
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Light or dark editors, remembered on this device (`bulava.editor.theme`). */
export function useEditorTheme(): readonly [EditorTheme, (next: EditorTheme) => void] {
  const [theme, setTheme] = useState<EditorTheme>(readEditorTheme);
  const choose = useCallback((next: EditorTheme) => {
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // A private window: the choice lasts until the editor closes.
    }
  }, []);
  return [theme, choose] as const;
}

export function ThemeToggle({ theme, onChange, labels }: { theme: EditorTheme; onChange: (next: EditorTheme) => void; labels: { dark: string; light: string } }) {
  const dark = theme === 'dark';
  return (
    <IconButton label={dark ? labels.light : labels.dark} tone="plain" onClick={() => onChange(dark ? 'light' : 'dark')}>
      {dark ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
    </IconButton>
  );
}

/** The zoom bar floating over the canvas: out, the zoom (click to fit), in, fit; anything else goes first. */
export function CanvasToolbar({
  zoom,
  fitted,
  onZoom,
  onFit,
  labels,
  children,
  className,
}: {
  zoom: number;
  fitted: boolean;
  /** Multiplies the zoom. */
  onZoom: (factor: number) => void;
  onFit: () => void;
  labels: { zoomIn: string; zoomOut: string; fit: string };
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="toolbar"
      aria-label={labels.fit}
      className={cn(
        'editor-chrome pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-[var(--ed-toolbar-line)] bg-[var(--ed-toolbar)] p-1 text-ink shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-md',
        className,
      )}
    >
      {children ? (
        <>
          {children}
          <span className="mx-1 h-6 w-px bg-stone-300/70" aria-hidden />
        </>
      ) : null}
      <IconButton label={labels.zoomOut} onClick={() => onZoom(1 / 1.2)} tone="plain">
        <ZoomOut aria-hidden className="size-5" />
      </IconButton>
      <button type="button" onClick={onFit} className="min-w-14 rounded-lg px-1 text-xs font-semibold text-stone-700 tabular-nums hover:bg-sand/80" title={labels.fit}>
        {Math.round(zoom * 100)}%
      </button>
      <IconButton label={labels.zoomIn} onClick={() => onZoom(1.2)} tone="plain">
        <ZoomIn aria-hidden className="size-5" />
      </IconButton>
      <IconButton label={labels.fit} onClick={onFit} tone="plain" active={fitted}>
        <Maximize aria-hidden className="size-5" />
      </IconButton>
    </div>
  );
}

/**
 * A phone around a website's phone artboard, so hosts see it as their guests
 * will. Nothing is clipped: the selection handles may reach over the bezel.
 */
export function DeviceFrame({ children, show }: { children: ReactNode; show: boolean }) {
  if (!show) return <>{children}</>;
  return (
    <div className="relative rounded-[2.75rem] border border-[var(--ed-device-rim)] bg-[var(--ed-device)] px-3 pt-9 pb-9 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
      <span aria-hidden className="absolute top-4 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[var(--ed-device-rim)]" />
      {children}
      <span aria-hidden className="absolute bottom-3.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-[var(--ed-device-rim)]" />
    </div>
  );
}
