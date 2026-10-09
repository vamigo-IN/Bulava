import type { ArtboardInput, CanvasSectionInput, LayerInput } from '@bulava/template-schema';
import { at, b, cardButtons, eyebrows, lit, orn, photo, scene, sec, shape, t, text, widget, type Frame } from '../canvas-kit';
import {
  art,
  aspectOf,
  CITY,
  cityStyle,
  DATE,
  dateStyle,
  eyebrowStyle,
  fit,
  fitCentre,
  ink,
  isRound,
  MONOGRAM,
  NAMES,
  nameStyle,
  round,
  SCHEDULE,
  softInk,
  stock,
  TAGLINE,
  crestOf,
  type Art,
  type CardStyle,
  type Composition,
  type Kit,
  type Occasion,
} from './kit';

/**
 * Layouts for the template factory: each lays a theme's kit out on the phone
 * (390 × 844) and desktop (1440 × 900) artboards and picks the function card.
 * They come from the hand-tuned card collection (canvas-cards.ts): zones are
 * fixed (art along the top, text in the middle, art along the bottom), so any
 * kit fits without overlaps; missing pieces are simply left out.
 */

const MOBILE = { width: 390, height: 844 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;
const fade = (delaySec = 0) => ({ animation: { entrance: 'fade' as const, delaySec } });
const up = (delaySec = 0) => ({ animation: { entrance: 'fadeUp' as const, delaySec } });

// ─────────────────────────── Shared pieces ───────────────────────────

function names(kit: Kit, frame: Frame, size: number, align: 'left' | 'center' = 'center'): LayerInput {
  return text('names', NAMES, frame, nameStyle(kit, size, align), { animation: { entrance: 'fadeUp', delaySec: 0.3, ...(kit.foil ? { motion: 'shimmer' as const } : {}) } });
}

function dateCity(kit: Kit, y: number, x: number, w: number, size: number, align: 'left' | 'center' = 'center', dateFormat: 'dateWithWeekday' | 'date' = 'dateWithWeekday'): LayerInput[] {
  const lineH = Math.round(size * 1.55);
  return [
    text('date', b('event.startDate', { format: dateFormat }), at(x, y, w, lineH), dateStyle(kit, size, align), { overflow: 'shrink', ...up(0.45) }),
    text('city', CITY, at(x + (align === 'center' ? 10 : 0), y + lineH + 2, w - (align === 'center' ? 20 : 0), Math.round(size * 1.2)), cityStyle(kit, Math.round(size * 0.66), align), { visibleWhen: { exists: 'venue.city' }, ...up(0.5) }),
  ];
}

function countdown(kit: Kit, frame: Frame, size: number, variant: 'boxes' | 'inline' = 'boxes'): LayerInput {
  const boxes = variant === 'boxes';
  return widget(
    'countdown',
    { type: 'countdown', variant, size, color: kit.dark && boxes ? 'primary' : ink(kit), labelColor: kit.dark ? (boxes ? 'primary' : 'accent') : 'muted', boxColor: kit.dark ? 'accent' : 'surface', font: 'heading' },
    frame,
    up(0.6),
  );
}

function rsvp(frame: Frame, fill: 'accent' | 'primary' = 'accent', size = 13): LayerInput {
  return widget('rsvp', { type: 'button', label: t('rsvp.title'), action: 'rsvp', icon: 'heart', fill, color: 'surface', size, weight: 700, font: 'body', radius: 50, shadow: true }, frame, { animation: { entrance: 'pop', delaySec: 0.6 } });
}

/** Mirrored art in both top corners. */
function corners(kit: Kit, a: Art | undefined, width: number, y = -22, boardWidth = 390, bottom = false, boardHeight = 844): LayerInput[] {
  if (!a) return [];
  const aspect = aspectOf(a.name);
  const w = aspect >= 1 ? Math.round(width * 1.6) : width;
  const h = Math.round(w / aspect);
  const tilt = aspect < 1 ? 16 : 0;
  const top = bottom ? boardHeight - h - y : y;
  return [
    art('corner-l', a, at(-Math.round(w * 0.22), top, w, h, bottom ? 180 + tilt : -tilt), { flipX: bottom, animation: { entrance: 'fadeDown', motion: 'sway' } }),
    art('corner-r', a, at(boardWidth - Math.round(w * 0.78), top, w, h, bottom ? 180 - tilt : tilt), { flipX: !bottom, animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'sway' } }),
  ];
}

/**
 * A host photo over a shape. Until the host adds one, art stands in (when given)
 * or the couple's monogram, so the frame never looks empty.
 */
function photoSlot(frame: Frame, mask: 'arch' | 'circle' | 'ellipse' | 'rounded', fallback?: Art, extra: { radius?: number; border?: number } = {}): LayerInput[] {
  const shapeKind = mask === 'circle' ? 'ellipse' : mask === 'rounded' ? 'rect' : mask;
  const layers: LayerInput[] = [shape('photo-bg', shapeKind, frame, { fill: { type: 'gradient', gradient: { from: 'accent', to: 'primary', angle: 160 } }, ...(mask === 'rounded' ? { radius: extra.radius ?? 28 } : {}) })];
  if (fallback) layers.push(art('photo-art', fallback, fit(fallback.name, frame.x + frame.w / 2, frame.y + frame.h - 4, frame.w * 0.9, frame.h * 0.92)));
  else {
    const size = Math.round(Math.min(frame.w * 0.3, frame.h * 0.24));
    const y = mask === 'arch' ? frame.y + frame.h * 0.56 : frame.y + frame.h / 2;
    layers.push(
      text('photo-monogram', MONOGRAM, at(frame.x + 6, Math.round(y - size * 0.7), frame.w - 12, Math.round(size * 1.4)), { font: 'heading', size, weight: 600, color: 'surface', letterSpacing: 0.04, shadow: 'soft', contrast: false }, fade(0.3)),
    );
  }
  layers.push(photo('photo', 'photo.cover', frame, { mask, ...(mask === 'rounded' ? { radius: extra.radius ?? 28 } : {}), border: { width: extra.border ?? 3, color: 'surface' }, animation: { entrance: 'zoomIn', delaySec: 0.1 } }));
  return layers;
}

/** Two rose clusters rising from the phone board's bottom corners (garden themes' foot). */
function rosesAtFoot(roses: Art): LayerInput[] {
  return [
    art('bottom-l', roses, fit(roses.name, 96, 870, 214, 184), { flipY: true, animation: { entrance: 'fadeUp', delaySec: 0.4, motion: 'sway' } }),
    art('bottom-r', roses, fit(roses.name, 294, 870, 214, 184), { flipX: true, flipY: true, animation: { entrance: 'fadeUp', delaySec: 0.5, motion: 'sway' } }),
  ];
}

function wash(kit: Kit, frame: Frame, opacity = 0.3): LayerInput {
  return shape('wash', 'ellipse', frame, { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', to: kit.dark ? 'primary' : 'background' } }, opacity: kit.dark ? opacity * 0.6 : opacity });
}

/** Hanging strings at the sides (marigold, jasmine) or lanterns. */
function hangs(kit: Kit, positions: Array<[number, number]>, boardTop = 30): LayerInput[] {
  const h = kit.hang;
  if (!h) return [];
  if (h.name === 'lantern') {
    return positions.map(([x, length], i) => {
      const len = Math.min(length, 112);
      return art(`hang-${i + 1}`, { ...h, tint: h.tint ?? 'secondary' }, at(x - Math.round(len * 0.2), -6, Math.round(len * 0.4), Math.round(len * 0.8)), { shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: sec(0.1 + i * 0.08), motion: 'sway' } });
    });
  }
  if (h.name === 'templeBells') return [];
  return positions.map(([x, len], i) => art(`hang-${i + 1}`, h, at(x - 12, boardTop, 24, len), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.06), motion: 'sway' } }));
}

function topBand(kit: Kit, width: number, height: number): LayerInput[] {
  const tp = kit.top;
  if (!tp) return [];
  const isBorder = tp.name === 'templeBorder';
  if (width <= 420) return [art('top', tp, at(-14, isBorder ? 0 : -10, width + 28, isBorder ? 34 : height), { animation: { entrance: 'fadeDown', motion: isBorder ? 'none' : 'sway' } })];
  const pieces = Math.ceil(width / 366);
  return Array.from({ length: pieces }, (_, i) => art(`top-${i + 1}`, tp, at(-14 + i * 366, isBorder ? 0 : -12, 372, isBorder ? 40 : height), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.08), motion: isBorder ? 'none' : 'sway' } }));
}

function invocation(kit: Kit, frame: Frame, size = 14, align: 'left' | 'center' = 'center'): LayerInput[] {
  return kit.invocation ? [text('invocation', lit(kit.invocation), frame, { font: 'Tiro Devanagari Hindi', size, color: kit.dark ? 'accent' : 'primary', align }, fade(0.15))] : [];
}

const board = (kit: Kit, layers: Array<LayerInput | LayerInput[] | false | null | undefined>, desktop = false): ArtboardInput => ({
  ...(desktop ? DESKTOP : MOBILE),
  ...stock(kit, desktop),
  layers: layers.flatMap((l) => (Array.isArray(l) ? l : l ? [l] : [])),
});

// ─────────────────────────── Function cards ───────────────────────────

function cardText(kit: Kit, y: number, descH = 40): LayerInput[] {
  return [
    text('eyebrow', SCHEDULE, at(40, y, 310, 18), { font: 'body', size: 10, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' }, fade()),
    text('name', b('function.name'), at(24, y + 18, 342, 70), { font: kit.nameFont, size: kit.nameFont === 'heading' ? 34 : 44, weight: kit.nameFont === 'heading' ? 700 : 400, color: 'primary', lineHeight: 1.06 }, up(0.1)),
    text('description', b('function.description'), at(44, y + 90, 302, descH), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
  ];
}

const details = (y: number, iconCircle: 'primary' | 'accent' = 'primary', divider: 'secondary' | 'muted' | 'accent' = 'secondary'): LayerInput =>
  widget(
    'details',
    { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: iconCircle === 'accent' ? 'primary' : 'surface', iconCircle, labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: divider },
    at(40, y, 310, 228),
    up(0.2),
  );

function cardFor(kit: Kit, style: CardStyle, occ: Occasion): CanvasSectionInput {
  const base = { background: { type: 'color' as const, color: 'surface' as const }, texture: kit.texture === 'none' ? ('paper' as const) : kit.texture, textureStrength: Math.min(0.5, kit.strength) };
  let mobile: ArtboardInput;
  switch (style) {
    case 'framed':
      mobile = {
        width: 390,
        height: 640,
        ...base,
        layers: [
          orn('frame', 'ornateFrame', at(10, 10, 370, 620), { color: 'secondary', foil: true }),
          art('crest', round(kit.centre, { name: 'medallion', foil: true }), at(158, 26, 74, 74), { animation: { entrance: 'zoomIn', motion: 'spin' } }),
          ...cardText(kit, 106),
          orn('flourish', 'flourish', at(115, 242, 160, 32), { color: 'secondary', foil: true }),
          details(282, 'primary', 'secondary'),
          ...cardButtons(522, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
          ...(kit.pair ? [art('pair-l', kit.pair, fit(kit.pair.name, 56, 628, 66, 54)), art('pair-r', kit.pair, fit(kit.pair.name, 334, 628, 66, 54), { flipX: true })] : []),
        ],
      };
      break;
    case 'banded':
      mobile = {
        width: 390,
        height: 620,
        ...base,
        layers: [
          shape('band-top', 'rect', at(0, 0, 390, 46), { fill: { type: 'color', color: 'primary' } }),
          orn('border-top', 'templeBorder', at(-4, 12, 398, 34), { color: 'secondary', foil: true }),
          shape('band-bottom', 'rect', at(0, 586, 390, 34), { fill: { type: 'color', color: 'primary' } }),
          orn('border-bottom', 'templeBorder', at(-4, 586, 398, 30), { color: 'secondary', foil: true, flipY: true }),
          art('crest', round(kit.centre, { name: 'kolam', tint: 'primary' }), at(95, 210, 200, 200), { opacity: 0.07 }),
          orn('bells', 'templeBells', at(155, 44, 80, 80), { color: 'secondary', animation: { entrance: 'fadeDown', motion: 'sway' } }),
          ...cardText(kit, 126),
          details(256, 'primary', 'secondary'),
          ...cardButtons(500, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary', radius: 12 }),
        ],
      };
      break;
    case 'garland':
      mobile = {
        width: 390,
        height: 630,
        ...base,
        layers: [
          art('garland', kit.top ?? { name: 'floralGarland', tint: '#6b8f6e' }, at(-14, -10, 418, 116), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
          art('crest', crestOf(kit, occ), fitCentre(crestOf(kit, occ).name, 195, 132, 70, 46), { animation: { entrance: 'zoomIn', delaySec: 0.1 } }),
          ...cardText(kit, 160),
          details(290, 'accent', 'accent'),
          ...cardButtons(532, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
        ],
      };
      break;
    case 'header':
      mobile = {
        width: 390,
        height: 600,
        background: { type: 'color', color: 'surface' },
        layers: [
          shape('wash', 'rect', at(0, 0, 390, 150), { fill: { type: 'gradient', gradient: { from: 'primary', via: 'secondary', to: 'accent', angle: 120 } }, opacity: 0.95 }),
          orn('confetti', 'confetti', at(-10, -20, 410, 200), { color: 'surface', opacity: 0.45 }),
          ...(kit.top ? [art('bunting', kit.top, at(0, -4, 390, 70))] : []),
          text('eyebrow', SCHEDULE, at(40, 66, 310, 18), { font: 'body', size: 10, weight: 700, color: 'surface', letterSpacing: 0.3, transform: 'upper' }),
          text('name', b('function.name'), at(24, 84, 342, 56), { font: 'heading', size: 32, weight: 800, color: 'surface', lineHeight: 1.05 }, up(0.1)),
          text('description', b('function.description'), at(44, 160, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
          details(208, 'primary', 'muted'),
          ...cardButtons(452, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary', radius: 14 }),
          ...(kit.pair ? [art('pair', kit.pair, fit(kit.pair.name, 330, 596, 70, 90))] : []),
          ...(kit.hero ? [art('hero', kit.hero, fit(kit.hero.name, 56, 596, 70, 80))] : []),
        ],
      };
      break;
    case 'sky':
      mobile = {
        width: 390,
        height: 600,
        ...base,
        layers: [
          shape('sky', 'rect', at(0, 0, 390, 130), { fill: { type: 'gradient', gradient: { from: 'background', to: 'accent', angle: 180 } } }),
          orn('stars', 'stars', at(0, 0, 390, 130), { color: 'secondary', opacity: 0.85, animation: { motion: 'twinkle' } }),
          art('moon', kit.float ?? { name: 'moonCloud' }, fitCentre((kit.float ?? { name: 'moonCloud' }).name, 195, 62, 130, 104), { animation: { motion: 'float' } }),
          ...cardText(kit, 142),
          details(270, 'primary', 'accent'),
          ...cardButtons(512, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
        ],
      };
      break;
    default:
      mobile = {
        width: 390,
        height: 600,
        ...base,
        layers: [
          shape('line-o', 'rect', at(14, 14, 362, 572), { fill: { type: 'none' }, stroke: { width: 1.2, color: 'secondary' } }),
          shape('line-i', 'rect', at(22, 22, 346, 556), { fill: { type: 'none' }, stroke: { width: 0.6, color: 'secondary' } }),
          art('crest', kit.motif, fitCentre(kit.motif.name, 195, 66, 130, 40)),
          ...cardText(kit, 96),
          details(236, 'primary', 'secondary'),
          ...cardButtons(480, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary', radius: 8 }),
        ],
      };
  }
  return { mobile, desktopMaxWidth: 520, repeatPerFunction: true };
}

// ─────────────────────────── Compositions ───────────────────────────

/** Arch: the photo in a gilded arch, the names beneath, and the hero art rising from the bottom. */
const arch: Composition = {
  key: 'arch',
  build(kit, occ) {
    const bottomArt = kit.hero ?? kit.pair;
    const mobile = board(kit, [
      wash(kit, at(-60, 500, 510, 460)),
      kit.sky && kit.dark ? art('sky', kit.sky, at(0, 0, 390, 360), { opacity: 0.7, animation: { entrance: 'fade', motion: 'twinkle' } }) : null,
      corners(kit, kit.corner, 120),
      photoSlot(at(118, 78, 154, 216), 'arch'),
      orn('arch', 'archFrame', at(104, 62, 182, 248), { color: 'secondary', foil: true, animation: { entrance: 'zoomIn' } }),
      orn('arch-base', 'lotus', at(155, 288, 80, 48), { color: 'secondary', foil: true, ...up(0.2) }),
      eyebrows('eyebrow', at(40, 344, 310, 20), occ.eyebrows, eyebrowStyle(kit)),
      names(kit, at(16, 362, 358, 96), 54),
      art('motif', kit.motif, fitCentre(kit.motif.name, 195, 474, 170, 30), fade(0.4)),
      dateCity(kit, 490, 30, 330, 17),
      bottomArt
        ? art('hero', bottomArt, fit(bottomArt.name, kit.hero ? 195 : 250, 862, kit.hero ? 270 : 280, 310), { shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.35, durationSec: 1.2 } })
        : kit.scene
          ? scene('scene', kit.scene, at(0, 560, 390, 284), { sky: false, ...fade(0.2) })
          : countdown(kit, at(48, 580, 294, 64), 19),
    ]);
    const desktop = board(
      kit,
      [
        wash(kit, at(860, 150, 760, 760)),
        kit.sky && kit.dark ? art('sky', kit.sky, at(0, 0, 1440, 500), { opacity: 0.6, animation: { motion: 'twinkle' } }) : null,
        kit.corner ? art('corner-l', kit.corner, at(-36, -30, aspectOf(kit.corner.name) >= 1 ? 300 : 160, Math.round((aspectOf(kit.corner.name) >= 1 ? 300 : 160) / aspectOf(kit.corner.name)), -16)) : null,
        photoSlot(at(196, 196, 280, 400), 'arch', undefined, { border: 4 }),
        orn('arch', 'archFrame', at(174, 170, 324, 448), { color: 'secondary', foil: true, animation: { entrance: 'zoomIn' } }),
        orn('arch-base', 'lotus', at(276, 592, 120, 72), { color: 'secondary', foil: true }),
        eyebrows('eyebrow', at(540, 250, 520, 26), occ.eyebrows, eyebrowStyle(kit, 15)),
        names(kit, at(520, 280, 560, 200), 96),
        art('motif', kit.motif, fitCentre(kit.motif.name, 800, 514, 300, 56)),
        dateCity(kit, 556, 540, 520, 24),
        countdown(kit, at(580, 650, 440, 96), 28),
        bottomArt
          ? art('hero', bottomArt, fit(bottomArt.name, 1250, 880, 360, 640), { shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.35, durationSec: 1.2 } })
          : kit.scene
            ? scene('scene', kit.scene, at(1060, 380, 380, 520), { sky: false })
            : null,
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Jharokha: a framed royal card, the photo behind a carved window flanked by a pair, a toran above. */
const jharokha: Composition = {
  key: 'jharokha',
  build(kit, occ) {
    const opening = (x: number, y: number, w: number) => at(Math.round(x + w * 0.2067), Math.round(y + w * (440 / 300) * 0.2545), Math.round(w * 0.5867), Math.round(w * (440 / 300) * 0.5));
    const pair = kit.pair ?? { name: 'elephant' as const, tint: 'accent' as const };
    const mobile = board(kit, [
      art('centre', round(kit.centre, { name: 'medallion' }), at(-35, 118, 460, 460), { opacity: 0.12, animation: { entrance: 'fade', motion: 'spin' } }),
      orn('frame', 'ornateFrame', at(14, 86, 362, 744), { color: 'secondary', foil: true, animation: { entrance: 'fade', durationSec: 1.2 } }),
      topBand(kit, 390, 112),
      kit.hang?.name === 'lantern' ? hangs(kit, [[44, 80], [346, 80]]) : null,
      invocation(kit, at(70, 100, 250, 22)),
      photoSlot(opening(95, 126, 200), 'arch'),
      orn('jharokha', 'jharokha', at(95, 126, 200, 293), { color: 'secondary', foil: true, shadow: 'soft', animation: { entrance: 'zoomIn' } }),
      art('pair-l', pair, fit(pair.name, 70, 472, 160, 140), { shadow: 'soft', animation: { entrance: 'slideRight', delaySec: 0.3 } }),
      art('pair-r', pair, fit(pair.name, 320, 472, 160, 140), { flipX: true, shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.3 } }),
      eyebrows('eyebrow', at(40, 486, 310, 20), occ.eyebrows, eyebrowStyle(kit)),
      names(kit, at(18, 504, 354, 104), 54),
      art('motif', kit.motif, fitCentre(kit.motif.name, 195, 628, 180, 36), fade(0.55)),
      dateCity(kit, 648, 30, 330, 16),
      countdown(kit, at(48, 704, 294, 64), 20),
      text('blessings', t('template.blessings'), at(44, 774, 302, 16), { font: 'body', size: 8.5, weight: 500, color: softInk(kit), letterSpacing: 0.14, transform: 'upper' }, fade(0.9)),
    ]);
    const desktop = board(
      kit,
      [
        art('centre', round(kit.centre, { name: 'medallion' }), at(790, 0, 640, 640), { opacity: 0.1, animation: { motion: 'spin' } }),
        orn('frame', 'ornateFrame', at(28, 104, 1384, 772), { color: 'secondary', foil: true }),
        topBand(kit, 1440, 112),
        kit.hang?.name === 'lantern' ? hangs(kit, [[90, 110], [720, 110], [1350, 110]]) : null,
        photoSlot(opening(940, 130, 300), 'arch'),
        orn('jharokha', 'jharokha', at(940, 130, 300, 440), { color: 'secondary', foil: true, shadow: 'soft', animation: { entrance: 'zoomIn' } }),
        art('pair-l', pair, fit(pair.name, 872, 638, 220, 190), { shadow: 'soft', animation: { entrance: 'slideRight', delaySec: 0.3 } }),
        art('pair-r', pair, fit(pair.name, 1308, 638, 220, 190), { flipX: true, shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.3 } }),
        invocation(kit, at(150, 186, 560, 30), 20, 'left'),
        eyebrows('eyebrow', at(150, 250, 600, 26), occ.eyebrows, eyebrowStyle(kit, 15, 'left')),
        names(kit, at(140, 280, 680, 220), 108, 'left'),
        art('motif', kit.motif, at(140, 508, 300, 60), fade(0.55)),
        dateCity(kit, 580, 150, 640, 26, 'left'),
        countdown(kit, at(150, 664, 450, 98), 30),
        text('blessings', t('template.blessings'), at(150, 782, 640, 22), { font: 'body', size: 12, weight: 500, color: softInk(kit), letterSpacing: 0.16, transform: 'upper', align: 'left' }, fade(0.9)),
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Couple: the illustrated couple (or child, or centrepiece) large in the middle, the names above. */
const couple: Composition = {
  key: 'couple',
  build(kit, occ) {
    const hero = kit.hero ?? { name: 'coupleHindu' as const, tint: 'primary' as const };
    const hasTop = !!kit.top;
    const y0 = hasTop ? (kit.invocation ? 124 : 112) : 84;
    const mobile = board(kit, [
      wash(kit, at(-40, 300, 470, 470), 0.32),
      kit.sky ? art('sky', kit.sky, at(0, 0, 390, 420), { opacity: kit.dark ? 0.55 : 0.45, animation: { entrance: 'fade', motion: 'twinkle' } }) : null,
      isRound(kit.centre) ? art('centre', kit.centre, at(-30, 320, 450, 450), { opacity: kit.dark ? 0.16 : 0.12, animation: { entrance: 'fade', motion: 'spin' } }) : null,
      hangs(kit, [
        [24, 230],
        [366, 230],
      ]),
      topBand(kit, 390, 112),
      hasTop ? invocation(kit, at(70, 100, 250, 22)) : invocation(kit, at(70, 52, 250, 22)),
      eyebrows('eyebrow', at(40, y0, 310, 20), occ.eyebrows, eyebrowStyle(kit)),
      names(kit, at(16, y0 + 20, 358, 92), 52),
      art('motif', kit.motif, fitCentre(kit.motif.name, 195, y0 + 128, 170, 30), fade(0.4)),
      dateCity(kit, y0 + 150, 30, 330, 16),
      art('hero', hero, fit(hero.name, 195, 734, 320, 734 - (y0 + 206)), { shadow: 'soft', animation: { entrance: 'fadeUp', delaySec: 0.35, durationSec: 1.1 } }),
      countdown(kit, at(48, 752, 294, 62), 19),
    ]);
    const desktop = board(
      kit,
      [
        wash(kit, at(700, 120, 760, 760), 0.3),
        kit.sky ? art('sky', kit.sky, at(0, 0, 1440, 560), { opacity: kit.dark ? 0.6 : 0.4, animation: { motion: 'twinkle' } }) : null,
        isRound(kit.centre) ? art('centre', kit.centre, at(760, 160, 640, 640), { opacity: 0.12, animation: { motion: 'spin' } }) : null,
        topBand(kit, 1440, 112),
        hangs(kit, [
          [40, 300],
          [104, 200],
          [1336, 200],
          [1400, 300],
        ]),
        invocation(kit, at(180, 196, 600, 30), 20),
        eyebrows('eyebrow', at(180, 246, 600, 26), occ.eyebrows, eyebrowStyle(kit, 15)),
        names(kit, at(160, 276, 640, 200), 92),
        art('motif', kit.motif, fitCentre(kit.motif.name, 480, 504, 300, 56)),
        dateCity(kit, 546, 180, 600, 24),
        countdown(kit, at(270, 640, 420, 96), 28),
        art('hero', hero, fit(hero.name, 1080, 890, 520, 700), { shadow: 'soft', animation: { entrance: 'fadeUp', delaySec: 0.35, durationSec: 1.1 } }),
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Split: the words on the left, the hero art (a hand, a portrait, a couple) on the right. */
const split: Composition = {
  key: 'split',
  build(kit, occ) {
    const hero = kit.hero ?? { name: 'mehendiHand' as const, tint: '#8a3a17' as const };
    // Parties end in presents and balloons, garden themes in roses, the rest in a turning rangoli (or their own round motif).
    const party = !isRound(kit.centre) && (kit.top?.name === 'bunting' || kit.skyline?.name === 'giftBox');
    const gift: Art = kit.skyline?.name === 'giftBox' ? kit.skyline : { name: 'giftBox' };
    const balloons = kit.pair?.name === 'balloonBunch' ? kit.pair : null;
    const roses = !party && !isRound(kit.centre) && kit.corner?.name === 'roseCluster' ? kit.corner : null;
    const mobile = board(kit, [
      hangs(kit, [
        [24, 230],
        [74, 150],
        [316, 150],
        [366, 230],
      ], 40),
      topBand(kit, 390, 112),
      // The hand may reach over the words; anything else stays right of them.
      art('hero', hero, hero.name === 'mehendiHand' ? fit(hero.name, 288, 528, 250, 348, 6) : fit(hero.name, 298, 532, 184, 330, 4), { flipX: hero.name === 'mehendiHand', shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.3, durationSec: 1.1 } }),
      eyebrows('eyebrow', at(36, 200, 200, 20), occ.eyebrows, { ...eyebrowStyle(kit, 11, 'left'), color: kit.dark ? 'accent' : 'accent', weight: 700 }),
      names(kit, at(30, 222, 190, 150), 46, 'left'),
      dateCity(kit, 378, 36, 176, 15, 'left', 'date'),
      rsvp(at(36, 442, 168, 44)),
      countdown(kit, at(44, 556, 302, 64), 19),
      party
        ? [
            ...(balloons
              ? [
                  art('balloons-l', balloons, fit(balloons.name, 34, 872, 124, 160), { animation: { entrance: 'fadeUp', delaySec: 0.3, motion: 'float' } }),
                  art('balloons-r', balloons, fit(balloons.name, 356, 872, 124, 160), { flipX: true, animation: { entrance: 'fadeUp', delaySec: 0.4, motion: 'float' } }),
                ]
              : []),
            art('gift-l', gift, fit(gift.name, 160, 838, 120, 120), { animation: { entrance: 'zoomIn', delaySec: 0.45 } }),
            art('gift-r', gift, fit(gift.name, 256, 838, 92, 92), { animation: { entrance: 'zoomIn', delaySec: 0.55 } }),
          ]
        : roses
        ? rosesAtFoot(roses)
        : art('bottom', round(kit.centre, { name: 'rangoliBloom' }), at(65, 646, 260, 260), { animation: { entrance: 'zoomIn', delaySec: 0.4, motion: 'spin' } }),
      kit.corner && !roses ? [art('corner-l', kit.corner, fit(kit.corner.name, 20, 818, 66, 92, -20)), art('corner-r', kit.corner, fit(kit.corner.name, 370, 818, 66, 92, 20), { flipX: true })] : null,
    ]);
    const desktop = board(
      kit,
      [
        topBand(kit, 1440, 112),
        hangs(kit, [
          [40, 300],
          [104, 200],
          [1336, 200],
          [1400, 300],
        ], 44),
        party
          ? [art('gift-l', gift, fit(gift.name, 150, 880, 190, 190)), art('gift-r', gift, fit(gift.name, 320, 880, 150, 150)), ...(balloons ? [art('balloons', balloons, fit(balloons.name, 60, 900, 200, 260), { animation: { motion: 'float' } })] : [])]
          : roses
          ? art('bottom', roses, fit(roses.name, 170, 930, 400, 340), { flipY: true, animation: { motion: 'sway' } })
          : art('bottom', round(kit.centre, { name: 'rangoliBloom' }), at(-180, 660, 400, 400), { opacity: 0.95, animation: { motion: 'spin' } }),
        kit.corner ? art('corner', kit.corner, fit(kit.corner.name, 1260, 860, 150, 208, 16), { flipX: true }) : null,
        art('hero', hero, fit(hero.name, 1060, 720, 440, 600, 6), { flipX: hero.name === 'mehendiHand', shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.3, durationSec: 1.1 } }),
        eyebrows('eyebrow', at(250, 230, 560, 26), occ.eyebrows, { ...eyebrowStyle(kit, 15, 'left'), weight: 700, color: 'accent' }),
        names(kit, at(240, 260, 600, 200), 92, 'left'),
        dateCity(kit, 476, 250, 560, 24, 'left'),
        countdown(kit, at(250, 566, 420, 96), 28),
        rsvp(at(250, 690, 230, 56), 'accent', 16),
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Night: a dark sky with stars, lanterns and a crescent, the photo in a turning medallion, a skyline below. */
const night: Composition = {
  key: 'night',
  build(kit, occ) {
    const darkKit: Kit = { ...kit, dark: true };
    const skyline = kit.skyline ?? { name: 'domes' as const, foil: true };
    const lanternKit: Kit = { ...darkKit, hang: kit.hang ?? { name: 'lantern' } };
    const bg = { background: { type: 'gradient' as const, gradient: { from: 'text' as const, to: 'primary' as const, angle: 180 } } };
    const mobile: ArtboardInput = {
      ...board(darkKit, [
        art('stars', kit.sky ?? { name: 'stars', tint: 'accent' }, at(0, 0, 390, 300), { opacity: 0.75, animation: { entrance: 'fade', motion: 'twinkle' } }),
        orn('moon', 'crescent', at(296, 108, 58, 58), { color: 'accent', shadow: 'glow', ...fade(0.2) }),
        hangs(lanternKit, [
          [54, 112],
          [111, 78],
          [277, 78],
        ]),
        art('centre', round(kit.centre, { name: 'arabesque', tint: 'primary' }), at(70, 150, 250, 250), { shadow: 'glow', animation: { entrance: 'zoomIn', delaySec: 0.1, motion: 'spin' } }),
        photoSlot(at(144, 224, 102, 102), 'circle', undefined, { border: 3 }),
        eyebrows('eyebrow', at(40, 418, 310, 20), occ.eyebrows, eyebrowStyle(darkKit)),
        names(darkKit, at(16, 438, 358, 108), 58),
        art('motif', kit.motif, fitCentre(kit.motif.name, 195, 563, 180, 34)),
        dateCity(darkKit, 584, 30, 330, 17),
        art('skyline', skyline, fit(skyline.name, 195, 882, 418, 242), { ...up(0.3) }),
        kit.hero ? art('hero', kit.hero, fit(kit.hero.name, 195, 852, 200, 210), { shadow: 'glow' }) : null,
      ]),
      ...bg,
    };
    const desktop: ArtboardInput = {
      ...board(
        darkKit,
        [
          art('stars', kit.sky ?? { name: 'stars', tint: 'accent' }, at(0, 0, 1440, 480), { opacity: 0.7, animation: { entrance: 'fade', motion: 'twinkle' } }),
          orn('moon', 'crescent', at(1240, 110, 90, 90), { color: 'accent', shadow: 'glow' }),
          hangs(lanternKit, [
            [105, 150],
            [208, 100],
            [490, 120],
            [960, 120],
            [1168, 100],
            [1365, 150],
          ]),
          art('centre', round(kit.centre, { name: 'arabesque', tint: 'primary' }), at(160, 170, 380, 380), { shadow: 'glow', animation: { entrance: 'zoomIn', motion: 'spin' } }),
          photoSlot(at(273, 283, 154, 154), 'circle', undefined, { border: 4 }),
          eyebrows('eyebrow', at(640, 230, 640, 26), occ.eyebrows, eyebrowStyle(darkKit, 15)),
          names(darkKit, at(620, 258, 680, 190), 100),
          art('motif', kit.motif, fitCentre(kit.motif.name, 960, 478, 300, 56)),
          dateCity(darkKit, 516, 640, 640, 24),
          art('skyline-l', skyline, fit(skyline.name, 240, 900, 400, 232), { opacity: 0.85 }),
          art('skyline', skyline, fit(skyline.name, 730, 902, 520, 302)),
          art('skyline-r', skyline, fit(skyline.name, 1200, 900, 400, 232), { opacity: 0.85 }),
        ],
        true,
      ),
      ...bg,
    };
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Floral: blooms falling from two corners, the photo in an oval, doves above the names. */
const floral: Composition = {
  key: 'floral',
  build(kit, occ) {
    const blooms = kit.corner ?? { name: 'roseCluster' as const, tint: '#6b8f6e' as const };
    const motif = kit.motif.name === 'flourish' ? { name: 'doves' as const, tint: 'secondary' as const } : kit.motif;
    const mobile = board(kit, [
      shape('blush', 'ellipse', at(-60, 120, 510, 460), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', to: kit.dark ? 'primary' : 'background' } }, opacity: kit.dark ? 0.25 : 0.45 }),
      art('blooms-top', blooms, fit(blooms.name, 110, 212, 272, 230), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
      art('blooms-bottom', blooms, fit(blooms.name, 300, 900, 250, 168), { flipX: true, flipY: true, animation: { entrance: 'fadeUp', delaySec: 0.2, motion: 'sway' } }),
      photoSlot(at(104, 150, 182, 228), 'ellipse', kit.hero, { border: 3 }),
      art('motif', motif, fitCentre(motif.name, 195, 430, 130, 70), { animation: { entrance: 'fadeUp', delaySec: 0.25, motion: 'float' } }),
      eyebrows('eyebrow', at(40, 478, 310, 20), occ.eyebrows, eyebrowStyle(kit)),
      names(kit, at(16, 496, 358, 104), 56),
      dateCity(kit, 604, 30, 330, 17),
      countdown(kit, at(48, 664, 294, 62), 19),
    ]);
    const desktop = board(
      kit,
      [
        shape('blush', 'ellipse', at(80, 80, 640, 740), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', to: kit.dark ? 'primary' : 'background' } }, opacity: kit.dark ? 0.22 : 0.45 }),
        art('blooms-top', blooms, fit(blooms.name, 180, 330, 420, 354), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
        art('blooms-bottom', blooms, fit(blooms.name, 1270, 914, 420, 354), { flipX: true, flipY: true, animation: { entrance: 'fadeUp', delaySec: 0.2, motion: 'sway' } }),
        photoSlot(at(250, 170, 300, 380), 'ellipse', kit.hero, { border: 4 }),
        art('motif', motif, fitCentre(motif.name, 960, 210, 180, 120), { animation: { entrance: 'fadeUp', delaySec: 0.25, motion: 'float' } }),
        eyebrows('eyebrow', at(660, 290, 600, 26), occ.eyebrows, eyebrowStyle(kit, 15)),
        names(kit, at(640, 318, 640, 180), 96),
        orn('flourish', 'flourish', at(810, 500, 300, 56), { color: 'secondary' }),
        dateCity(kit, 566, 660, 600, 24),
        countdown(kit, at(750, 652, 420, 96), 28),
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Temple: brass bells and jasmine over a bordered band, names in foil, the temple scene below. */
const temple: Composition = {
  key: 'temple',
  build(kit, occ) {
    const darkKit: Kit = { ...kit, dark: true };
    const jasmine = kit.hang ?? { name: 'jasmineStrand' as const };
    const bg = { background: { type: 'color' as const, color: 'primary' as const } };
    const banana = kit.pair ?? { name: 'bananaLeaf' as const, tint: '#3d7f3e' as const };
    const mobile: ArtboardInput = {
      ...board(darkKit, [
        art('centre', round(kit.centre, { name: 'kolam', tint: 'accent' }), at(60, 196, 270, 270), { opacity: 0.1, animation: { entrance: 'fade', motion: 'spin' } }),
        shape('zari-l', 'rect', at(14, 30, 2, 470), { fill: { type: 'color', color: 'secondary' }, opacity: 0.8 }),
        shape('zari-r', 'rect', at(374, 30, 2, 470), { fill: { type: 'color', color: 'secondary' }, opacity: 0.8 }),
        orn('border-top', 'templeBorder', at(-4, 0, 398, 34), { color: 'secondary', foil: true }),
        art('jasmine-l', jasmine, at(24, 30, 28, 290), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
        art('jasmine-r', jasmine, at(338, 30, 28, 290), { animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'sway' } }),
        orn('bells', 'templeBells', at(105, 22, 180, 180), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeDown', motion: 'sway' } }),
        eyebrows('eyebrow', at(40, 224, 310, 20), occ.eyebrows, eyebrowStyle(darkKit)),
        names({ ...darkKit, nameFont: 'heading', foil: true }, at(20, 246, 350, 124), 54),
        orn('lotus', 'lotus', at(150, 370, 90, 54), { color: 'secondary', foil: true, ...fade(0.4) }),
        dateCity(darkKit, 428, 30, 330, 15),
        countdown(darkKit, at(70, 482, 250, 34), 18, 'inline'),
        scene('temple', kit.scene ?? 'gopuram', at(0, 506, 390, 338), { sky: false, animation: { entrance: 'fade', durationSec: 1.2 } }),
        art('banana-l', banana, at(-56, 600, 140, 242), { animation: { entrance: 'slideRight', delaySec: 0.3 } }),
        art('banana-r', banana, at(306, 600, 140, 242), { flipX: true, animation: { entrance: 'slideLeft', delaySec: 0.3 } }),
        shape('band-bottom', 'rect', at(0, 814, 390, 30), { fill: { type: 'color', color: 'primary' } }),
        orn('border-bottom', 'templeBorder', at(-4, 812, 398, 32), { color: 'secondary', foil: true, flipY: true }),
      ]),
      ...bg,
    };
    const desktop: ArtboardInput = {
      ...board(
        darkKit,
        [
          art('centre', round(kit.centre, { name: 'kolam', tint: 'accent' }), at(530, 40, 380, 380), { opacity: 0.08, animation: { motion: 'spin' } }),
          orn('border-top', 'templeBorder', at(-4, 0, 1448, 40), { color: 'secondary', foil: true }),
          ...[40, 150, 1262, 1372].map((x, i) => art(`jasmine-${i + 1}`, jasmine, at(x, 34, 30, i % 3 ? 220 : 320), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.08), motion: 'sway' } })),
          orn('bells-l', 'templeBells', at(220, 30, 200, 200), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeDown', motion: 'sway' } }),
          orn('bells-r', 'templeBells', at(1020, 30, 200, 200), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'sway' } }),
          eyebrows('eyebrow', at(420, 112, 600, 24), occ.eyebrows, eyebrowStyle(darkKit, 14)),
          names({ ...darkKit, nameFont: 'heading', foil: true }, at(320, 138, 800, 110), 92),
          orn('lotus', 'lotus', at(660, 250, 120, 72), { color: 'secondary', foil: true }),
          dateCity(darkKit, 326, 420, 600, 20),
          countdown(darkKit, at(520, 392, 400, 44), 24, 'inline'),
          scene('temple', kit.scene ?? 'gopuram', at(0, 452, 1440, 448), { animation: { entrance: 'fade', durationSec: 1.2 } }),
          shape('scallop', 'scallop', at(-10, 438, 1460, 30, 180), { fill: { type: 'color', color: 'primary' } }),
          art('banana-l', banana, at(-30, 520, 220, 380), { animation: { entrance: 'slideRight', delaySec: 0.3 } }),
          art('banana-r', banana, at(1250, 520, 220, 380), { flipX: true, animation: { entrance: 'slideLeft', delaySec: 0.3 } }),
          shape('band-bottom', 'rect', at(0, 864, 1440, 36), { fill: { type: 'color', color: 'primary' } }),
          orn('border-bottom', 'templeBorder', at(-4, 862, 1448, 38), { color: 'secondary', foil: true, flipY: true }),
        ],
        true,
      ),
      ...bg,
    };
    return { hero: { mobile, desktop }, card: cardFor(kit, 'banded', occ) };
  },
};

/** Scenes that read as a landscape in a short strip (the rest are arches and gateways). */
const LANDSCAPES = new Set<string>(['palace', 'lotus', 'sarovar', 'backwaters', 'gopuram', 'vrindavan', 'balloons']);

/** Portrait: the bride and the groom in two arches (their own photos when added), the names beneath each. */
const portrait: Composition = {
  key: 'portrait',
  build(kit, occ) {
    const tint = kit.hero?.tint ?? 'primary';
    const pane = (side: 'l' | 'r', x: number, y: number, w: number, h: number, scale = 1): LayerInput[] => [
      shape(`pane-${side}`, 'arch', at(x, y, w, h), { fill: { type: 'gradient', gradient: { from: 'accent', to: kit.dark ? 'primary' : 'surface', angle: 180 } } }),
      orn(`bust-${side}`, side === 'l' ? 'brideBust' : 'groomBust', at(x + Math.round(w * 0.02), y + h - Math.round(w * 0.96), Math.round(w * 0.96), Math.round(w * 0.96)), { color: tint, animation: { entrance: 'fadeUp', delaySec: side === 'l' ? 0.2 : 0.3 } }),
      orn(`frame-${side}`, 'archFrame', at(x - Math.round(10 * scale), y - Math.round(12 * scale), w + Math.round(20 * scale), h + Math.round(22 * scale)), { color: 'secondary', foil: true }),
    ];
    const partner = (n: 1 | 2) => b(n === 1 ? 'couple.partnerOne' : 'couple.partnerTwo', { fallback: n === 1 ? NAMES : lit('') });
    const nameStyleSmall = (size: number) => ({ ...nameStyle(kit, size), lineHeight: 1.05 });
    const mobile = board(kit, [
      wash(kit, at(-60, 140, 510, 420), 0.28),
      topBand(kit, 390, 112),
      kit.corner && !kit.top ? corners(kit, kit.corner, 110) : null,
      eyebrows('eyebrow', at(40, kit.top ? 106 : 70, 310, 20), occ.eyebrows, eyebrowStyle(kit)),
      pane('l', 36, 150, 146, 196),
      pane('r', 208, 150, 146, 196),
      text('name-1', partner(1), at(20, 356, 178, 56), nameStyleSmall(34), { overflow: 'shrink', ...up(0.3) }),
      text('amp', lit('&'), at(170, 360, 50, 44), { ...nameStyle(kit, 30), foil: false, color: 'secondary', contrast: false }, fade(0.35)),
      text('name-2', partner(2), at(192, 356, 178, 56), nameStyleSmall(34), { overflow: 'shrink', visibleWhen: { exists: 'couple.partnerTwo' }, ...up(0.35) }),
      art('motif', kit.motif, fitCentre(kit.motif.name, 195, 436, 170, 30)),
      dateCity(kit, 460, 30, 330, 16),
      countdown(kit, at(48, 528, 294, 62), 19),
      // A landscape fills the foot; arch-shaped scenes would show only their pillars there.
      kit.scene && LANDSCAPES.has(kit.scene)
        ? scene('scene', kit.scene, at(0, 610, 390, 234), { sky: false, ...fade(0.3) })
        : isRound(kit.centre)
          ? art('bottom', kit.centre, at(65, 640, 260, 260), { opacity: 0.9, animation: { motion: 'spin' } })
          : kit.corner?.name === 'roseCluster'
            ? rosesAtFoot(kit.corner)
            : kit.pair
              ? [art('pair-l', kit.pair, fit(kit.pair.name, 90, 830, 150, 170)), art('pair-r', kit.pair, fit(kit.pair.name, 300, 830, 150, 170), { flipX: true })]
              : null,
    ]);
    const desktop = board(
      kit,
      [
        wash(kit, at(380, 60, 680, 680), 0.26),
        topBand(kit, 1440, 112),
        kit.corner ? art('corner', kit.corner, at(-36, 600, aspectOf(kit.corner.name) >= 1 ? 320 : 170, Math.round((aspectOf(kit.corner.name) >= 1 ? 320 : 170) / aspectOf(kit.corner.name)))) : null,
        eyebrows('eyebrow', at(420, 128, 600, 26), occ.eyebrows, eyebrowStyle(kit, 15)),
        pane('l', 470, 176, 220, 296, 1.4),
        pane('r', 750, 176, 220, 296, 1.4),
        text('name-1', partner(1), at(430, 486, 300, 80), nameStyleSmall(52), { overflow: 'shrink', ...up(0.3) }),
        text('amp', lit('&'), at(690, 492, 60, 60), { ...nameStyle(kit, 44), foil: false, color: 'secondary', contrast: false }, fade(0.35)),
        text('name-2', partner(2), at(710, 486, 300, 80), nameStyleSmall(52), { overflow: 'shrink', visibleWhen: { exists: 'couple.partnerTwo' }, ...up(0.35) }),
        dateCity(kit, 592, 420, 600, 22),
        countdown(kit, at(510, 680, 420, 96), 28),
        kit.pair ? [art('pair-l', kit.pair, fit(kit.pair.name, 210, 880, 300, 360)), art('pair-r', kit.pair, fit(kit.pair.name, 1230, 880, 300, 360), { flipX: true })] : null,
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Party: bunting and balloons, a round photo, the name big, a date pill, the hero (cake, child, toy) and an RSVP button. */
const party: Composition = {
  key: 'party',
  build(kit, occ) {
    const hero = kit.hero ?? { name: 'cake' as const };
    const balloons = kit.pair ?? { name: 'balloonBunch' as const };
    const mobile = board({ ...kit, dark: false }, [
      art('confetti', kit.sky ?? { name: 'confetti', tint: 'accent' }, at(-20, 90, 430, 250), { opacity: 0.55, ...fade() }),
      art('balloons-l', balloons, fit(balloons.name, 41, 276, 162, 210), { animation: { entrance: 'fadeUp', delaySec: 0.1, motion: 'float' } }),
      art('balloons-r', balloons, fit(balloons.name, 349, 256, 162, 210), { flipX: true, animation: { entrance: 'fadeUp', delaySec: 0.2, motion: 'float' } }),
      art('bunting', kit.top ?? { name: 'bunting' }, at(0, -4, 390, 96), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
      shape('photo-pop', 'ellipse', at(116, 120, 158, 158), { fill: { type: 'color', color: 'secondary' }, animation: { entrance: 'zoomIn' } }),
      { id: 'photo-empty', kind: 'icon', icon: 'sparkle', color: 'surface', frame: at(160, 164, 70, 70), opacity: 0.9 },
      photo('photo', 'photo.cover', at(116, 120, 158, 158), { mask: 'circle', border: { width: 6, color: 'surface' }, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.1 } }),
      eyebrows('eyebrow', at(40, 296, 310, 22), occ.eyebrows, { font: 'body', size: 12, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper' }),
      text('names', NAMES, at(16, 318, 358, 96), { font: 'heading', size: Math.round(46 * (kit.titleScale ?? 1)), weight: 800, color: 'text', lineHeight: 1.05 }, up(0.2)),
      text('tagline', TAGLINE, at(40, 414, 310, 40), { font: 'body', size: 14, color: 'muted', lineHeight: 1.4 }, { visibleWhen: { exists: 'custom.tagline' } }),
      shape('pill', 'rect', at(55, 460, 280, 50), { fill: { type: 'color', color: 'primary' }, radius: 999, shadow: true, animation: { entrance: 'pop', delaySec: 0.3 } }),
      text('date', DATE, at(66, 460, 258, 50), { font: 'heading', size: 15, weight: 700, color: 'surface', letterSpacing: 0.02 }, fade(0.4)),
      text('city', CITY, at(40, 518, 310, 20), { font: 'body', size: 12, weight: 600, color: 'muted', letterSpacing: 0.18, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
      art('hero', hero, fit(hero.name, 195, 760, 210, 214), { shadow: 'soft', animation: { entrance: 'zoomIn', delaySec: 0.35 } }),
      kit.skyline ? [art('gift-l', kit.skyline, fit(kit.skyline.name, 66, 768, 92, 92)), art('gift-r', kit.skyline, fit(kit.skyline.name, 322, 770, 80, 80))] : null,
      rsvp(at(95, 778, 200, 46), 'accent', 14),
    ]);
    const desktop = board(
      { ...kit, dark: false },
      [
        art('confetti', kit.sky ?? { name: 'confetti', tint: 'accent' }, at(640, 40, 800, 460), { opacity: 0.5 }),
        art('bunting-l', kit.top ?? { name: 'bunting' }, at(0, -6, 720, 140), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
        art('bunting-r', kit.top ?? { name: 'bunting' }, at(720, -6, 720, 140), { animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'sway' } }),
        art('balloons-l', balloons, fit(balloons.name, 90, 471, 240, 311), { animation: { entrance: 'fadeUp', motion: 'float' } }),
        art('balloons-r', balloons, fit(balloons.name, 1350, 451, 240, 311), { flipX: true, animation: { entrance: 'fadeUp', delaySec: 0.1, motion: 'float' } }),
        art('hero', hero, fit(hero.name, 1000, 690, 380, 470), { shadow: 'soft', animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
        kit.skyline ? [art('gift-l', kit.skyline, fit(kit.skyline.name, 800, 712, 140, 140)), art('gift-r', kit.skyline, fit(kit.skyline.name, 1210, 712, 116, 116))] : null,
        shape('photo-pop', 'ellipse', at(250, 170, 150, 150), { fill: { type: 'color', color: 'secondary' } }),
        { id: 'photo-empty', kind: 'icon', icon: 'sparkle', color: 'surface', frame: at(290, 210, 70, 70), opacity: 0.9 },
        photo('photo', 'photo.cover', at(250, 170, 150, 150), { mask: 'circle', border: { width: 6, color: 'surface' }, shadow: true }),
        eyebrows('eyebrow', at(250, 346, 560, 26), occ.eyebrows, { font: 'body', size: 15, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper', align: 'left' }),
        text('names', NAMES, at(244, 376, 560, 180), { font: 'heading', size: Math.round(76 * (kit.titleScale ?? 1)), weight: 800, color: 'text', lineHeight: 1.02, align: 'left' }, up(0.2)),
        text('tagline', TAGLINE, at(250, 560, 520, 56), { font: 'body', size: 18, color: 'muted', lineHeight: 1.4, align: 'left' }, { visibleWhen: { exists: 'custom.tagline' } }),
        shape('pill', 'rect', at(250, 628, 400, 62), { fill: { type: 'color', color: 'primary' }, radius: 999, shadow: true }),
        text('date', DATE, at(268, 628, 364, 62), { font: 'heading', size: 19, weight: 700, color: 'surface' }),
        text('city', CITY, at(250, 702, 400, 24), { font: 'body', size: 15, weight: 600, color: 'muted', letterSpacing: 0.18, transform: 'upper', align: 'left' }, { visibleWhen: { exists: 'venue.city' } }),
        rsvp(at(250, 748, 240, 62), 'accent', 18),
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, 'header', occ) };
  },
};

/** Dream: a pastel sky, a moon on a cloud (or a stork), a round photo, the names in script, clouds below. */
const dream: Composition = {
  key: 'dream',
  build(kit, occ) {
    const top = kit.float ?? { name: 'moonCloud' as const };
    const balloons = kit.pair;
    const bg = { background: { type: 'gradient' as const, gradient: { from: 'background' as const, to: 'accent' as const, angle: 180 } } };
    const light: Kit = { ...kit, dark: false };
    const mobile: ArtboardInput = {
      ...board(light, [
        art('stars', kit.sky ?? { name: 'stars' }, at(0, 0, 390, 420), { opacity: 0.85, animation: { entrance: 'fade', motion: 'twinkle' } }),
        art('top', top, fitCentre(top.name, 195, 152, 278, 241), { animation: { entrance: 'fadeDown', motion: 'float' } }),
        shape('photo-bg', 'ellipse', at(130, 286, 130, 130), { fill: { type: 'color', color: 'surface' } }),
        { id: 'photo-empty', kind: 'icon', icon: 'star', color: 'secondary', frame: at(165, 321, 60, 60) },
        photo('photo', 'photo.cover', at(130, 286, 130, 130), { mask: 'circle', border: { width: 5, color: 'surface' }, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.2 } }),
        eyebrows('eyebrow', at(40, 432, 310, 20), occ.eyebrows, { font: 'body', size: 11, weight: 600, color: 'muted', letterSpacing: 0.26, transform: 'upper' }),
        names(light, at(16, 452, 358, 96), 56),
        text('tagline', TAGLINE, at(40, 546, 310, 36), { font: 'body', size: 14, color: 'muted', lineHeight: 1.4 }, { visibleWhen: { exists: 'custom.tagline' } }),
        dateCity(light, 586, 30, 330, 17),
        countdown(light, at(48, 644, 294, 62), 19),
        balloons ? [art('pair-l', balloons, fit(balloons.name, 33, 813, 78, 101), { flipX: true, animation: { entrance: 'fadeUp', delaySec: 0.4, motion: 'float' } }), art('pair-r', balloons, fit(balloons.name, 355, 811, 86, 111), { animation: { entrance: 'fadeUp', delaySec: 0.5, motion: 'float' } })] : null,
        kit.hero ? art('hero', kit.hero, fit(kit.hero.name, 195, 836, 210, 120), { animation: { entrance: 'fadeUp', delaySec: 0.4 } }) : null,
        ...[
          [-40, 778, 170, 110],
          [96, 792, 200, 110],
          [252, 774, 190, 120],
        ].map(([x, y, w, h], i) => shape(`cloud-${i + 1}`, 'ellipse', at(x!, y!, w!, h!), { fill: { type: 'color', color: 'surface' }, opacity: 0.92, animation: { entrance: 'fadeUp', delaySec: sec(0.2 + i * 0.1) } })),
      ]),
      ...bg,
    };
    const desktop: ArtboardInput = {
      ...board(
        light,
        [
          art('stars', kit.sky ?? { name: 'stars' }, at(0, 0, 1440, 600), { opacity: 0.8, animation: { entrance: 'fade', motion: 'twinkle' } }),
          art('top', top, fitCentre(top.name, 1090, 300, 460, 399), { animation: { entrance: 'fadeDown', motion: 'float' } }),
          shape('photo-bg', 'ellipse', at(1010, 520, 170, 170), { fill: { type: 'color', color: 'surface' } }),
          { id: 'photo-empty', kind: 'icon', icon: 'star', color: 'secondary', frame: at(1055, 565, 80, 80) },
          photo('photo', 'photo.cover', at(1010, 520, 170, 170), { mask: 'circle', border: { width: 6, color: 'surface' }, shadow: true }),
          eyebrows('eyebrow', at(200, 270, 560, 26), occ.eyebrows, { font: 'body', size: 15, weight: 600, color: 'muted', letterSpacing: 0.26, transform: 'upper', align: 'left' }),
          names(light, at(190, 298, 620, 170), 96, 'left'),
          text('tagline', TAGLINE, at(200, 472, 520, 56), { font: 'body', size: 18, color: 'muted', lineHeight: 1.4, align: 'left' }, { visibleWhen: { exists: 'custom.tagline' } }),
          dateCity(light, 540, 200, 560, 24, 'left'),
          countdown(light, at(200, 630, 420, 96), 28),
          balloons ? art('pair', balloons, fit(balloons.name, 1335, 754, 150, 194), { animation: { motion: 'float' } }) : null,
          kit.hero ? art('hero', kit.hero, fit(kit.hero.name, 1310, 890, 240, 200)) : null,
        ],
        true,
      ),
      ...bg,
    };
    return { hero: { mobile, desktop }, card: cardFor(kit, 'sky', occ) };
  },
};

/** Home: a toran over the door, the invocation, the centrepiece (a house, a kalash, a haldi urli), diyas and a rangoli. */
const home: Composition = {
  key: 'home',
  build(kit, occ) {
    const hero = kit.hero ?? { name: 'house' as const };
    // A row of diyas at the threshold (the kit's own when its skyline is diyas).
    const diyas: Art = kit.skyline?.name === 'diyaRow' ? kit.skyline : { name: 'diyaRow' };
    const mobile = board(kit, [
      art('centre', round(kit.centre, { name: 'medallion' }), at(-30, 220, 450, 450), { opacity: 0.1, animation: { motion: 'spin' } }),
      hangs(kit.hang ? kit : { ...kit, hang: { name: 'marigoldStrand' } }, [
        [22, 210],
        [368, 210],
      ], 40),
      art('top', kit.top ?? { name: 'toran' }, at(-14, -10, 418, 112), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
      invocation(kit, at(60, 104, 270, 26), 17),
      eyebrows('eyebrow', at(40, 136, 310, 20), occ.eyebrows, { font: 'body', size: 11, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper' }),
      names(kit, at(16, 156, 358, 96), 44),
      art('hero', hero, fit(hero.name, 195, 534, 280, 280), { shadow: 'soft', animation: { entrance: 'zoomIn', delaySec: 0.25 } }),
      art('diyas', diyas, fit('diyaRow', 195, 611, 300, 83), up(0.4)),
      dateCity(kit, 622, 30, 330, 17),
      countdown(kit, at(52, 682, 286, 60), 18),
      art('rangoli', round(kit.corner, { name: 'rangoliBloom' }), at(110, 752, 170, 170), { animation: { entrance: 'zoomIn', delaySec: 0.5, motion: 'spin' } }),
    ]);
    const desktop = board(
      kit,
      [
        art('centre', round(kit.centre, { name: 'medallion' }), at(780, 80, 620, 620), { opacity: 0.1, animation: { motion: 'spin' } }),
        ...[0, 1, 2, 3].map((i) => art(`top-${i + 1}`, kit.top ?? { name: 'toran' }, at(-14 + i * 366, -12, 372, 112), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.08), motion: 'sway' } })),
        art('hero', hero, fit(hero.name, 1080, 650, 480, 480), { shadow: 'soft', animation: { entrance: 'zoomIn', delaySec: 0.2 } }),
        art('diyas', diyas, fit('diyaRow', 1080, 771, 440, 121), up(0.35)),
        art('rangoli', round(kit.corner, { name: 'rangoliBloom' }), at(-110, 600, 380, 380), { opacity: 0.95, animation: { motion: 'spin' } }),
        invocation(kit, at(200, 200, 560, 34), 24, 'left'),
        eyebrows('eyebrow', at(200, 244, 560, 26), occ.eyebrows, { font: 'body', size: 15, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper', align: 'left' }),
        names(kit, at(190, 272, 620, 170), 84, 'left'),
        dateCity(kit, 470, 200, 560, 24, 'left'),
        countdown(kit, at(200, 560, 420, 96), 28),
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Minimal: a double rule, a small motif, the names large in script, the date spaced out; the hero small at the foot. */
const minimal: Composition = {
  key: 'minimal',
  build(kit, occ) {
    // The crest never repeats the art at the foot (a cupcake over a cupcake).
    const own = crestOf(kit, occ);
    const crest: Art = own.name === kit.hero?.name ? { name: 'stars', tint: 'secondary' } : own;
    const mobile = board(kit, [
      shape('rule-o', 'rect', at(16, 16, 358, 812), { fill: { type: 'none' }, stroke: { width: 1.2, color: 'secondary' } }),
      shape('rule-i', 'rect', at(24, 24, 342, 796), { fill: { type: 'none' }, stroke: { width: 0.6, color: 'secondary' } }),
      art('crest', crest, fitCentre(crest.name, 195, 116, 90, 56), fade()),
      eyebrows('eyebrow', at(40, 186, 310, 20), occ.eyebrows, { ...eyebrowStyle(kit), letterSpacing: 0.4 }),
      names(kit, at(24, 214, 342, 200), 66),
      shape('rule', 'line', at(160, 432, 70, 2), { fill: { type: 'color', color: 'secondary' }, stroke: { width: 1, color: 'secondary' } }),
      dateCity(kit, 452, 30, 330, 15),
      countdown(kit, at(70, 520, 250, 34), 17, 'inline'),
      kit.hero ? art('hero', kit.hero, fit(kit.hero.name, 195, 800, 220, 230), up(0.4)) : art('foot', kit.corner ?? kit.motif, fitCentre((kit.corner ?? kit.motif).name, 195, 720, 160, 120), fade(0.4)),
    ]);
    const desktop = board(
      kit,
      [
        shape('rule-o', 'rect', at(28, 28, 1384, 844), { fill: { type: 'none' }, stroke: { width: 1.4, color: 'secondary' } }),
        shape('rule-i', 'rect', at(40, 40, 1360, 820), { fill: { type: 'none' }, stroke: { width: 0.7, color: 'secondary' } }),
        art('crest', crest, fitCentre(crest.name, 720, 128, 120, 74)),
        eyebrows('eyebrow', at(420, 200, 600, 26), occ.eyebrows, { ...eyebrowStyle(kit, 15), letterSpacing: 0.4 }),
        names(kit, at(260, 230, 920, 200), 110),
        shape('rule', 'line', at(680, 452, 80, 2), { fill: { type: 'color', color: 'secondary' }, stroke: { width: 1, color: 'secondary' } }),
        dateCity(kit, 476, 420, 600, 22),
        countdown(kit, at(520, 560, 400, 44), 24, 'inline'),
        kit.hero ? art('hero', kit.hero, fit(kit.hero.name, 720, 862, 260, 250)) : null,
        kit.corner ? [art('foot-l', kit.corner, fit(kit.corner.name, 150, 862, 220, 220)), art('foot-r', kit.corner, fit(kit.corner.name, 1290, 862, 220, 220), { flipX: true })] : null,
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, 'minimal', occ) };
  },
};

/** Mandap: the names above an illustrated scene, the couple standing in front of it. */
const mandap: Composition = {
  key: 'mandap',
  build(kit, occ) {
    const hero = kit.hero ?? { name: 'coupleHindu' as const, tint: 'primary' as const };
    const sceneName = kit.scene ?? 'mandap';
    const mobile = board(kit, [
      kit.sky ? art('sky', kit.sky, at(0, 0, 390, 320), { opacity: kit.dark ? 0.7 : 0.4, animation: { motion: 'twinkle' } }) : null,
      topBand(kit, 390, 112),
      invocation(kit, at(70, kit.top ? 112 : 74, 250, 22)),
      eyebrows('eyebrow', at(40, 146, 310, 20), occ.eyebrows, eyebrowStyle(kit)),
      names(kit, at(16, 166, 358, 92), 50),
      dateCity(kit, 262, 30, 330, 16),
      countdown(kit, at(70, 334, 250, 34), 17, 'inline'),
      wash(kit, at(-50, 400, 490, 440), 0.34),
      // The gateway's garland and the mandap's canopy hang from the top of their frames, so those start below the countdown.
      sceneName === 'toran' || sceneName === 'mandap'
        ? scene('scene', sceneName, at(0, 372, 390, 472), { sky: false, ...fade(0.2) })
        : scene('scene', sceneName, at(0, 296, 390, 548), { sky: false, ...fade(0.2) }),
      art('hero', hero, fit(hero.name, 195, 832, 250, 316), { shadow: 'soft', animation: { entrance: 'fadeUp', delaySec: 0.4, durationSec: 1.1 } }),
    ]);
    const desktop = board(
      kit,
      [
        kit.sky ? art('sky', kit.sky, at(0, 0, 1440, 380), { opacity: kit.dark ? 0.6 : 0.4, animation: { motion: 'twinkle' } }) : null,
        topBand(kit, 1440, 112),
        invocation(kit, at(420, 112, 600, 30), 20),
        eyebrows('eyebrow', at(420, 150, 600, 26), occ.eyebrows, eyebrowStyle(kit, 15)),
        names(kit, at(320, 176, 800, 120), 84),
        dateCity(kit, 300, 420, 600, 20),
        countdown(kit, at(520, 362, 400, 44), 22, 'inline'),
        scene('scene', sceneName, at(0, 420, 1440, 480), { sky: false, ...fade(0.2) }),
        art('hero', hero, fit(hero.name, 720, 888, 330, 418), { shadow: 'soft', animation: { entrance: 'fadeUp', delaySec: 0.4, durationSec: 1.1 } }),
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

/** Photo: a large photo (the illustration stands in until one is added) over a scalloped panel with the words. */
const photoFirst: Composition = {
  key: 'photo',
  build(kit, occ) {
    const hero = kit.hero ?? kit.pair;
    const panel = kit.dark ? 'primary' : 'surface';
    const mobile = board(kit, [
      photoSlot(at(20, 20, 350, 500), 'rounded', hero, { radius: 30, border: 0 }),
      kit.corner ? corners(kit, kit.corner, 96, 470) : null,
      shape('panel-scallop', 'scallop', at(-10, 462, 410, 50), { fill: { type: 'color', color: panel } }),
      shape('panel', 'rect', at(0, 508, 390, 336), { fill: { type: 'color', color: panel } }),
      eyebrows('eyebrow', at(40, 520, 310, 20), occ.eyebrows, eyebrowStyle(kit)),
      names(kit, at(16, 540, 358, 90), 48),
      art('motif', kit.motif, fitCentre(kit.motif.name, 195, 642, 170, 28)),
      dateCity(kit, 662, 30, 330, 16),
      countdown(kit, at(48, 730, 294, 60), 18),
    ]);
    const desktop = board(
      kit,
      [
        photoSlot(at(60, 60, 640, 780), 'rounded', hero, { radius: 40, border: 0 }),
        kit.corner ? art('corner', kit.corner, at(1180, -40, aspectOf(kit.corner.name) >= 1 ? 300 : 170, Math.round((aspectOf(kit.corner.name) >= 1 ? 300 : 170) / aspectOf(kit.corner.name)), 16), { flipX: true }) : null,
        eyebrows('eyebrow', at(760, 240, 600, 26), occ.eyebrows, eyebrowStyle(kit, 15)),
        names(kit, at(740, 270, 640, 200), 92),
        art('motif', kit.motif, fitCentre(kit.motif.name, 1060, 500, 300, 56)),
        dateCity(kit, 540, 760, 600, 24),
        countdown(kit, at(850, 630, 420, 96), 28),
      ],
      true,
    );
    return { hero: { mobile, desktop }, card: cardFor(kit, kit.card, occ) };
  },
};

export const COMPOSITIONS = { arch, jharokha, couple, split, night, floral, temple, portrait, party, dream, home, minimal, mandap, photo: photoFirst } satisfies Record<string, Composition>;
export type CompositionKey = keyof typeof COMPOSITIONS;

/** One line about what each composition shows, for template descriptions. */
export const COMPOSITION_BLURB: Record<CompositionKey, (k: Kit) => string> = {
  arch: (k) => `your photo in a gilded arch${k.corner ? ` under ${describe(k.corner)}` : ''}, the names in ${k.foil ? 'shimmering foil' : 'flowing script'}${k.hero ? ` and ${describe(k.hero)} below` : k.pair ? ` and ${describe(k.pair)} below` : ''}`,
  jharokha: (k) => `your photo behind a carved jharokha flanked by ${describe(k.pair ?? { name: 'elephant' })}, ${k.top ? `${describe(k.top)} above, ` : ''}a framed card for every function`,
  couple: (k) => `${describe(k.hero ?? { name: 'coupleHindu' })} at the heart of the invitation${k.top ? `, ${describe(k.top)} above` : ''}, a live countdown`,
  split: (k) => `${describe(k.hero ?? { name: 'mehendiHand' })} beside your names, a spinning rangoli and a bright RSVP button`,
  night: (k) => `a starry night with glowing lanterns and a crescent, your photo in a turning ${describe(round(k.centre, { name: 'arabesque' }))}, ${describe(k.skyline ?? { name: 'domes' })} below`,
  floral: (k) => `${describe(k.corner ?? { name: 'roseCluster' })} falling from the corners, your photo in an oval frame${k.hero ? ` (or ${describe(k.hero)})` : ''}, names in script`,
  temple: () => `brass temple bells and jasmine strings over a woven border, names in gold foil, a temple at dusk framed by banana leaves`,
  portrait: () => `the bride and the groom painted in two gilded arches, each name beneath`,
  party: (k) => `bunting and balloons, a round photo, a date pill, ${describe(k.hero ?? { name: 'cake' })} and a big RSVP button`,
  dream: (k) => `a pastel sky with ${describe(k.float ?? { name: 'moonCloud' })}, twinkling stars, a round photo and soft clouds`,
  home: (k) => `a marigold toran, ${describe(k.hero ?? { name: 'house' })}, a row of diyas and a rangoli at the threshold`,
  minimal: (k) => `a fine double rule, your names large in script and the date spaced out${k.hero ? `, ${describe(k.hero)} at the foot` : ''}`,
  mandap: (k) => `${describe(k.hero ?? { name: 'coupleHindu' })} standing before ${sceneWords[k.scene ?? 'mandap'] ?? 'an illustrated scene'}`,
  photo: (k) => `a large photo of you (${describe(k.hero ?? k.pair ?? { name: 'doves' })} until you add one) over a scalloped panel with the details`,
};

const sceneWords: Partial<Record<string, string>> = {
  mandap: 'a flower-draped mandap',
  palace: 'a palace on the lake',
  floral: 'a flower arch',
  lotus: 'a lotus pond',
  gopuram: 'a temple gateway',
  arches: 'receding arches',
  backwaters: 'the backwaters',
  sarovar: 'a golden sarovar',
  vrindavan: 'moonlit Vrindavan',
  toran: 'a marigold gateway',
  balloons: 'a sky of balloons',
};

const WORDS: Partial<Record<string, string>> = {
  elephant: 'two caparisoned elephants',
  royalPeacock: 'a royal peacock',
  doves: 'a pair of doves',
  lantern: 'lanterns',
  bananaLeaf: 'banana leaves',
  kalash: 'two kalash',
  balloonBunch: 'balloons',
  toran: 'a marigold toran',
  floralGarland: 'a rose garland',
  bunting: 'bunting',
  fairyLights: 'fairy lights',
  templeBorder: 'a temple border',
  roseCluster: 'garden roses',
  paisleyOrnate: 'paisleys',
  filigreeCorner: 'gold filigree',
  medallion: 'medallion',
  arabesque: 'arabesque',
  kolam: 'kolam',
  rangoliBloom: 'rangoli',
  domes: 'a skyline of domes',
  diyaRow: 'a row of diyas',
  coupleHindu: 'an illustrated bride and groom in lehenga and safa',
  coupleVarmala: 'the bride and groom garlanded after the varmala',
  coupleSikh: 'an illustrated Sikh couple',
  coupleNikah: 'an illustrated nikah couple',
  coupleSouth: 'a South Indian bride and groom in silk',
  coupleChristian: 'a bride in white and her groom',
  coupleBengali: 'a Bengali bride and groom in topor and mukut',
  coupleElder: 'a couple who have shared a lifetime',
  kidBoy: 'the birthday boy in a party hat',
  kidGirl: 'the birthday girl in a party hat',
  babyCradle: 'a baby asleep in a cradle',
  momToBe: 'the mother-to-be in a silk saree',
  stork: 'a stork bringing the baby',
  teddyBear: 'a teddy bear',
  unicorn: 'a unicorn',
  dino: 'a little dinosaur',
  rocket: 'a rocket',
  cupcake: 'a cupcake',
  cake: 'a tiered cake',
  doli: 'a bridal doli',
  dhol: 'a dhol',
  haldiBowl: 'an urli of haldi',
  champagne: 'a champagne toast',
  house: 'a house glowing with lamps',
  mehendiHand: 'a hand painted with henna',
  moonCloud: 'a sleepy moon on a cloud',
  rings: 'wedding rings',
  giftBox: 'presents',
  brideBust: 'the bride',
};

export const describe = (a: Art) => WORDS[a.name] ?? a.name.replace(/([A-Z])/g, ' $1').toLowerCase();
