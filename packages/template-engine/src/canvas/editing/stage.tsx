'use client';

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Artboard, Frame, Layer } from '@bulava/template-schema';
import { clampFrame, moveFrame, resizeFrame, rotationFor, snapLines, type Guide, type HandleName } from './geometry';

interface Drag {
  kind: 'move' | 'resize' | 'rotate';
  handle?: HandleName;
  layerId: string;
  startX: number;
  startY: number;
  startFrame: Frame;
  /** Client-space centre of the frame, for rotation. */
  centre: { x: number; y: number };
  moved: boolean;
}

const HANDLES: Array<{ name: HandleName; style: CSSProperties; cursor: string }> = [
  { name: 'nw', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
  { name: 'n', style: { left: '50%', top: 0 }, cursor: 'ns-resize' },
  { name: 'ne', style: { left: '100%', top: 0 }, cursor: 'nesw-resize' },
  { name: 'e', style: { left: '100%', top: '50%' }, cursor: 'ew-resize' },
  { name: 'se', style: { left: '100%', top: '100%' }, cursor: 'nwse-resize' },
  { name: 's', style: { left: '50%', top: '100%' }, cursor: 'ns-resize' },
  { name: 'sw', style: { left: 0, top: '100%' }, cursor: 'nesw-resize' },
  { name: 'w', style: { left: 0, top: '50%' }, cursor: 'ew-resize' },
];

const join = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

/** The rotate handle's arrow (inline: the engine carries no icon library). */
function RotateIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

/**
 * The artboard at a zoom, with a transparent overlay of layer boxes on top:
 * drag to move, handles to resize, the ring to rotate. Frames change live in
 * the overlay's own copy of the board and are committed once on release, so
 * every pointer move does not re-validate the whole definition. Shared by the
 * Studio's Canvas editor and the public card editor; pointer events work for
 * mouse, pen and touch alike (`handleSize` grows the handles for fingers).
 */
export function Stage({
  board,
  zoom,
  selectedId,
  onSelect,
  onCommit,
  snapping,
  renderBoard,
  label,
  handleSize = 10,
  onDoubleClick,
  selectable,
}: {
  board: Artboard;
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (board: Artboard) => void;
  snapping: boolean;
  renderBoard: (board: Artboard) => ReactNode;
  label: string;
  /** CSS pixels: 10 for a mouse, larger on touch screens. */
  handleSize?: number;
  /** A double click (or double tap) on a layer: the card editor opens its text. */
  onDoubleClick?: (id: string) => void;
  /** Which layers can be picked on the canvas (all visible ones by default). */
  selectable?: (layer: Layer) => boolean;
}) {
  const [live, setLive] = useState<Artboard | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const drag = useRef<Drag | null>(null);
  const shown = live ?? board;
  const W = board.width;
  const H = board.height;
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  const selected = shown.layers.find((l) => l.id === selectedId) ?? null;
  const ring = Math.round(handleSize * 2.4);

  const begin = (e: ReactPointerEvent<HTMLElement>, kind: Drag['kind'], layerId: string, handle?: HandleName) => {
    const layer = board.layers.find((l) => l.id === layerId);
    if (!layer || e.button !== 0) return;
    e.stopPropagation();
    onSelect(layerId);
    if (layer.locked) return;
    const box = (e.currentTarget.closest('[data-layer-box]') as HTMLElement | null)?.getBoundingClientRect();
    const centre = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: e.clientX, y: e.clientY };
    drag.current = { kind, handle, layerId, startX: e.clientX, startY: e.clientY, startFrame: { ...layer.frame }, centre, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const update = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (!d.moved && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    d.moved = true;
    const lines = snapLines(board, new Set([d.layerId]));
    const threshold = 6 / zoom;
    const snap = snapping && !e.altKey;
    let next: { frame: Frame; guides: Guide[] };
    if (d.kind === 'move') {
      const axis = e.shiftKey ? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') : null;
      next = moveFrame(d.startFrame, axis === 'y' ? 0 : dx, axis === 'x' ? 0 : dy, lines, threshold, snap);
    } else if (d.kind === 'resize' && d.handle) {
      next = resizeFrame(d.startFrame, d.handle, dx, dy, lines, threshold, snap, e.shiftKey);
    } else {
      next = { frame: { ...d.startFrame, rotate: rotationFor(d.startFrame, d.centre, { x: e.clientX, y: e.clientY }, e.shiftKey) }, guides: [] };
    }
    const frame = clampFrame(next.frame);
    setGuides(next.guides);
    setLive({ ...board, layers: board.layers.map((l) => (l.id === d.layerId ? { ...l, frame } : l)) });
  };

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setGuides([]);
    if (d?.moved && live) onCommit(live);
    setLive(null);
  };

  const handlers = { onPointerMove: update, onPointerUp: end, onPointerCancel: end };

  return (
    <div className="relative shadow-2xl" style={{ width: W * zoom, height: H * zoom }} aria-label={label}>
      <div className="absolute inset-0 overflow-hidden" lang="en">
        {renderBoard(shown)}
      </div>
      {/* Overlay: hit boxes, selection and guides */}
      <div
        className="absolute inset-0"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        {shown.layers.map((layer) => {
          if (layer.hidden || (selectable && !selectable(layer))) return null;
          const f = layer.frame;
          const isSelected = layer.id === selectedId;
          return (
            <div
              key={layer.id}
              data-layer-box
              role="button"
              tabIndex={-1}
              aria-label={layer.name ?? layer.id}
              aria-pressed={isSelected}
              className={join('group absolute touch-none', layer.locked ? 'cursor-default' : 'cursor-move', isSelected ? 'outline-2 outline-brand-600' : 'outline-1 outline-transparent hover:outline-brand-600/40')}
              style={{ left: pct(f.x, W), top: pct(f.y, H), width: pct(f.w, W), height: pct(f.h, H), transform: f.rotate ? `rotate(${f.rotate}deg)` : undefined, outlineStyle: 'solid', zIndex: isSelected ? 2 : 1 }}
              onPointerDown={(e) => begin(e, 'move', layer.id)}
              onDoubleClick={onDoubleClick ? () => onDoubleClick(layer.id) : undefined}
              {...handlers}
            >
              {isSelected && !layer.locked ? (
                <>
                  {HANDLES.map((h) => (
                    <span
                      key={h.name}
                      role="presentation"
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-brand-600 bg-white shadow"
                      style={{ ...h.style, width: handleSize, height: handleSize, cursor: h.cursor, zIndex: 3 }}
                      onPointerDown={(e) => begin(e, 'resize', layer.id, h.name)}
                      {...handlers}
                    />
                  ))}
                  <span className="absolute left-1/2 w-px -translate-x-1/2 bg-brand-600" style={{ top: -ring + 2, height: ring - 4 }} aria-hidden />
                  <span
                    role="presentation"
                    title="Rotate"
                    className="absolute left-1/2 grid -translate-x-1/2 cursor-grab place-items-center rounded-full border border-brand-600 bg-white text-brand-600 shadow"
                    style={{ top: -ring - handleSize * 1.2, width: handleSize * 2.2, height: handleSize * 2.2, zIndex: 3 }}
                    onPointerDown={(e) => begin(e, 'rotate', layer.id)}
                    {...handlers}
                  >
                    <RotateIcon size={Math.round(handleSize * 1.3)} />
                  </span>
                </>
              ) : null}
            </div>
          );
        })}
        {guides.map((g, i) => (
          <span
            key={`${g.axis}${g.at}${i}`}
            aria-hidden
            className="pointer-events-none absolute bg-sky-500"
            style={g.axis === 'x' ? { left: pct(g.at, W), top: 0, bottom: 0, width: 1 } : { top: pct(g.at, H), left: 0, right: 0, height: 1 }}
          />
        ))}
        {selected ? (
          <span
            aria-hidden
            className="pointer-events-none absolute rounded bg-stone-900/85 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums"
            style={{ left: pct(selected.frame.x + selected.frame.w / 2, W), top: `calc(${pct(selected.frame.y + selected.frame.h, H)} + 6px)`, transform: 'translateX(-50%)', zIndex: 4 }}
          >
            {Math.round(selected.frame.x)}, {Math.round(selected.frame.y)} · {Math.round(selected.frame.w)} × {Math.round(selected.frame.h)}
            {selected.frame.rotate ? ` · ${selected.frame.rotate}°` : ''}
          </span>
        ) : null}
      </div>
    </div>
  );
}
