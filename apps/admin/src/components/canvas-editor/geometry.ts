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
    default:
      return 'Layer';
  }
}
