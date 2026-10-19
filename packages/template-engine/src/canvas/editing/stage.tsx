'use client';

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Artboard, Frame, Layer } from '@bulava/template-schema';
import { boundsOf, clampFrame, moveFrame, resizeFrame, rotationFor, scaleFrame, snapLines, touches, type Guide, type HandleName } from './geometry';

interface Drag {
  kind: 'move' | 'resize' | 'rotate' | 'group-resize';
  handle?: HandleName;
  /** The layer grabbed (move, resize, rotate of one layer). */
  layerId: string;
  /** Every layer that moves with it, and where each started. */
  starts: Map<string, Frame>;
  startX: number;
  startY: number;
  startFrame: Frame;
  /** Client-space centre of the frame, for rotation. */
  centre: { x: number; y: number };
  moved: boolean;
}

interface Marquee {
  /** Board units. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  add: boolean;
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
const CORNER = new Set<HandleName>(['nw', 'ne', 'se', 'sw']);

/** The rotate handle's arrow (inline: the engine carries no icon library). */
function RotateIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

/** A layer and the others of its group (layers sharing `group` are picked together). */
function withGroup(board: Artboard, id: string): string[] {
  const layer = board.layers.find((l) => l.id === id);
  if (!layer?.group) return [id];
  return board.layers.filter((l) => l.group === layer.group && !l.hidden).map((l) => l.id);
}

/**
 * The artboard at a zoom, with a transparent overlay of layer boxes on top:
 * drag to move, handles to resize, the ring to rotate. Frames change live in
 * the overlay's own copy of the board and are committed once on release, so
 * every pointer move does not re-validate the whole definition. Shared by the
 * Studio's Design Studio and the public editors; pointer events work for
 * mouse, pen and touch alike (`handleSize` grows the handles for fingers).
 *
 * With `selection` the stage picks several layers (the Design Studio):
 * Shift, Ctrl or ⌘ adds a layer to the selection, dragging over empty board
 * draws a marquee, the selection moves together and resizes as one (its
 * corners keep proportions and scale the lettering with it); a layer in a
 * group brings the rest of the group. Without it, one layer at a time.
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
  flat,
  selection,
  onSelection,
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
  /** A double click (or double tap) on a layer: the editors open its text. */
  onDoubleClick?: (id: string) => void;
  /** Which layers can be picked on the canvas (all visible ones by default). */
  selectable?: (layer: Layer) => boolean;
  /** Part of a page (the website's canvas editor): no shadow of its own. */
  flat?: boolean;
  /** Several layers picked at once (see above); `selectedId` is then ignored. */
  selection?: readonly string[];
  onSelection?: (ids: string[]) => void;
}) {
  const [live, setLive] = useState<Artboard | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const drag = useRef<Drag | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const shown = live ?? board;
  const W = board.width;
  const H = board.height;
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  const multi = !!selection && !!onSelection;
  const picked: readonly string[] = multi ? selection! : selectedId ? [selectedId] : [];
  const pickedLayers = shown.layers.filter((l) => picked.includes(l.id) && !l.hidden);
  const single = pickedLayers.length === 1 ? pickedLayers[0]! : null;
  const many = multi && pickedLayers.length > 1;
  const groupBox = many ? boundsOf(pickedLayers.map((l) => l.frame)) : null;
  const ring = Math.round(handleSize * 2.4);
  const canPick = (l: Layer) => !l.hidden && (!selectable || selectable(l));

  const choose = (ids: string[]) => {
    if (multi) onSelection!(ids);
    else onSelect(ids[0] ?? null);
  };

  /** Board units of a pointer. */
  const pointAt = (e: { clientX: number; clientY: number }) => {
    const r = overlay.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const begin = (e: ReactPointerEvent<HTMLElement>, kind: Drag['kind'], layerId: string, handle?: HandleName) => {
    const layer = board.layers.find((l) => l.id === layerId);
    if (e.button !== 0 || (!layer && kind !== 'group-resize')) return;
    e.stopPropagation();
    let ids: string[];
    if (kind === 'group-resize') ids = [...picked];
    else if (multi && (e.shiftKey || e.ctrlKey || e.metaKey) && kind === 'move') {
      // Add to (or take out of) the selection; nothing moves.
      const group = withGroup(board, layerId);
      const has = picked.includes(layerId);
      onSelection!(has ? picked.filter((id) => !group.includes(id)) : [...picked, ...group.filter((id) => !picked.includes(id))]);
      return;
    } else if (kind === 'move' && multi && picked.includes(layerId)) ids = [...picked];
    else ids = multi && kind === 'move' ? withGroup(board, layerId) : [layerId];
    if (kind !== 'group-resize' && !(multi && picked.includes(layerId) && kind === 'move')) choose(ids);
    if (kind !== 'group-resize' && layer?.locked) return;
    const movable = board.layers.filter((l) => ids.includes(l.id) && !l.locked);
    if (!movable.length) return;
    const box = (e.currentTarget.closest('[data-layer-box]') as HTMLElement | null)?.getBoundingClientRect();
    const centre = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: e.clientX, y: e.clientY };
    const startFrame = kind === 'group-resize' || movable.length > 1 ? boundsOf(movable.map((l) => l.frame)) : { ...layer!.frame };
    drag.current = { kind, handle, layerId, starts: new Map(movable.map((l) => [l.id, { ...l.frame }])), startX: e.clientX, startY: e.clientY, startFrame, centre, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const update = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (!d.moved && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    d.moved = true;
    const lines = snapLines(board, new Set(d.starts.keys()));
    const threshold = 6 / zoom;
    const snap = snapping && !e.altKey;
    if (d.kind === 'move' && d.starts.size > 1) {
      const axis = e.shiftKey ? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') : null;
      const next = moveFrame(d.startFrame, axis === 'y' ? 0 : dx, axis === 'x' ? 0 : dy, lines, threshold, snap);
      const ox = next.frame.x - d.startFrame.x;
      const oy = next.frame.y - d.startFrame.y;
      setGuides(next.guides);
      setLive({ ...board, layers: board.layers.map((l) => (d.starts.has(l.id) ? { ...l, frame: clampFrame({ ...d.starts.get(l.id)!, x: d.starts.get(l.id)!.x + ox, y: d.starts.get(l.id)!.y + oy }) } : l)) });
      return;
    }
    if (d.kind === 'group-resize' && d.handle) {
      const keep = CORNER.has(d.handle) || e.shiftKey;
      const next = resizeFrame(d.startFrame, d.handle, dx, dy, lines, threshold, snap, keep);
      const k = d.startFrame.w ? next.frame.w / d.startFrame.w : 1;
      setGuides(next.guides);
      setLive({
        ...board,
        layers: board.layers.map((l) => {
          const start = d.starts.get(l.id);
          if (!start) return l;
          const frame = clampFrame(scaleFrame(start, d.startFrame, next.frame));
          // Proportional: the lettering grows with the group, as everything else does.
          if (keep && l.kind === 'text' && l.style) return { ...l, frame, style: { ...l.style, size: Math.min(600, Math.max(6, Math.round(l.style.size * k * 10) / 10)) } };
          return { ...l, frame };
        }),
      });
      return;
    }
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

  // The marquee: drawn over empty board, picks every layer it touches.
  const marqueeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    if (!multi) {
      onSelect(null);
      return;
    }
    const p = pointAt(e);
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey || e.ctrlKey || e.metaKey, moved: false });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const marqueeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!marquee) return;
    const p = pointAt(e);
    const moved = marquee.moved || Math.abs(p.x - marquee.x0) * zoom > 3 || Math.abs(p.y - marquee.y0) * zoom > 3;
    setMarquee({ ...marquee, x1: p.x, y1: p.y, moved });
  };
  const marqueeEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marquee;
    setMarquee(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!m || !multi) return;
    if (!m.moved) {
      if (!m.add) onSelection!([]);
      return;
    }
    const rect = { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0), rotate: 0 };
    const hit = board.layers.filter((l) => canPick(l) && !l.locked && touches(l.frame, rect)).map((l) => l.id);
    onSelection!(m.add ? [...new Set([...picked, ...hit])] : hit);
  };

  return (
    <div className={join('relative', !flat && 'shadow-2xl')} style={{ width: W * zoom, height: H * zoom }} aria-label={label}>
      <div className="absolute inset-0 overflow-hidden" lang="en">
        {renderBoard(shown)}
      </div>
      {/* Overlay: hit boxes, selection and guides */}
      <div ref={overlay} className="absolute inset-0" onPointerDown={marqueeStart} onPointerMove={marqueeMove} onPointerUp={marqueeEnd} onPointerCancel={marqueeEnd}>
        {shown.layers.map((layer) => {
          if (!canPick(layer)) return null;
          const f = layer.frame;
          const isSelected = picked.includes(layer.id);
          const handles = isSelected && single?.id === layer.id && !layer.locked;
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
              {handles ? (
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
        {groupBox ? (
          <div
            data-layer-box
            aria-hidden
            className="pointer-events-none absolute outline-1 outline-brand-600 outline-dashed"
            style={{ left: pct(groupBox.x, W), top: pct(groupBox.y, H), width: pct(groupBox.w, W), height: pct(groupBox.h, H), zIndex: 3 }}
          >
            {HANDLES.map((h) => (
              <span
                key={h.name}
                role="presentation"
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-brand-600 bg-white shadow"
                style={{ ...h.style, width: handleSize, height: handleSize, cursor: h.cursor, zIndex: 4 }}
                onPointerDown={(e) => begin(e, 'group-resize', single?.id ?? picked[0]!, h.name)}
                {...handlers}
              />
            ))}
          </div>
        ) : null}
        {marquee?.moved ? (
          <span
            aria-hidden
            className="pointer-events-none absolute border border-brand-600 bg-brand-600/10"
            style={{ left: pct(Math.min(marquee.x0, marquee.x1), W), top: pct(Math.min(marquee.y0, marquee.y1), H), width: pct(Math.abs(marquee.x1 - marquee.x0), W), height: pct(Math.abs(marquee.y1 - marquee.y0), H), zIndex: 5 }}
          />
        ) : null}
        {guides.map((g, i) => (
          <span
            key={`${g.axis}${g.at}${i}`}
            aria-hidden
            className="pointer-events-none absolute bg-sky-500"
            style={g.axis === 'x' ? { left: pct(g.at, W), top: 0, bottom: 0, width: 1 } : { top: pct(g.at, H), left: 0, right: 0, height: 1 }}
          />
        ))}
        {single || groupBox ? (
          <span
            aria-hidden
            className="pointer-events-none absolute rounded bg-stone-900/85 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums"
            style={(() => {
              const f = groupBox ?? single!.frame;
              return { left: pct(f.x + f.w / 2, W), top: `calc(${pct(f.y + f.h, H)} + 6px)`, transform: 'translateX(-50%)', zIndex: 4 };
            })()}
          >
            {(() => {
              const f = groupBox ?? single!.frame;
              return `${Math.round(f.x)}, ${Math.round(f.y)} · ${Math.round(f.w)} × ${Math.round(f.h)}${!groupBox && f.rotate ? ` · ${f.rotate}°` : ''}${groupBox ? ` · ${pickedLayers.length}` : ''}`;
            })()}
          </span>
        ) : null}
      </div>
    </div>
  );
}
