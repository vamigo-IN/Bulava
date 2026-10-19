'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { TextLayer } from '@bulava/template-schema';
import { t } from '@/lib/i18n';

const FONT_VAR: Record<string, string> = { heading: 'var(--t-heading)', body: 'var(--t-body)', script: 'var(--t-script)' };
const COLOR_VAR: Record<string, string> = { primary: 'var(--t-primary)', secondary: 'var(--t-secondary)', accent: 'var(--t-accent)', background: 'var(--t-bg)', surface: 'var(--t-surface)', text: 'var(--t-text)', muted: 'var(--t-muted)' };
const TRANSFORM: Record<string, CSSProperties['textTransform']> = { none: 'none', upper: 'uppercase', lower: 'lowercase', capitalize: 'capitalize' };

/** Whether a text layer's words can be typed on the board: fixed text and `{{template}}` text (not data a binding fills). */
export function inlineEditable(layer: TextLayer): boolean {
  const c = layer.content;
  return 'literal' in c || 'template' in c;
}

/** The words as typed: the fixed text, or the template with its {{placeholders}}. */
export function inlineValue(layer: TextLayer): string {
  const c = layer.content;
  if ('literal' in c) return String(c.literal);
  if ('template' in c) return c.template;
  return '';
}

/**
 * Typing on the board (double-click a text layer): a box over the layer in its
 * own lettering. Enter on its own line or Ctrl+Enter keeps the text, Escape
 * drops the change; clicking away keeps it.
 */
export function InlineText({ layer, zoom, onCommit, onCancel }: { layer: TextLayer; zoom: number; onCommit: (text: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(() => inlineValue(layer));
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (keep && value !== inlineValue(layer)) onCommit(value);
    else onCancel();
  };
  const f = layer.frame;
  const s = layer.style;
  return (
    <textarea
      ref={ref}
      aria-label={t('design.text.edit')}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          finish(true);
        }
      }}
      className="absolute resize-none rounded-sm bg-white/85 p-0 outline-2 outline-brand-600 outline-solid"
      style={{
        left: f.x * zoom,
        top: f.y * zoom,
        width: Math.max(40, f.w * zoom),
        minHeight: Math.max(24, f.h * zoom),
        transform: f.rotate ? `rotate(${f.rotate}deg)` : undefined,
        transformOrigin: 'center',
        zIndex: 20,
        fontFamily: FONT_VAR[s.font] ?? `"${s.font}"`,
        fontSize: s.size * zoom,
        fontWeight: s.weight,
        fontStyle: s.italic ? 'italic' : 'normal',
        lineHeight: s.lineHeight,
        letterSpacing: `${s.letterSpacing}em`,
        textTransform: TRANSFORM[s.transform],
        textAlign: s.align,
        color: COLOR_VAR[s.color] ?? s.color,
      }}
    />
  );
}
