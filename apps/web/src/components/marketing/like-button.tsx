'use client';

import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLike } from '@/lib/likes';
import { cn } from '@/lib/utils';

/**
 * The heart on a design (ADR-055): tap to like it, tap again to take it back.
 * The number shows only when the console shows counts and the design has
 * enough real likes; otherwise the heart stands alone. Labels come in from the
 * page, which has the translations.
 */
export function LikeButton({
  templateKey,
  label,
  labelOn,
  limitedLabel,
  size = 'md',
  className,
}: {
  templateKey: string;
  /** "Like <name>". */
  label: string;
  /** "Unlike <name>". */
  labelOn: string;
  /** Said when this network already liked the design today (sign in to like it too). */
  limitedLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { liked, count, busy, toggle } = useLike(templateKey);
  const [note, setNote] = useState<string | null>(null);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(id);
  }, [note]);

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-pressed={liked}
        aria-label={liked ? labelOn : label}
        title={liked ? labelOn : label}
        disabled={busy}
        onClick={async () => {
          setNote(null);
          if (!liked) setPop(true);
          const failed = await toggle();
          if (failed === 'RATE_LIMITED') setNote(limitedLabel);
        }}
        onAnimationEnd={() => setPop(false)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-surface/95 font-semibold text-stone-600 shadow-clay-sm transition-[color,transform] duration-200 hover:text-brand-700 active:scale-95 disabled:opacity-80',
          size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-10 px-3 text-sm',
          liked && 'text-brand-700',
        )}
      >
        <Heart aria-hidden className={cn(size === 'sm' ? 'size-3.5' : 'size-4', liked && 'fill-current', pop && 'animate-[like-pop_0.35s_ease-out] motion-reduce:animate-none')} />
        {count !== null ? <span className="tabular-nums">{count.toLocaleString('en-IN')}</span> : null}
      </button>
      {note ? (
        <span role="status" className="absolute top-full right-0 z-40 mt-1.5 w-56 rounded-xl bg-stone-900 px-3 py-2 text-xs leading-snug text-white shadow-lg">
          {note}
        </span>
      ) : null}
    </span>
  );
}
