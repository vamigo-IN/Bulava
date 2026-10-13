'use client';

import { FileImage, FileText, LoaderCircle, Lock } from 'lucide-react';
import type { Translator } from '@bulava/localization';
import { CARD_FILE_TYPES, type CardFileType } from '@/lib/cards';
import { cn } from '@/lib/utils';

const ICON = { png: FileImage, jpeg: FileImage, pdf: FileText } as const;

/**
 * Saving a card (docs/cards.md#files): a PNG (the best quality), a JPEG (small,
 * for WhatsApp) or a PDF (for printing). The free card has no PDF: there the
 * PDF button offers the watermark-free card instead (`onLocked`), whose PDF
 * comes with it.
 */
export function FileChoice({
  t,
  saving,
  disabled,
  pdfLocked,
  lockedLabel,
  onSave,
  onLocked,
}: {
  t: Translator;
  /** The file being fetched, for its spinner. */
  saving: CardFileType | null;
  disabled?: boolean;
  /** The free card: its PDF is offered with the watermark-free card. */
  pdfLocked?: boolean;
  /** What the locked PDF button offers ("Without watermark · ₹50"). */
  lockedLabel?: string;
  onSave: (as: CardFileType) => void;
  onLocked?: () => void;
}) {
  return (
    <div role="group" aria-label={t('cards.file.choose')} className="grid gap-2 sm:grid-cols-3">
      {CARD_FILE_TYPES.map((as, i) => {
        const locked = as === 'pdf' && pdfLocked;
        const Icon = locked ? Lock : ICON[as];
        return (
          <button
            key={as}
            type="button"
            disabled={disabled || saving !== null || (locked && !onLocked)}
            onClick={() => (locked ? onLocked?.() : onSave(as))}
            className={cn(
              'btn-3d min-h-14 w-full justify-start gap-3 rounded-2xl px-4 text-left disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              i > 0 && 'btn-3d-light',
            )}
          >
            {saving === as ? <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin" /> : <Icon aria-hidden className="size-5 shrink-0" />}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-base font-semibold">{t(`cards.file.${as}`)}</span>
              <span className="text-xs font-normal opacity-80">{locked ? (lockedLabel ?? t('cards.file.pdfLocked')) : t(`cards.file.${as}.hint`)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
