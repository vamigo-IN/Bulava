'use client';

import { Component, Eye, EyeOff, Flower2, GripVertical, Image as ImageIcon, Landmark, Lock, LockOpen, Shapes, Sparkles, Type, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { Artboard, Layer } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { layerLabel } from './geometry';

const KIND_ICON: Record<Layer['kind'], LucideIcon> = { text: Type, image: ImageIcon, shape: Shapes, ornament: Flower2, icon: Sparkles, widget: Component, scene: Landmark };

/**
 * The layer list, top-most first (as drawn). Drag a row to reorder, click to
 * select; the eye and lock toggles keep a layer out of the way while working.
 */
export function LayersPanel({ board, selectedId, onSelect, onChange }: { board: Artboard; selectedId: string | null; onSelect: (id: string | null) => void; onChange: (board: Artboard) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const layers = [...board.layers].reverse();

  const toggle = (id: string, key: 'hidden' | 'locked') => onChange({ ...board, layers: board.layers.map((l) => (l.id === id ? { ...l, [key]: !l[key] } : l)) });

  const drop = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const list = [...board.layers];
    const from = list.findIndex((l) => l.id === dragging);
    const to = list.findIndex((l) => l.id === targetId);
    if (from === -1 || to === -1) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item!);
    onChange({ ...board, layers: list });
  };

  if (!layers.length) return <p className="px-3 py-6 text-center text-xs text-stone-500">{t('canvas.noLayers')}</p>;

  return (
    <ol className="py-1" aria-label={t('canvas.layers')}>
      {layers.map((layer) => {
        const Icon = KIND_ICON[layer.kind];
        const selected = layer.id === selectedId;
        return (
          <li
            key={layer.id}
            draggable
            onDragStart={(e) => {
              setDragging(layer.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (over !== layer.id) setOver(layer.id);
            }}
            onDragLeave={() => over === layer.id && setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              drop(layer.id);
              setDragging(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            className={cn('group flex items-center gap-1 border-l-2 px-2 py-1 text-xs', selected ? 'border-brand-600 bg-brand-50' : 'border-transparent hover:bg-stone-50', over === layer.id && dragging !== layer.id ? 'border-t border-t-brand-400' : '', layer.hidden ? 'opacity-50' : '')}
          >
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-stone-300" aria-hidden />
            <button type="button" onClick={() => onSelect(layer.id)} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
              <Icon className="size-3.5 shrink-0 text-stone-500" aria-hidden />
              <span className="truncate">{layerLabel(layer)}</span>
            </button>
            <button type="button" className={cn('rounded p-1 text-stone-400 hover:text-stone-700', layer.hidden ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100')} aria-label={layer.hidden ? t('canvas.show') : t('canvas.hide')} aria-pressed={layer.hidden} onClick={() => toggle(layer.id, 'hidden')}>
              {layer.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button type="button" className={cn('rounded p-1 text-stone-400 hover:text-stone-700', layer.locked ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100')} aria-label={layer.locked ? t('canvas.unlock') : t('canvas.lock')} aria-pressed={layer.locked} onClick={() => toggle(layer.id, 'locked')}>
              {layer.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
