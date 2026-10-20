'use client';

import { useMemo } from 'react';
import { createTranslator } from '@bulava/localization';
import { CardView, TemplateStyles } from '@bulava/template-engine';
import { CardDesignSchema, cardRenderContext, type CardPhotoBinding } from '@bulava/template-schema';
import { cn } from '@/lib/utils';

/**
 * A card drawn exactly as the editor and the export draw it (CardView), at
 * its container's width; preview cards always carry their watermark.
 */
export function CardThumb({ design, photos, watermark, className }: { design: unknown; photos?: Record<string, string>; watermark: string | null; className?: string }) {
  const parsed = useMemo(() => CardDesignSchema.safeParse(design), [design]);
  const card = parsed.success ? parsed.data : null;
  const t = useMemo(() => createTranslator(card?.language ?? 'en'), [card?.language]);
  const ctx = useMemo(() => (card ? cardRenderContext(card, (photos ?? {}) as Partial<Record<CardPhotoBinding, string>>) : null), [card, photos]);
  if (!card || !ctx) return null;
  return (
    <div className={cn('overflow-hidden bg-white', className)} style={{ aspectRatio: `${card.board.width} / ${card.board.height}` }}>
      <TemplateStyles />
      <CardView design={card} ctx={ctx} t={t} watermark={watermark} />
    </div>
  );
}
