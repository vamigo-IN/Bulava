'use client';

import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Artboard, TemplateDefinition } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { pageBoard, sceneOf, sectionOf, type DesignPage } from './pages';

/** What a page is called on the strip: the opening, a function's card, a section, a scene with its length. */
export function pageLabel(def: TemplateDefinition, page: DesignPage): string {
  if (page.kind === 'scene') {
    const scene = sceneOf(def, page);
    return t('design.page.scene', { n: page.index + 1, seconds: scene?.durationSec ?? 0 });
  }
  if (page.index === 0) return t('design.page.opening');
  if (sectionOf(def, page)?.repeatPerFunction) return t('design.page.functionCard');
  return t('design.page.section', { id: page.refId });
}

const THUMB_HEIGHT = 76;

/**
 * The pages along the foot of the Design Studio: every board of the template,
 * drawn small. Pick one to work on it; the current one can be copied, moved
 * or removed, and a new empty page added after it.
 */
export function PagesStrip({
  definition,
  pages,
  current,
  draw,
  onPick,
  onAdd,
  onDuplicate,
  onMove,
  onRemove,
}: {
  definition: TemplateDefinition;
  pages: DesignPage[];
  current: string;
  draw: (board: Artboard, page: DesignPage) => ReactNode;
  onPick: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const at = pages.findIndex((p) => p.id === current);
  const page = pages[at];
  const sameKind = page ? pages.filter((p) => p.kind === page.kind) : [];
  const kindAt = page ? sameKind.indexOf(page) : -1;
  return (
    <div className="flex items-center gap-3 border-t border-stone-200 bg-white px-3 py-2" aria-label={t('design.pages')}>
      <div className="flex min-w-0 flex-1 items-end gap-2 overflow-x-auto pb-1">
        {pages.map((p) => {
          const board = pageBoard(definition, p, 'mobile');
          const width = board ? Math.round((THUMB_HEIGHT * board.width) / board.height) : 44;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              aria-pressed={p.id === current}
              title={pageLabel(definition, p)}
              className={cn('group flex shrink-0 flex-col items-center gap-1 rounded-lg p-1 text-[10px]', p.id === current ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-500' : 'text-stone-600 hover:bg-stone-100')}
            >
              <span className="block overflow-hidden rounded border border-stone-200 bg-white shadow-sm" style={{ width, height: THUMB_HEIGHT }}>
                {board ? <span className="pointer-events-none block origin-top-left" style={{ width: board.width, transform: `scale(${THUMB_HEIGHT / board.height})` }}>{draw(board, p)}</span> : null}
              </span>
              <span className="max-w-[110px] truncate">{pageLabel(definition, p)}</span>
            </button>
          );
        })}
        <button type="button" onClick={onAdd} className="flex shrink-0 flex-col items-center gap-1 rounded-lg p-1 text-[10px] text-stone-600 hover:bg-stone-100" title={t('design.page.add')}>
          <span className="grid place-items-center rounded border border-dashed border-stone-300 bg-stone-50" style={{ width: 44, height: THUMB_HEIGHT }}>
            <Plus className="size-4" aria-hidden />
          </span>
          <span>{t('design.page.add')}</span>
        </button>
      </div>
      {page ? (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className="rounded p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-40" aria-label={t('design.page.earlier')} title={t('design.page.earlier')} disabled={kindAt <= 0} onClick={() => onMove(-1)}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className="rounded p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-40" aria-label={t('design.page.later')} title={t('design.page.later')} disabled={kindAt === -1 || kindAt >= sameKind.length - 1} onClick={() => onMove(1)}>
            <ChevronRight className="size-4" />
          </button>
          <button type="button" className="rounded p-1.5 text-stone-500 hover:bg-stone-100" aria-label={t('design.page.duplicate')} title={t('design.page.duplicate')} onClick={onDuplicate}>
            <Copy className="size-4" />
          </button>
          <button type="button" className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40" aria-label={t('design.page.remove')} title={t('design.page.remove')} disabled={pages.length <= 1} onClick={onRemove}>
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
