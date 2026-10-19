import type { Artboard, Frame, Layer } from '@bulava/template-schema';

export type HandleName = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface Guide {
  axis: 'x' | 'y';
  /** Design units. */
  at: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Candidate lines a frame edge or centre may snap to: the artboard's edges and centre, and every other layer's. */
export function snapLines(board: Pick<Artboard, 'width' | 'height' | 'layers'>, except: ReadonlySet<string>): { x: number[]; y: number[] } {
  const x = [0, board.width / 2, board.width];
  const y = [0, board.height / 2, board.height];
  for (const l of board.layers) {
    if (except.has(l.id) || l.hidden) continue;
    x.push(l.frame.x, l.frame.x + l.frame.w / 2, l.frame.x + l.frame.w);
    y.push(l.frame.y, l.frame.y + l.frame.h / 2, l.frame.y + l.frame.h);
  }
  return { x, y };
}

function nearest(value: number, lines: number[], threshold: number): number | null {
  let best: number | null = null;
  let dist = threshold;
  for (const line of lines) {
    const d = Math.abs(line - value);
    if (d < dist) {
      dist = d;
      best = line;
    }
  }
  return best;
}

/** Move a frame by (dx, dy), snapping its edges and centre to the lines; returns the frame and the guides to draw. */
export function moveFrame(frame: Frame, dx: number, dy: number, lines: { x: number[]; y: number[] }, threshold: number, snap: boolean): { frame: Frame; guides: Guide[] } {
  let x = frame.x + dx;
  let y = frame.y + dy;
  const guides: Guide[] = [];
  if (snap) {
    for (const [offset] of [[0], [frame.w / 2], [frame.w]] as const) {
      const line = nearest(x + offset, lines.x, threshold);
      if (line !== null) {
        x = line - offset;
        guides.push({ axis: 'x', at: line });
        break;
      }
    }
    for (const [offset] of [[0], [frame.h / 2], [frame.h]] as const) {
      const line = nearest(y + offset, lines.y, threshold);
      if (line !== null) {
        y = line - offset;
        guides.push({ axis: 'y', at: line });
        break;
      }
    }
  }
  return { frame: { ...frame, x: round(x), y: round(y) }, guides };
}

/**
 * Resize by dragging one handle. The drag vector is expressed in the layer's
 * own (rotated) axes, so a rotated layer grows along its sides.
 */
export function resizeFrame(frame: Frame, handle: HandleName, dx: number, dy: number, lines: { x: number[]; y: number[] }, threshold: number, snap: boolean, keepRatio: boolean, min = 4): { frame: Frame; guides: Guide[] } {
  const rad = (-(frame.rotate ?? 0) * Math.PI) / 180;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  let { x, y, w, h } = frame;
  const guides: Guide[] = [];
  const east = handle.includes('e');
  const west = handle.includes('w');
  const south = handle.includes('s');
  const north = handle.includes('n');
  if (east) w = Math.max(min, frame.w + lx);
  if (west) {
    w = Math.max(min, frame.w - lx);
    x = frame.x + (frame.w - w);
  }
  if (south) h = Math.max(min, frame.h + ly);
  if (north) {
    h = Math.max(min, frame.h - ly);
    y = frame.y + (frame.h - h);
  }
  if (keepRatio && (east || west) && (north || south)) {
    const ratio = frame.w / frame.h;
    if (Math.abs(lx) > Math.abs(ly)) {
      const nh = Math.max(min, w / ratio);
      if (north) y += h - nh;
      h = nh;
    } else {
      const nw = Math.max(min, h * ratio);
      if (west) x += w - nw;
      w = nw;
    }
  }
  if (snap && !frame.rotate) {
    if (east) {
      const line = nearest(x + w, lines.x, threshold);
      if (line !== null) {
        w = Math.max(min, line - x);
        guides.push({ axis: 'x', at: line });
      }
    } else if (west) {
      const line = nearest(x, lines.x, threshold);
      if (line !== null) {
        w = Math.max(min, x + w - line);
        x = line;
        guides.push({ axis: 'x', at: line });
      }
    }
    if (south) {
      const line = nearest(y + h, lines.y, threshold);
      if (line !== null) {
        h = Math.max(min, line - y);
        guides.push({ axis: 'y', at: line });
      }
    } else if (north) {
      const line = nearest(y, lines.y, threshold);
      if (line !== null) {
        h = Math.max(min, y + h - line);
        y = line;
        guides.push({ axis: 'y', at: line });
      }
    }
  }
  return { frame: { ...frame, x: round(x), y: round(y), w: round(w), h: round(h) }, guides };
}

/** Angle of the pointer around the frame's centre, snapped to 15° steps with Shift. */
export function rotationFor(frame: Frame, centre: { x: number; y: number }, pointer: { x: number; y: number }, step: boolean): number {
  const angle = (Math.atan2(pointer.y - centre.y, pointer.x - centre.x) * 180) / Math.PI + 90;
  let deg = ((angle + 180) % 360) - 180;
  if (step) deg = Math.round(deg / 15) * 15;
  if (Math.abs(deg) < 2) deg = 0;
  return Math.round(deg);
}

export function clampFrame(frame: Frame): Frame {
  return {
    ...frame,
    x: Math.min(8000, Math.max(-4000, frame.x)),
    y: Math.min(8000, Math.max(-4000, frame.y)),
    w: Math.min(8000, Math.max(1, frame.w)),
    h: Math.min(8000, Math.max(1, frame.h)),
    rotate: Math.min(360, Math.max(-360, frame.rotate ?? 0)),
  };
}

/** A readable name for the layer list. */
export function layerLabel(layer: Layer): string {
  if (layer.name) return layer.name;
  switch (layer.kind) {
    case 'text': {
      const c = layer.content;
      if ('literal' in c) return String(c.literal).slice(0, 28) || 'Text';
      if ('binding' in c) return c.binding;
      if ('t' in c) return c.t.replace(/^template\./, '');
      return c.template.slice(0, 28);
    }
    case 'image':
      return layer.source.type === 'asset' ? 'Image' : layer.source.binding;
    case 'shape':
      return layer.shape;
    case 'ornament':
      return layer.ornament;
    case 'icon':
      return layer.icon;
    case 'widget':
      return layer.widget.type;
    case 'scene':
      return `scene · ${layer.scene}`;
    case 'section':
      return `section · ${layer.section}`;
    default:
      return 'Layer';
  }
}

// ─────────────────────────── Several layers at once ───────────────────────────

/** The axis-aligned box around a frame as drawn (a rotated frame's corners included). */
export function frameBox(frame: Frame): Frame {
  const deg = frame.rotate ?? 0;
  if (!deg) return { x: frame.x, y: frame.y, w: frame.w, h: frame.h, rotate: 0 };
  const rad = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  const w = frame.w * c + frame.h * s;
  const h = frame.w * s + frame.h * c;
  return { x: frame.x + frame.w / 2 - w / 2, y: frame.y + frame.h / 2 - h / 2, w, h, rotate: 0 };
}

/** The box around several frames (as drawn). */
export function boundsOf(frames: readonly Frame[]): Frame {
  if (!frames.length) return { x: 0, y: 0, w: 0, h: 0, rotate: 0 };
  const boxes = frames.map(frameBox);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y, rotate: 0 };
}

/** Whether a frame (as drawn) touches a rectangle: what a marquee picks. */
export function touches(frame: Frame, rect: Frame): boolean {
  const b = frameBox(frame);
  return b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y;
}

/** A frame inside `from` moved and scaled as `from` becomes `to` (a group resized). */
export function scaleFrame(frame: Frame, from: Frame, to: Frame): Frame {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  return { ...frame, x: round(to.x + (frame.x - from.x) * sx), y: round(to.y + (frame.y - from.y) * sy), w: round(Math.max(1, frame.w * sx)), h: round(Math.max(1, frame.h * sy)) };
}

export type AlignMode = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';

/** Frames lined up along one edge or centre of `to` (the selection's box, or the board). */
export function alignFrames(frames: readonly Frame[], mode: AlignMode, to: Frame): Frame[] {
  return frames.map((f) => {
    const b = frameBox(f);
    const dx = mode === 'left' ? to.x - b.x : mode === 'right' ? to.x + to.w - (b.x + b.w) : mode === 'centre' ? to.x + to.w / 2 - (b.x + b.w / 2) : 0;
    const dy = mode === 'top' ? to.y - b.y : mode === 'bottom' ? to.y + to.h - (b.y + b.h) : mode === 'middle' ? to.y + to.h / 2 - (b.y + b.h / 2) : 0;
    return { ...f, x: round(f.x + dx), y: round(f.y + dy) };
  });
}

/** Frames spaced evenly between the first and the last along an axis (their order on it kept). */
export function distributeFrames(frames: readonly Frame[], axis: 'x' | 'y'): Frame[] {
  if (frames.length < 3) return [...frames];
  const boxes = frames.map(frameBox);
  const order = boxes.map((b, i) => ({ b, i })).sort((p, q) => (axis === 'x' ? p.b.x - q.b.x : p.b.y - q.b.y));
  const size = (b: Frame) => (axis === 'x' ? b.w : b.h);
  const start = (b: Frame) => (axis === 'x' ? b.x : b.y);
  const first = order[0]!.b;
  const last = order[order.length - 1]!.b;
  const span = start(last) + size(last) - start(first);
  const gap = (span - order.reduce((sum, o) => sum + size(o.b), 0)) / (order.length - 1);
  const out = [...frames];
  let at = start(first);
  for (const { b, i } of order) {
    const delta = at - start(b);
    const f = frames[i]!;
    out[i] = axis === 'x' ? { ...f, x: round(f.x + delta) } : { ...f, y: round(f.y + delta) };
    at += size(b) + gap;
  }
  return out;
}
