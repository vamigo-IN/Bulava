import type { ArtboardInput, LayerInput, Value } from '@bulava/template-schema';
import { palette, TITLE } from './builder';
import { at, b, lit, orn, photo, sec, shape, t, text, widget, type CanvasSpec, type Frame, type TextStyleInput } from './canvas-kit';

/**
 * The premium collection: invitations composed like foil-stamped printed
 * stationery, each in its own tradition's vocabulary. Every one is a phone
 * card (the opening artboard, which is also the digital card), a desktop
 * hero and a card for every function. Colours are palette roles, so each
 * preset restyles the whole design; the art is the engine's own drawing.
 *
 * The RSVP block is printed text under buttons of the same colour: on a
 * website the buttons cover the words and scroll to the RSVP form; a digital
 * card drops the buttons and keeps the words.
 */

type Role = 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text' | 'muted';

/** The couple's initials ("R & A"), or the honoree's, or the event's. */
const MONOGRAM: Value = {
  template: '{{couple.partnerOne|initial}} & {{couple.partnerTwo|initial}}',
  fallback: { binding: 'honoree.name', format: 'initial', fallback: { binding: 'event.title', format: 'initial' } },
};

/** "Rambagh Palace, Jaipur", or whichever of the two the host gave. */
const VENUE_LINE: Value = { template: '{{venue.name}}, {{venue.city}}', fallback: { binding: 'venue.name', fallback: b('venue.city') } };

// ─────────────────────────── Shared pieces ───────────────────────────

interface RsvpStyle {
  /** Centre of the block and the top of the pill. */
  cx: number;
  y: number;
  /** The panel's fill (the buttons take it too, so they hide the printed words beneath). */
  panel: Role;
  /** Metal of the outline, pill and divider. */
  metal: Role;
  /** The pill's fill: a gradient from `pill[0]` to `pill[1]`. */
  pill: [Role, Role];
  pillInk: Role;
  ink: Role;
  font: TextStyleInput['font'];
  /** Type size of Accept and Decline (wide faces need less). */
  size?: number;
  scale?: number;
  delay?: number;
}

/**
 * A pill reading RSVP over a panel with Accept | Decline. On websites each of
 * the three is a button to the RSVP form; on a card the printed words stay.
 */
function rsvpBlock(s: RsvpStyle): LayerInput[] {
  const k = s.scale ?? 1;
  const d = s.delay ?? 0.7;
  const pw = 124 * k;
  const ph = 30 * k;
  const bw = 196 * k;
  const bh = 60 * k;
  const top = s.y + 9 * k;
  const half = bw / 2 - 10 * k;
  const size = (s.size ?? 15) * k;
  const row = top + bh - 34 * k;
  const words = (id: string, key: string, x: number) => [
    text(`${id}-text`, t(key), at(x, row, half, 26 * k), { font: s.font, size, weight: 500, color: s.ink, letterSpacing: 0.02 }, { animation: { entrance: 'fade', delaySec: sec(d + 0.15) } }),
  ];
  const button = (id: string, key: string, x: number) =>
    widget(id, { type: 'button', label: t(key), action: 'rsvp', fill: s.panel, color: s.ink, font: s.font, size, weight: 500, radius: 8 * k, shadow: false }, at(x, row, half, 26 * k), { animation: { entrance: 'fade', delaySec: sec(d + 0.15) } });
  const left = s.cx - bw / 2 + 6 * k;
  const right = s.cx + 4 * k;
  return [
    shape('rsvp-panel', 'rect', at(s.cx - bw / 2, top, bw, bh), { fill: { type: 'color', color: s.panel }, stroke: { width: 1 * k, color: s.metal }, radius: 12 * k, animation: { entrance: 'fadeUp', delaySec: sec(d) } }),
    ...words('rsvp-accept', 'template.rsvp.accept', left),
    ...words('rsvp-decline', 'template.rsvp.decline', right),
    shape('rsvp-divider', 'rect', at(s.cx - 0.5, row + 5 * k, 1, 16 * k), { fill: { type: 'color', color: s.metal }, animation: { entrance: 'fade', delaySec: sec(d + 0.15) } }),
    button('rsvp-accept', 'template.rsvp.accept', left),
    button('rsvp-decline', 'template.rsvp.decline', right),
    shape('rsvp-pill', 'rect', at(s.cx - pw / 2, s.y - 6 * k, pw, ph), { fill: { type: 'gradient', gradient: { from: s.pill[0], to: s.pill[1], angle: 180 } }, stroke: { width: 0.8 * k, color: s.metal }, radius: 999, shadow: true, animation: { entrance: 'pop', delaySec: sec(d + 0.05) } }),
    text('rsvp-title', t('invitation.rsvp'), at(s.cx - pw / 2, s.y - 6 * k, pw, ph), { font: s.font, size: 17 * k, weight: 700, color: s.pillInk, letterSpacing: 0.08 }, { animation: { entrance: 'fade', delaySec: sec(d + 0.1) } }),
  ];
}

interface TimelineStyle {
  /** The three columns' centres, the top of the names row and the column width. */
  xs: [number, number, number];
  y: number;
  width: number;
  metal: Role;
  dot: Role;
  /** Round dots or diamonds on the line. */
  dotShape?: 'ellipse' | 'diamond';
  ink: Role;
  dateInk: Role;
  nameFont: TextStyleInput['font'];
  dateFont: TextStyleInput['font'];
  /** Dates in italic (serif faces) or upright (scripts), and their size. */
  dateItalic?: boolean;
  dateSize?: number;
  /** A narrower date box wraps long dates onto `dateLines` lines ("14 December / 2026"). */
  dateWidth?: number;
  dateLines?: 1 | 2;
  nameSize?: number;
  scale?: number;
  delay?: number;
}

/**
 * The first three functions the guest may see, as a row of names over a gold
 * line with a dot for each and their dates below. A function that is missing
 * hides its column and the line that leads to it.
 */
function timeline(s: TimelineStyle): LayerInput[] {
  const k = s.scale ?? 1;
  const d = s.delay ?? 0.85;
  const lineY = s.y + 36 * k;
  const dw = (s.dateWidth ?? s.width) * k;
  const dateSize = (s.dateSize ?? 12.5) * k;
  const out: LayerInput[] = [];
  s.xs.forEach((x, n) => {
    const when = { exists: `functions[${n}].name` };
    const anim = (extra = 0) => ({ entrance: 'fadeUp' as const, delaySec: sec(d + n * 0.1 + extra) });
    if (n > 0) {
      const from = s.xs[n - 1]!;
      out.push(shape(`tl-line-${n}`, 'rect', at(from, lineY - 0.5, x - from, Math.max(1, k)), { fill: { type: 'color', color: s.metal }, visibleWhen: when, animation: { entrance: 'fade', delaySec: sec(d + n * 0.1) } }));
    }
    out.push(
      text(`tl-name-${n + 1}`, b(`functions[${n}].name`), at(x - s.width / 2, s.y, s.width, 30 * k), { font: s.nameFont, size: (s.nameSize ?? 15.5) * k, weight: 500, color: s.ink, lineHeight: 1.05 }, { visibleWhen: when, animation: anim() }),
      shape(`tl-dot-${n + 1}`, s.dotShape ?? 'ellipse', at(x - 4.5 * k, lineY - 4.5 * k, 9 * k, 9 * k), { fill: { type: 'gradient', gradient: { kind: 'radial', from: s.dot, to: s.metal } }, stroke: { width: 0.8 * k, color: s.metal }, visibleWhen: when, animation: { entrance: 'pop', delaySec: sec(d + n * 0.1) } }),
      text(`tl-date-${n + 1}`, b(`functions[${n}].date`, { format: 'dateShort' }), at(x - dw / 2, lineY + 8 * k, dw, (s.dateLines ?? 1) * dateSize * 1.12 + 3 * k), { font: s.dateFont, size: dateSize, italic: s.dateItalic ?? true, color: s.dateInk, lineHeight: 1.06 }, { visibleWhen: when, animation: anim(0.05) }),
    );
  });
  return out;
}

interface ButtonStyle {
  /** The filled button's colour and its lettering; the outlined one is drawn in `fill`. */
  fill: Role;
  ink: Role;
  font: TextStyleInput['font'];
  size?: number;
  radius?: number;
  delay?: number;
}

/** Get directions (filled) and Add to calendar (outlined), side by side, in the card's own lettering. */
function stationeryButtons(y: number, x: number, width: number, s: ButtonStyle): LayerInput[] {
  const half = (width - 10) / 2;
  const size = s.size ?? 14;
  const common = { font: s.font, size, weight: 600, radius: s.radius ?? 40 } as const;
  return [
    widget('directions', { type: 'button', label: t('template.getDirections'), action: 'directions', fill: s.fill, color: s.ink, shadow: true, ...common }, at(x, y, half, 42), { animation: { entrance: 'pop', delaySec: s.delay ?? 0.5 } }),
    widget('calendar', { type: 'button', label: t('template.addToCalendar'), action: 'calendar', fill: 'transparent', color: s.fill, border: { width: 1.2, color: s.fill }, shadow: false, ...common }, at(x + half + 10, y, half, 42), { animation: { entrance: 'pop', delaySec: sec((s.delay ?? 0.5) + 0.1) } }),
  ];
}

// ─────────────────────────── Royal Maroon & Gold ───────────────────────────

const MAROON_STOCK = { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } } as const;

/** The photo in a rounded gold frame; the couple's monogram on a mandala shows until there is one. */
function framedPhoto(x: number, y: number, w: number, h: number, scale = 1): LayerInput[] {
  const inset = 4 * scale;
  const inner = at(x + inset, y + inset, w - inset * 2, h - inset * 2);
  const m = Math.min(w, h);
  return [
    shape('photo-frame', 'rect', at(x, y, w, h), { fill: { type: 'gradient', gradient: { from: 'primary', to: 'text', angle: 180 } }, stroke: { width: 1.2 * scale, color: 'secondary' }, radius: 12 * scale, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.35 } }),
    orn('photo-mandala', 'mandala', at(x + w / 2 - m * 0.4, y + h / 2 - m * 0.4, m * 0.8, m * 0.8), { color: 'secondary', opacity: 0.35, animation: { entrance: 'fade', delaySec: 0.45, motion: 'spin' } }),
    text('monogram', MONOGRAM, at(x + 10 * scale, y + h / 2 - 34 * scale, w - 20 * scale, 68 * scale), { font: 'script', size: 50 * scale, color: 'secondary', foil: true, shadow: 'soft', lineHeight: 1 }, { animation: { entrance: 'zoomIn', delaySec: 0.5 } }),
    photo('photo', 'photo.cover', inner, { mask: 'rounded', radius: 9 * scale, border: { width: 1 * scale, color: 'accent' }, animation: { entrance: 'zoomIn', delaySec: 0.4 } }),
    ...([
      [x - 7 * scale, y - 7 * scale, false],
      [x + w - 31 * scale, y - 7 * scale, true],
    ] as const).map(([cx, cy, flipX], i) => orn(`photo-corner-${i + 1}`, 'filigreeCorner', at(cx, cy, 38 * scale, 38 * scale), { color: 'secondary', foil: true, flipX, animation: { entrance: 'fade', delaySec: 0.55 } })),
  ];
}

const maroonHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: MAROON_STOCK,
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    shape('glow', 'ellipse', at(-20, 200, 430, 520), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'secondary', via: 'transparent', to: 'transparent' } }, opacity: 0.16 }),
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'secondary', foil: true, animation: { entrance: 'fade', durationSec: 1.2 } }),
    orn('vine-left', 'goldVine', at(-8, 62, 54, 720), { color: 'secondary', foil: true, animation: { entrance: 'fadeDown', delaySec: 0.2, durationSec: 1.4 } }),
    orn('vine-right', 'goldVine', at(344, 62, 54, 720), { color: 'secondary', foil: true, flipX: true, animation: { entrance: 'fadeDown', delaySec: 0.2, durationSec: 1.4 } }),
    orn('crown', 'mandalaCrown', at(74, 33, 242, 175), { color: 'secondary', foil: true, animation: { entrance: 'fadeDown', durationSec: 1.2, motion: 'shimmer' } }),
    orn('sparkles-left', 'sparkles', at(44, 350, 58, 240), { color: 'secondary', animation: { entrance: 'fade', delaySec: 0.8, motion: 'twinkle' } }),
    orn('sparkles-right', 'sparkles', at(288, 330, 58, 240), { color: 'secondary', flipX: true, animation: { entrance: 'fade', delaySec: 0.9, motion: 'twinkle' } }),
    text('names', TITLE, at(42, 202, 306, 88), { font: 'script', size: 45, color: 'secondary', foil: true, shadow: 'soft', lineHeight: 1.04 }, { animation: { entrance: 'fadeUp', delaySec: 0.3, motion: 'shimmer' } }),
    text('date', b('event.startDate', { format: 'date' }), at(50, 286, 290, 26), { font: 'heading', size: 18.5, italic: true, color: 'accent', letterSpacing: 0.02 }, { animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('venue', VENUE_LINE, at(50, 310, 290, 44), { font: 'script', size: 23, color: 'accent', lineHeight: 1.03 }, { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    ...framedPhoto(97, 358, 196, 200),
    ...rsvpBlock({ cx: 195, y: 547, panel: 'primary', metal: 'secondary', pill: ['accent', 'secondary'], pillInk: 'primary', ink: 'accent', font: 'heading' }),
    ...timeline({ xs: [92, 195, 298], y: 626, width: 102, metal: 'secondary', dot: 'accent', ink: 'accent', dateInk: 'accent', nameFont: 'heading', dateFont: 'heading' }),
    text('closing', t('template.footer.thanks'), at(56, 704, 278, 20), { font: 'heading', size: 13.5, italic: true, color: 'secondary', letterSpacing: 0.02 }, { animation: { entrance: 'fade', delaySec: 1.2 } }),
    orn('base', 'mandalaHalf', at(118, 733, 154, 78), { color: 'secondary', foil: true, flipY: true, animation: { entrance: 'fadeUp', delaySec: 0.6, durationSec: 1.2 } }),
  ],
};

const maroonHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: MAROON_STOCK,
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    shape('glow', 'ellipse', at(120, 80, 640, 760), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'secondary', via: 'transparent', to: 'transparent' } }, opacity: 0.16 }),
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'secondary', foil: true, animation: { entrance: 'fade', durationSec: 1.2 } }),
    orn('vine-left', 'goldVine', at(-6, 90, 64, 720), { color: 'secondary', foil: true, animation: { entrance: 'fadeDown', delaySec: 0.2, durationSec: 1.4 } }),
    orn('vine-right', 'goldVine', at(1382, 90, 64, 720), { color: 'secondary', foil: true, flipX: true, animation: { entrance: 'fadeDown', delaySec: 0.2, durationSec: 1.4 } }),
    orn('crown', 'mandalaCrown', at(240, 56, 330, 239), { color: 'secondary', foil: true, animation: { entrance: 'fadeDown', durationSec: 1.2, motion: 'shimmer' } }),
    orn('sparkles-left', 'sparkles', at(150, 330, 90, 380), { color: 'secondary', animation: { entrance: 'fade', delaySec: 0.8, motion: 'twinkle' } }),
    orn('sparkles-right', 'sparkles', at(600, 310, 90, 380), { color: 'secondary', flipX: true, animation: { entrance: 'fade', delaySec: 0.9, motion: 'twinkle' } }),
    ...framedPhoto(265, 300, 280, 318, 1.3),
    orn('base', 'mandalaHalf', at(295, 724, 220, 112), { color: 'secondary', foil: true, flipY: true, animation: { entrance: 'fadeUp', delaySec: 0.6, durationSec: 1.2 } }),
    orn('flourish', 'flourish', at(870, 128, 260, 52), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('names', TITLE, at(700, 186, 600, 150), { font: 'script', size: 92, color: 'secondary', foil: true, shadow: 'soft', lineHeight: 1.04 }, { animation: { entrance: 'fadeUp', delaySec: 0.3, motion: 'shimmer' } }),
    text('date', b('event.startDate', { format: 'date' }), at(760, 340, 480, 40), { font: 'heading', size: 30, italic: true, color: 'accent', letterSpacing: 0.02 }, { animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('venue', VENUE_LINE, at(730, 382, 540, 54), { font: 'script', size: 38, color: 'accent', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    ...rsvpBlock({ cx: 1000, y: 486, panel: 'primary', metal: 'secondary', pill: ['accent', 'secondary'], pillInk: 'primary', ink: 'accent', font: 'heading', scale: 1.3 }),
    ...timeline({ xs: [850, 1000, 1150], y: 606, width: 140, metal: 'secondary', dot: 'accent', ink: 'accent', dateInk: 'accent', nameFont: 'heading', dateFont: 'heading', scale: 1.3 }),
    text('closing', t('template.footer.thanks'), at(760, 730, 480, 30), { font: 'heading', size: 19, italic: true, color: 'secondary', letterSpacing: 0.02 }, { animation: { entrance: 'fade', delaySec: 1.2 } }),
  ],
};

const maroonCard: ArtboardInput = {
  width: 390,
  height: 640,
  background: MAROON_STOCK,
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 640), { color: 'secondary', foil: true }),
    orn('crown', 'mandalaHalf', at(105, 33, 180, 92), { color: 'secondary', foil: true, animation: { entrance: 'fadeDown', durationSec: 1 } }),
    text('eyebrow', t('template.schedule.title'), at(50, 134, 290, 18), { font: 'body', size: 10, weight: 600, color: 'accent', letterSpacing: 0.32, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 0.1 } }),
    text('name', b('function.name'), at(40, 152, 310, 64), { font: 'script', size: 46, color: 'secondary', foil: true, shadow: 'soft', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.15 } }),
    orn('flourish', 'flourish', at(120, 218, 150, 30), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.25 } }),
    text('description', b('function.description'), at(56, 250, 278, 24), { font: 'heading', size: 15, italic: true, color: 'accent', lineHeight: 1.25 }, { visibleWhen: { exists: 'function.description' }, animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('date', b('function.date', { format: 'dateWithWeekday' }), at(40, 284, 310, 28), { font: 'heading', size: 19, italic: true, color: 'accent' }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    text('time', b('function.time', { format: 'time' }), at(60, 312, 270, 22), { font: 'heading', size: 15, weight: 600, color: 'secondary', letterSpacing: 0.16, transform: 'upper' }, { visibleWhen: { exists: 'function.startsAt' }, animation: { entrance: 'fadeUp', delaySec: 0.35 } }),
    text('venue', b('function.venue.name'), at(44, 344, 302, 56), { font: 'script', size: 28, color: 'accent', lineHeight: 1.08 }, { visibleWhen: { exists: 'function.venue.name' }, animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('address', b('function.venue.address'), at(56, 400, 278, 34), { font: 'body', size: 10.5, weight: 500, color: 'accent', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 }, { visibleWhen: { exists: 'function.venue.address' }, animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    ...stationeryButtons(452, 46, 298, { fill: 'secondary', ink: 'primary', font: 'heading', size: 14.5 }),
    orn('base', 'mandalaHalf', at(115, 525, 160, 82), { color: 'secondary', foil: true, flipY: true }),
  ],
};

// ─────────────────────────── Kalyana Zari: South Indian temple gold on emerald ───────────────────────────

/** Where a photo sits inside a prabhavali layer at (x, y, w): its opening under the flame arch. */
const prabhavaliOpening = (x: number, y: number, w: number) => {
  const h = (w * 420) / 300;
  return at(Math.round(x + w * (70 / 300)), Math.round(y + h * (120 / 420)), Math.round(w * (160 / 300)), Math.round(h * (252 / 420)));
};

const SILK = { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } } as const;
/** Kolam flowers woven into the silk, faint (kept under the contrast check's threshold, so text is checked against the silk). */
const buttas = (w: number, h: number) => shape('buttas', 'rect', at(0, 0, w, h), { fill: { type: 'pattern', pattern: 'rangoli', color: 'secondary', base: 'transparent', strength: 0.11 }, opacity: 0.8 });

/** The shrine: a prabhavali with a lamp in its opening (a photo replaces it), and two standing lamps beside it. */
function shrine(x: number, y: number, w: number, lampW: number, lampY: number): LayerInput[] {
  const open = prabhavaliOpening(x, y, w);
  const lampH = lampW * 2.5;
  const inner = Math.round(open.w * 0.42);
  return [
    shape('sanctum', 'arch', open, { fill: { type: 'gradient', gradient: { from: 'accent', via: 'primary', to: 'text', angle: 180 } }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    orn('sanctum-glow', 'sparkles', at(open.x, open.y, open.w, open.h * 0.7), { color: 'secondary', opacity: 0.8 }),
    orn('sanctum-lamp', 'kuthuvilakku', at(Math.round(open.x + (open.w - inner) / 2), Math.round(open.y + open.h - inner * 2.5 - 6), inner, Math.round(inner * 2.5)), { color: 'secondary', animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    photo('photo', 'photo.cover', open, { mask: 'arch', animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
    orn('prabhavali', 'prabhavali', at(x, y, w, Math.round((w * 420) / 300)), { color: 'secondary', shadow: 'soft', animation: { entrance: 'zoomIn', durationSec: 1.1 } }),
    orn('lamp-left', 'kuthuvilakku', at(Math.round(x - lampW * 0.55), lampY, lampW, Math.round(lampH)), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    orn('lamp-right', 'kuthuvilakku', at(Math.round(x + w - lampW * 0.45), lampY, lampW, Math.round(lampH)), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeUp', delaySec: 0.55 } }),
  ];
}

const ZARI_EYEBROW: TextStyleInput = { font: 'body', size: 10.5, weight: 600, color: 'secondary', letterSpacing: 0.34, transform: 'upper' };

const zariHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: SILK,
  texture: 'linen',
  textureStrength: 0.45,
  layers: [
    buttas(390, 844),
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'secondary', foil: true }),
    orn('zari-top', 'zariBand', at(0, 0, 390, 58), { color: 'secondary', foil: true, animation: { entrance: 'fadeDown' } }),
    orn('zari-bottom', 'zariBand', at(0, 786, 390, 58), { color: 'secondary', foil: true, flipY: true, animation: { entrance: 'fadeUp' } }),
    ...shrine(88, 72, 214, 52, 262),
    text('eyebrow', t('template.weddingOf'), at(40, 380, 310, 18), ZARI_EYEBROW, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.5 } }),
    text('eyebrow-2', t('template.engagementOf'), at(40, 380, 310, 18), ZARI_EYEBROW, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.5 } }),
    text('names', TITLE, at(30, 398, 330, 76), { font: 'heading', size: 33, weight: 600, color: 'secondary', foil: true, shadow: 'soft', letterSpacing: 0.04, lineHeight: 1.18, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.55, motion: 'shimmer' } }),
    orn('lotus', 'lotus', at(165, 476, 60, 36), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.6 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 518, 330, 22), { font: 'body', size: 12.5, weight: 600, color: 'background', letterSpacing: 0.16, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    text('venue', VENUE_LINE, at(40, 542, 310, 46), { font: 'script', size: 24, color: 'secondary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.7 } }),
    ...rsvpBlock({ cx: 195, y: 604, panel: 'primary', metal: 'secondary', pill: ['secondary', 'secondary'], pillInk: 'primary', ink: 'background', font: 'body', size: 13.5, scale: 0.94, delay: 0.8 }),
    ...timeline({ xs: [96, 195, 294], y: 680, width: 100, metal: 'secondary', dot: 'accent', ink: 'background', dateInk: 'secondary', nameFont: 'heading', dateFont: 'script', dateItalic: false, dateSize: 16, dateWidth: 76, dateLines: 2, nameSize: 14.5, delay: 0.95 }),
    text('blessings', t('template.blessings'), at(40, 766, 310, 16), { font: 'body', size: 8.5, weight: 600, color: 'secondary', letterSpacing: 0.18, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 1.2 } }),
  ],
};

const zariHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: SILK,
  texture: 'linen',
  textureStrength: 0.45,
  layers: [
    buttas(1440, 900),
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'secondary', foil: true }),
    orn('zari-top', 'zariBand', at(0, 0, 1440, 72), { color: 'secondary', foil: true, animation: { entrance: 'fadeDown' } }),
    orn('zari-bottom', 'zariBand', at(0, 828, 1440, 72), { color: 'secondary', foil: true, flipY: true, animation: { entrance: 'fadeUp' } }),
    ...shrine(880, 116, 400, 96, 440),
    text('eyebrow', t('template.weddingOf'), at(170, 196, 600, 26), { ...ZARI_EYEBROW, size: 15 }, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.5 } }),
    text('eyebrow-2', t('template.engagementOf'), at(170, 196, 600, 26), { ...ZARI_EYEBROW, size: 15 }, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.5 } }),
    text('names', TITLE, at(140, 226, 660, 150), { font: 'heading', size: 58, weight: 600, color: 'secondary', foil: true, shadow: 'soft', letterSpacing: 0.04, lineHeight: 1.15, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.55, motion: 'shimmer' } }),
    orn('lotus', 'lotus', at(420, 376, 100, 60), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.6 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(170, 444, 600, 30), { font: 'body', size: 17, weight: 600, color: 'background', letterSpacing: 0.16, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    text('venue', VENUE_LINE, at(170, 478, 600, 56), { font: 'script', size: 38, color: 'secondary', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.7 } }),
    ...rsvpBlock({ cx: 470, y: 572, panel: 'primary', metal: 'secondary', pill: ['secondary', 'secondary'], pillInk: 'primary', ink: 'background', font: 'body', size: 13.5, scale: 1.25, delay: 0.8 }),
    ...timeline({ xs: [330, 470, 610], y: 676, width: 140, metal: 'secondary', dot: 'accent', ink: 'background', dateInk: 'secondary', nameFont: 'heading', dateFont: 'script', dateItalic: false, dateSize: 16, dateWidth: 76, dateLines: 2, nameSize: 14.5, scale: 1.25, delay: 0.95 }),
    text('blessings', t('template.blessings'), at(170, 774, 600, 22), { font: 'body', size: 11, weight: 600, color: 'secondary', letterSpacing: 0.18, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 1.2 } }),
  ],
};

const zariCard: ArtboardInput = {
  width: 390,
  height: 620,
  background: SILK,
  texture: 'linen',
  textureStrength: 0.45,
  layers: [
    buttas(390, 620),
    orn('frame', 'hairlineFrame', at(0, 0, 390, 620), { color: 'secondary', foil: true }),
    orn('zari-top', 'zariBand', at(0, 0, 390, 46), { color: 'secondary', foil: true }),
    orn('zari-bottom', 'zariBand', at(0, 574, 390, 46), { color: 'secondary', foil: true, flipY: true }),
    orn('lamp', 'kuthuvilakku', at(176, 58, 38, 95), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeDown', delaySec: 0.1 } }),
    text('eyebrow', t('template.schedule.title'), at(50, 160, 290, 18), { ...ZARI_EYEBROW, size: 10 }, { animation: { entrance: 'fade', delaySec: 0.15 } }),
    text('name', b('function.name'), at(36, 180, 318, 50), { font: 'heading', size: 30, weight: 600, color: 'secondary', foil: true, shadow: 'soft', letterSpacing: 0.05, transform: 'upper', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    orn('lotus', 'lotus', at(170, 232, 50, 30), { color: 'secondary', foil: true }),
    text('description', b('function.description'), at(56, 266, 278, 24), { font: 'script', size: 21, color: 'background', lineHeight: 1.2 }, { visibleWhen: { exists: 'function.description' }, animation: { entrance: 'fadeUp', delaySec: 0.25 } }),
    text('date', b('function.date', { format: 'dateWithWeekday' }), at(36, 300, 318, 24), { font: 'body', size: 13, weight: 600, color: 'background', letterSpacing: 0.14, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    text('time', b('function.time', { format: 'time' }), at(60, 326, 270, 22), { font: 'heading', size: 16, weight: 600, color: 'secondary', letterSpacing: 0.12, transform: 'upper' }, { visibleWhen: { exists: 'function.startsAt' }, animation: { entrance: 'fadeUp', delaySec: 0.35 } }),
    text('venue', b('function.venue.name'), at(44, 356, 302, 54), { font: 'script', size: 27, color: 'secondary', lineHeight: 1.08 }, { visibleWhen: { exists: 'function.venue.name' }, animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('address', b('function.venue.address'), at(56, 406, 278, 32), { font: 'body', size: 10, weight: 500, color: 'background', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 }, { visibleWhen: { exists: 'function.venue.address' }, animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    ...stationeryButtons(456, 46, 298, { fill: 'secondary', ink: 'primary', font: 'body', size: 12.5, radius: 6 }),
    orn('kolam', 'kolam', at(165, 510, 60, 60), { color: 'secondary', opacity: 0.55 }),
  ],
};

// ─────────────────────────── A card for every function ───────────────────────────

interface FnStyle {
  height: number;
  background: NonNullable<ArtboardInput['background']>;
  texture: NonNullable<ArtboardInput['texture']>;
  textureStrength: number;
  /** Frames, bands and crests, drawn under the words. */
  decor: LayerInput[];
  /** Where the words start. */
  top: number;
  eyebrowInk: Role;
  name: TextStyleInput;
  /** A small ornament under the name. */
  divider?: (y: number) => LayerInput[];
  description: TextStyleInput;
  date: TextStyleInput;
  time: TextStyleInput;
  venue: TextStyleInput;
  address: TextStyleInput;
  buttons: ButtonStyle;
  /** Ornaments over the foot of the card. */
  finish?: LayerInput[];
}

/** One function's card: its name, a line about it, the date and time, the venue and address, directions and the calendar. */
function fnCard(s: FnStyle): ArtboardInput {
  const y = s.top;
  return {
    width: 390,
    height: s.height,
    background: s.background,
    texture: s.texture,
    textureStrength: s.textureStrength,
    layers: [
      ...s.decor,
      text('eyebrow', t('template.schedule.title'), at(50, y, 290, 18), { font: 'body', size: 10, weight: 600, color: s.eyebrowInk, letterSpacing: 0.32, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 0.1 } }),
      text('name', b('function.name'), at(32, y + 18, 326, 60), s.name, { animation: { entrance: 'fadeUp', delaySec: 0.15 } }),
      ...(s.divider ? s.divider(y + 82) : []),
      text('description', b('function.description'), at(52, y + 114, 286, 26), s.description, { visibleWhen: { exists: 'function.description' }, animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
      text('date', b('function.date', { format: 'dateWithWeekday' }), at(32, y + 146, 326, 26), s.date, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
      text('time', b('function.time', { format: 'time' }), at(60, y + 172, 270, 22), s.time, { visibleWhen: { exists: 'function.startsAt' }, animation: { entrance: 'fadeUp', delaySec: 0.35 } }),
      text('venue', b('function.venue.name'), at(40, y + 198, 310, 58), s.venue, { visibleWhen: { exists: 'function.venue.name' }, animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
      text('address', b('function.venue.address'), at(52, y + 252, 286, 32), s.address, { visibleWhen: { exists: 'function.venue.address' }, animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
      ...stationeryButtons(y + 296, 46, 298, s.buttons),
      ...(s.finish ?? []),
    ],
  };
}

/** Three small diamonds in a row: a divider. */
const diamonds = (cx: number, y: number, color: Role, size = 9): LayerInput[] =>
  [-1, 0, 1].map((k) => shape(`divider-${k + 2}`, 'diamond', at(cx + k * size * 1.9 - (k ? size * 0.35 : size * 0.5), y - (k ? size * 0.35 : size * 0.5), k ? size * 0.7 : size, k ? size * 0.7 : size), { fill: { type: 'color', color }, animation: { entrance: 'fade', delaySec: 0.5 } }));

// ─────────────────────────── Phulkari: Anand Karaj ───────────────────────────

const KHADDAR = { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } } as const;
const PHUL_EYEBROW: TextStyleInput = { font: 'body', size: 11, weight: 600, color: 'background', letterSpacing: 0.34, transform: 'upper' };

/** The photo in a diamond ringed by silk outlines, a jewel at each point; the monogram waits in it until there is a photo. */
function diamondPhoto(cx: number, cy: number, size: number, k = 1): LayerInput[] {
  const d = (id: string, s: number, extra: Partial<Extract<LayerInput, { kind: 'shape' }>>) => shape(id, 'diamond', at(cx - s / 2, cy - s / 2, s, s), extra);
  return [
    d('photo-ring-2', size * 1.3, { fill: { type: 'none' }, stroke: { width: 1 * k, color: 'accent' }, animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
    d('photo-ring-1', size * 1.15, { fill: { type: 'none' }, stroke: { width: 1.6 * k, color: 'secondary' }, animation: { entrance: 'zoomIn', delaySec: 0.25 } }),
    d('photo-bg', size, { fill: { type: 'gradient', gradient: { from: 'primary', to: 'text', angle: 180 } }, stroke: { width: 1.2 * k, color: 'accent' }, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.2 } }),
    orn('photo-silk', 'geometric', at(cx - size * 0.34, cy - size * 0.34, size * 0.68, size * 0.68), { color: 'secondary', opacity: 0.5, animation: { entrance: 'fade', delaySec: 0.4, motion: 'spin' } }),
    text('monogram', MONOGRAM, at(cx - size * 0.38, cy - 26 * k, size * 0.76, 52 * k), { font: 'heading', size: 34 * k, color: 'secondary', foil: true, shadow: 'soft', lineHeight: 1 }, { animation: { entrance: 'zoomIn', delaySec: 0.45 } }),
    photo('photo', 'photo.cover', at(cx - size / 2 + 2, cy - size / 2 + 2, size - 4, size - 4), { mask: 'diamond', animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
    ...([
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const).map(([dx, dy], i) => shape(`photo-jewel-${i + 1}`, 'diamond', at(cx + dx * size * 0.65 - 7 * k, cy + dy * size * 0.65 - 7 * k, 14 * k, 14 * k), { fill: { type: 'color', color: 'secondary' }, stroke: { width: 1 * k, color: 'accent' }, animation: { entrance: 'pop', delaySec: 0.5 } })),
  ];
}

const phulHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: KHADDAR,
  texture: 'linen',
  textureStrength: 0.55,
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'secondary', foil: true }),
    orn('band-top', 'phulkari', at(0, 0, 390, 62), { color: 'secondary', animation: { entrance: 'fadeDown' } }),
    orn('band-bottom', 'phulkari', at(0, 782, 390, 62), { color: 'secondary', flipY: true, animation: { entrance: 'fadeUp' } }),
    text('eyebrow', lit('Anand Karaj'), at(40, 88, 310, 20), PHUL_EYEBROW, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('eyebrow-2', t('template.engagementOf'), at(40, 88, 310, 20), PHUL_EYEBROW, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    ...diamondPhoto(195, 246, 176),
    text('names', TITLE, at(24, 386, 342, 84), { font: 'heading', size: 36, color: 'secondary', foil: true, shadow: 'soft', lineHeight: 1.12 }, { animation: { entrance: 'fadeUp', delaySec: 0.5, motion: 'shimmer' } }),
    ...diamonds(195, 478, 'secondary'),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 494, 330, 22), { font: 'body', size: 12.5, weight: 600, color: 'background', letterSpacing: 0.16, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('venue', VENUE_LINE, at(40, 516, 310, 46), { font: 'script', size: 24, color: 'secondary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 195, y: 582, panel: 'primary', metal: 'secondary', pill: ['secondary', 'secondary'], pillInk: 'primary', ink: 'background', font: 'body', size: 13.5, scale: 0.94, delay: 0.75 }),
    ...timeline({ xs: [96, 195, 294], y: 656, width: 100, metal: 'secondary', dot: 'accent', dotShape: 'diamond', ink: 'background', dateInk: 'secondary', nameFont: 'heading', dateFont: 'script', dateItalic: false, dateSize: 17, dateWidth: 76, dateLines: 2, nameSize: 15, delay: 0.9 }),
    text('blessings', t('template.blessings'), at(40, 752, 310, 16), { font: 'body', size: 8.5, weight: 600, color: 'secondary', letterSpacing: 0.18, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 1.2 } }),
  ],
};

const phulHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: KHADDAR,
  texture: 'linen',
  textureStrength: 0.55,
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'secondary', foil: true }),
    orn('band-top', 'phulkari', at(0, 0, 1440, 78), { color: 'secondary', animation: { entrance: 'fadeDown' } }),
    orn('band-bottom', 'phulkari', at(0, 822, 1440, 78), { color: 'secondary', flipY: true, animation: { entrance: 'fadeUp' } }),
    ...diamondPhoto(440, 455, 330, 1.6),
    text('eyebrow', lit('Anand Karaj'), at(700, 170, 600, 26), { ...PHUL_EYEBROW, size: 15 }, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('eyebrow-2', t('template.engagementOf'), at(700, 170, 600, 26), { ...PHUL_EYEBROW, size: 15 }, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('names', TITLE, at(680, 200, 640, 150), { font: 'heading', size: 64, color: 'secondary', foil: true, shadow: 'soft', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.5, motion: 'shimmer' } }),
    ...diamonds(1000, 368, 'secondary', 12),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(700, 392, 600, 30), { font: 'body', size: 17, weight: 600, color: 'background', letterSpacing: 0.16, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('venue', VENUE_LINE, at(700, 424, 600, 56), { font: 'script', size: 40, color: 'secondary', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 1000, y: 528, panel: 'primary', metal: 'secondary', pill: ['secondary', 'secondary'], pillInk: 'primary', ink: 'background', font: 'body', size: 13.5, scale: 1.25, delay: 0.75 }),
    ...timeline({ xs: [860, 1000, 1140], y: 640, width: 140, metal: 'secondary', dot: 'accent', dotShape: 'diamond', ink: 'background', dateInk: 'secondary', nameFont: 'heading', dateFont: 'script', dateItalic: false, dateSize: 17, dateWidth: 76, dateLines: 2, nameSize: 15, scale: 1.25, delay: 0.9 }),
    text('blessings', t('template.blessings'), at(700, 770, 600, 22), { font: 'body', size: 11, weight: 600, color: 'secondary', letterSpacing: 0.18, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 1.2 } }),
  ],
};

const phulCard = fnCard({
  height: 620,
  background: KHADDAR,
  texture: 'linen',
  textureStrength: 0.55,
  decor: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 620), { color: 'secondary', foil: true }),
    orn('band-top', 'phulkari', at(0, 0, 390, 48), { color: 'secondary' }),
    orn('band-bottom', 'phulkari', at(0, 572, 390, 48), { color: 'secondary', flipY: true }),
    shape('crest-ring', 'diamond', at(175, 62, 40, 40), { fill: { type: 'none' }, stroke: { width: 1.4, color: 'secondary' } }),
    shape('crest', 'diamond', at(183, 70, 24, 24), { fill: { type: 'gradient', gradient: { from: 'secondary', to: 'accent', angle: 180 } } }),
  ],
  top: 118,
  eyebrowInk: 'background',
  name: { font: 'heading', size: 34, color: 'secondary', foil: true, shadow: 'soft', lineHeight: 1.1 },
  divider: (y) => diamonds(195, y + 6, 'secondary', 8),
  description: { font: 'script', size: 21, color: 'background', lineHeight: 1.2 },
  date: { font: 'body', size: 12.5, weight: 600, color: 'background', letterSpacing: 0.14, transform: 'upper' },
  time: { font: 'heading', size: 17, color: 'secondary', letterSpacing: 0.06 },
  venue: { font: 'script', size: 28, color: 'secondary', lineHeight: 1.08 },
  address: { font: 'body', size: 10, weight: 500, color: 'background', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'secondary', ink: 'primary', font: 'body', size: 12.5, radius: 4 },
});

// ─────────────────────────── Mehrab: a nikah under a Mughal arch ───────────────────────────

const PEARL = { type: 'gradient', gradient: { kind: 'radial', from: 'surface', to: 'background' } } as const;
const MEHRAB_EYEBROW: TextStyleInput = { font: 'body', size: 10.5, weight: 600, color: 'muted', letterSpacing: 0.34, transform: 'upper' };

const mehrabHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: PEARL,
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    orn('mihrab', 'mihrab', at(14, 14, 362, 816), { color: 'secondary', animation: { entrance: 'fade', durationSec: 1.2 } }),
    orn('lantern', 'lantern', at(178, 76, 34, 72), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: 0.3, motion: 'sway' } }),
    text('eyebrow', t('template.weddingOf'), at(40, 196, 310, 18), MEHRAB_EYEBROW, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('eyebrow-2', t('template.engagementOf'), at(40, 196, 310, 18), MEHRAB_EYEBROW, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('names', TITLE, at(62, 216, 266, 112), { font: 'script', size: 46, color: 'primary', lineHeight: 1.06 }, { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    orn('star', 'arabesque', at(177, 334, 36, 36), { color: 'accent', animation: { entrance: 'zoomIn', delaySec: 0.6, motion: 'spin' } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(36, 382, 318, 22), { font: 'heading', size: 15, color: 'text', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    text('venue', VENUE_LINE, at(44, 406, 302, 48), { font: 'script', size: 25, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.7 } }),
    ...timeline({ xs: [104, 195, 286], y: 476, width: 92, metal: 'secondary', dot: 'accent', ink: 'text', dateInk: 'primary', nameFont: 'heading', dateFont: 'script', dateItalic: false, dateSize: 17, dateWidth: 76, dateLines: 2, nameSize: 14, delay: 0.85 }),
    ...rsvpBlock({ cx: 195, y: 586, panel: 'surface', metal: 'secondary', pill: ['primary', 'primary'], pillInk: 'surface', ink: 'primary', font: 'heading', size: 14, scale: 0.94, delay: 0.95 }),
    text('closing', t('template.footer.thanks'), at(48, 668, 294, 40), { font: 'script', size: 22, color: 'muted', lineHeight: 1.15 }, { animation: { entrance: 'fade', delaySec: 1.1 } }),
    orn('skyline', 'domes', at(85, 704, 220, 128), { color: 'secondary', opacity: 0.32, animation: { entrance: 'fadeUp', delaySec: 1.1 } }),
  ],
};

const mehrabHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: PEARL,
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    orn('domes-l', 'domes', at(30, 600, 470, 272), { color: 'secondary', opacity: 0.3, animation: { entrance: 'fadeUp', delaySec: 0.8 } }),
    orn('domes-r', 'domes', at(940, 600, 470, 272), { color: 'secondary', opacity: 0.3, animation: { entrance: 'fadeUp', delaySec: 0.8 } }),
    orn('lantern-l', 'lantern', at(240, 0, 50, 136), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: 0.3, motion: 'sway' } }),
    orn('lantern-l2', 'lantern', at(140, 0, 36, 92), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: 0.4, motion: 'sway' } }),
    orn('lantern-r', 'lantern', at(1150, 0, 50, 136), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: 0.35, motion: 'sway' } }),
    orn('lantern-r2', 'lantern', at(1264, 0, 36, 92), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: 0.45, motion: 'sway' } }),
    orn('mihrab', 'mihrab', at(410, 14, 620, 872), { color: 'secondary', animation: { entrance: 'fade', durationSec: 1.2 } }),
    orn('lantern', 'lantern', at(698, 110, 44, 92), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: 0.3, motion: 'sway' } }),
    text('eyebrow', t('template.weddingOf'), at(520, 236, 400, 22), { ...MEHRAB_EYEBROW, size: 13 }, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('eyebrow-2', t('template.engagementOf'), at(520, 236, 400, 22), { ...MEHRAB_EYEBROW, size: 13 }, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('names', TITLE, at(500, 262, 440, 140), { font: 'script', size: 70, color: 'primary', lineHeight: 1.06 }, { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    orn('star', 'arabesque', at(696, 410, 48, 48), { color: 'accent', animation: { entrance: 'zoomIn', delaySec: 0.6, motion: 'spin' } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(500, 472, 440, 28), { font: 'heading', size: 19, color: 'text', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    text('venue', VENUE_LINE, at(500, 502, 440, 52), { font: 'script', size: 36, color: 'primary', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.7 } }),
    ...timeline({ xs: [598, 720, 842], y: 574, width: 116, metal: 'secondary', dot: 'accent', ink: 'text', dateInk: 'primary', nameFont: 'heading', dateFont: 'script', dateItalic: false, dateSize: 17, dateWidth: 76, dateLines: 2, nameSize: 15, delay: 0.85 }),
    ...rsvpBlock({ cx: 720, y: 694, panel: 'surface', metal: 'secondary', pill: ['primary', 'primary'], pillInk: 'surface', ink: 'primary', font: 'heading', size: 14, delay: 0.95 }),
    text('closing', t('template.footer.thanks'), at(520, 780, 400, 32), { font: 'script', size: 24, color: 'muted' }, { animation: { entrance: 'fade', delaySec: 1.1 } }),
  ],
};

const mehrabCard = fnCard({
  height: 640,
  background: PEARL,
  texture: 'paper',
  textureStrength: 0.5,
  decor: [
    orn('mihrab', 'mihrab', at(12, 12, 366, 616), { color: 'secondary' }),
    orn('lantern', 'lantern', at(181, 64, 28, 58), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', motion: 'sway' } }),
  ],
  top: 140,
  eyebrowInk: 'muted',
  name: { font: 'script', size: 44, color: 'primary', lineHeight: 1.05 },
  divider: (y) => [orn('star', 'arabesque', at(181, y - 4, 28, 28), { color: 'accent' })],
  description: { font: 'script', size: 20, color: 'muted', lineHeight: 1.2 },
  date: { font: 'heading', size: 14.5, color: 'text', letterSpacing: 0.1, transform: 'upper' },
  time: { font: 'heading', size: 16, color: 'secondary', letterSpacing: 0.08 },
  venue: { font: 'script', size: 28, color: 'primary', lineHeight: 1.08 },
  address: { font: 'body', size: 10, weight: 500, color: 'muted', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'primary', ink: 'surface', font: 'heading', size: 14, radius: 40 },
});

// ─────────────────────────── Lal Paar: a Bengali wedding ───────────────────────────

const LAAL_EYEBROW: TextStyleInput = { font: 'heading', size: 22, italic: true, weight: 500, color: 'primary', letterSpacing: 0.02 };

/** The alpana with the photo at its heart (its lotus shows until there is a photo). */
function alpanaPhoto(x: number, y: number, size: number): LayerInput[] {
  const p = size * 0.44;
  const cx = x + size / 2;
  const cy = y + size / 2;
  return [
    orn('alpana', 'alpana', at(x, y, size, size), { color: 'primary', animation: { entrance: 'zoomIn', durationSec: 1.1, motion: 'spin' } }),
    shape('photo-ring', 'ellipse', at(cx - p / 2 - 5, cy - p / 2 - 5, p + 10, p + 10), { fill: { type: 'none' }, stroke: { width: 1.4, color: 'secondary' }, visibleWhen: { exists: 'photo.cover' } }),
    photo('photo', 'photo.cover', at(cx - p / 2, cy - p / 2, p, p), { mask: 'circle', border: { width: 3, color: 'surface' }, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
  ];
}

const laalHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: PEARL,
  texture: 'paper',
  textureStrength: 0.55,
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'primary' }),
    orn('band-top', 'laalPaar', at(0, 0, 390, 64), { color: 'primary', animation: { entrance: 'fadeDown' } }),
    orn('band-bottom', 'laalPaar', at(0, 780, 390, 64), { color: 'primary', flipY: true, animation: { entrance: 'fadeUp' } }),
    text('eyebrow', lit('Shubho Bibaho'), at(40, 78, 310, 30), LAAL_EYEBROW, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('eyebrow-2', t('template.engagementOf'), at(40, 78, 310, 30), LAAL_EYEBROW, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    ...alpanaPhoto(80, 112, 230),
    text('names', TITLE, at(24, 352, 342, 90), { font: 'heading', size: 40, weight: 600, color: 'primary', lineHeight: 1.06 }, { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    orn('lotus', 'lotus', at(167, 444, 56, 34), { color: 'secondary', animation: { entrance: 'fade', delaySec: 0.55 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 486, 330, 22), { font: 'body', size: 12, weight: 600, color: 'text', letterSpacing: 0.16, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('venue', VENUE_LINE, at(40, 508, 310, 46), { font: 'script', size: 24, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 195, y: 578, panel: 'surface', metal: 'primary', pill: ['primary', 'primary'], pillInk: 'surface', ink: 'primary', font: 'heading', size: 16, scale: 0.94, delay: 0.75 }),
    ...timeline({ xs: [96, 195, 294], y: 652, width: 100, metal: 'primary', dot: 'secondary', ink: 'text', dateInk: 'primary', nameFont: 'heading', dateFont: 'heading', dateSize: 13, nameSize: 16, delay: 0.9 }),
    text('closing', t('template.footer.thanks'), at(40, 736, 310, 24), { font: 'heading', size: 15, italic: true, color: 'primary' }, { animation: { entrance: 'fade', delaySec: 1.1 } }),
  ],
};

const laalHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: PEARL,
  texture: 'paper',
  textureStrength: 0.55,
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'primary' }),
    orn('band-top', 'laalPaar', at(0, 0, 1440, 80), { color: 'primary', animation: { entrance: 'fadeDown' } }),
    orn('band-bottom', 'laalPaar', at(0, 820, 1440, 80), { color: 'primary', flipY: true, animation: { entrance: 'fadeUp' } }),
    ...alpanaPhoto(200, 190, 520),
    text('eyebrow', lit('Shubho Bibaho'), at(780, 168, 520, 40), { ...LAAL_EYEBROW, size: 30 }, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('eyebrow-2', t('template.engagementOf'), at(780, 168, 520, 40), { ...LAAL_EYEBROW, size: 30 }, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('names', TITLE, at(760, 212, 560, 150), { font: 'heading', size: 72, weight: 600, color: 'primary', lineHeight: 1.04 }, { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    orn('lotus', 'lotus', at(995, 366, 90, 54), { color: 'secondary', animation: { entrance: 'fade', delaySec: 0.55 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(780, 430, 520, 28), { font: 'body', size: 16, weight: 600, color: 'text', letterSpacing: 0.16, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('venue', VENUE_LINE, at(780, 462, 520, 56), { font: 'script', size: 38, color: 'primary', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 1040, y: 560, panel: 'surface', metal: 'primary', pill: ['primary', 'primary'], pillInk: 'surface', ink: 'primary', font: 'heading', size: 16, scale: 1.25, delay: 0.75 }),
    ...timeline({ xs: [900, 1040, 1180], y: 670, width: 140, metal: 'primary', dot: 'secondary', ink: 'text', dateInk: 'primary', nameFont: 'heading', dateFont: 'heading', dateSize: 13, nameSize: 16, scale: 1.25, delay: 0.9 }),
    text('closing', t('template.footer.thanks'), at(780, 770, 520, 30), { font: 'heading', size: 19, italic: true, color: 'primary' }, { animation: { entrance: 'fade', delaySec: 1.1 } }),
  ],
};

const laalCard = fnCard({
  height: 620,
  background: PEARL,
  texture: 'paper',
  textureStrength: 0.55,
  decor: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 620), { color: 'primary' }),
    orn('band-top', 'laalPaar', at(0, 0, 390, 52), { color: 'primary' }),
    orn('band-bottom', 'laalPaar', at(0, 568, 390, 52), { color: 'primary', flipY: true }),
    orn('alpana', 'alpana', at(165, 60, 60, 60), { color: 'primary', animation: { entrance: 'zoomIn', motion: 'spin' } }),
  ],
  top: 124,
  eyebrowInk: 'muted',
  name: { font: 'heading', size: 38, weight: 600, color: 'primary', lineHeight: 1.05 },
  divider: (y) => [orn('lotus', 'lotus', at(173, y - 6, 44, 26), { color: 'secondary' })],
  description: { font: 'heading', size: 16, italic: true, color: 'muted', lineHeight: 1.2 },
  date: { font: 'body', size: 12, weight: 600, color: 'text', letterSpacing: 0.14, transform: 'upper' },
  time: { font: 'heading', size: 18, italic: true, color: 'primary' },
  venue: { font: 'script', size: 27, color: 'primary', lineHeight: 1.08 },
  address: { font: 'body', size: 10, weight: 500, color: 'muted', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'primary', ink: 'surface', font: 'heading', size: 15, radius: 4 },
});

// ─────────────────────────── Champagne Wreath: an engagement ───────────────────────────

const BLUSH = { type: 'gradient', gradient: { from: 'surface', to: 'background', angle: 180 } } as const;
const WREATH_EYEBROW: TextStyleInput = { font: 'body', size: 10.5, weight: 600, color: 'muted', letterSpacing: 0.34, transform: 'upper' };

/** A gold wreath around the couple's photo (their monogram until there is one). */
function wreathPhoto(x: number, y: number, size: number): LayerInput[] {
  const p = size * 0.56;
  const cx = x + size / 2;
  const cy = y + size / 2;
  return [
    shape('photo-bg', 'ellipse', at(cx - p / 2, cy - p / 2, p, p), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', via: 'surface', to: 'background' } }, stroke: { width: 1, color: 'secondary' }, animation: { entrance: 'zoomIn', delaySec: 0.2 } }),
    text('monogram', MONOGRAM, at(cx - p / 2, cy - p * 0.24, p, p * 0.48), { font: 'script', size: p * 0.34, color: 'primary', lineHeight: 1 }, { animation: { entrance: 'zoomIn', delaySec: 0.35 } }),
    photo('photo', 'photo.cover', at(cx - p / 2, cy - p / 2, p, p), { mask: 'circle', border: { width: 2, color: 'secondary' }, animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
    orn('wreath', 'botanicalWreath', at(x, y, size, size), { color: 'secondary', animation: { entrance: 'zoomIn', durationSec: 1.1 } }),
  ];
}

const wreathHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: BLUSH,
  texture: 'watercolor',
  textureStrength: 0.55,
  layers: [
    shape('wash', 'ellipse', at(-40, 60, 470, 440), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', via: 'transparent', to: 'transparent' } }, opacity: 0.9 }),
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'secondary', foil: true }),
    ...wreathPhoto(50, 74, 290),
    orn('rings', 'rings', at(167, 362, 56, 41), { color: 'secondary', animation: { entrance: 'pop', delaySec: 0.5 } }),
    text('eyebrow', t('template.engagementOf'), at(40, 412, 310, 18), WREATH_EYEBROW, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.45 } }),
    text('eyebrow-2', t('template.weddingOf'), at(40, 412, 310, 18), WREATH_EYEBROW, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.45 } }),
    text('names', TITLE, at(44, 430, 302, 96), { font: 'script', size: 48, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 532, 330, 24), { font: 'heading', size: 16, weight: 600, color: 'text', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('venue', VENUE_LINE, at(40, 558, 310, 42), { font: 'heading', size: 19, italic: true, color: 'text', lineHeight: 1.15 }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 195, y: 626, panel: 'surface', metal: 'secondary', pill: ['primary', 'primary'], pillInk: 'surface', ink: 'primary', font: 'heading', size: 16, scale: 0.94, delay: 0.75 }),
    text('closing', t('template.footer.thanks'), at(40, 726, 310, 24), { font: 'heading', size: 16, italic: true, color: 'muted' }, { animation: { entrance: 'fade', delaySec: 1 } }),
  ],
};

const wreathHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: BLUSH,
  texture: 'watercolor',
  textureStrength: 0.55,
  layers: [
    shape('wash', 'ellipse', at(120, 60, 700, 760), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', via: 'transparent', to: 'transparent' } }, opacity: 0.9 }),
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'secondary', foil: true }),
    ...wreathPhoto(220, 150, 500),
    orn('rings', 'rings', at(996, 160, 88, 65), { color: 'secondary', animation: { entrance: 'pop', delaySec: 0.5 } }),
    text('eyebrow', t('template.engagementOf'), at(790, 250, 500, 24), { ...WREATH_EYEBROW, size: 14 }, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.45 } }),
    text('eyebrow-2', t('template.weddingOf'), at(790, 250, 500, 24), { ...WREATH_EYEBROW, size: 14 }, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.45 } }),
    text('names', TITLE, at(760, 278, 560, 160), { font: 'script', size: 88, color: 'primary', lineHeight: 1.04 }, { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(790, 448, 500, 30), { font: 'heading', size: 22, weight: 600, color: 'text', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('venue', VENUE_LINE, at(790, 482, 500, 36), { font: 'heading', size: 25, italic: true, color: 'text' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 1040, y: 578, panel: 'surface', metal: 'secondary', pill: ['primary', 'primary'], pillInk: 'surface', ink: 'primary', font: 'heading', size: 16, scale: 1.25, delay: 0.75 }),
    text('closing', t('template.footer.thanks'), at(790, 700, 500, 32), { font: 'heading', size: 21, italic: true, color: 'muted' }, { animation: { entrance: 'fade', delaySec: 1 } }),
  ],
};

const wreathCard = fnCard({
  height: 620,
  background: BLUSH,
  texture: 'watercolor',
  textureStrength: 0.5,
  decor: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 620), { color: 'secondary', foil: true }),
    orn('wreath', 'botanicalWreath', at(145, 38, 100, 100), { color: 'secondary', animation: { entrance: 'zoomIn' } }),
    orn('rings', 'rings', at(176, 72, 38, 28), { color: 'secondary' }),
  ],
  top: 140,
  eyebrowInk: 'muted',
  name: { font: 'script', size: 44, color: 'primary', lineHeight: 1.05 },
  description: { font: 'heading', size: 16, italic: true, color: 'muted', lineHeight: 1.2 },
  date: { font: 'heading', size: 15, weight: 600, color: 'text', letterSpacing: 0.1, transform: 'upper' },
  time: { font: 'heading', size: 18, italic: true, color: 'primary' },
  venue: { font: 'script', size: 28, color: 'primary', lineHeight: 1.08 },
  address: { font: 'body', size: 10, weight: 500, color: 'muted', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'primary', ink: 'surface', font: 'heading', size: 15, radius: 40 },
});

// ─────────────────────────── Genda Phool: a haldi morning ───────────────────────────

const TURMERIC = { type: 'gradient', gradient: { kind: 'radial', from: 'surface', to: 'background' } } as const;

/** The photo in a wreath of marigolds (the couple's monogram until there is one). */
function marigoldPhoto(x: number, y: number, size: number): LayerInput[] {
  const p = size * 0.43;
  const cx = x + size / 2;
  const cy = y + size / 2;
  return [
    shape('photo-bg', 'ellipse', at(cx - p / 2, cy - p / 2, p, p), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', via: 'surface', to: 'background' } }, animation: { entrance: 'zoomIn', delaySec: 0.2 } }),
    text('monogram', MONOGRAM, at(cx - p / 2, cy - p * 0.22, p, p * 0.44), { font: 'heading', size: p * 0.27, color: 'primary', lineHeight: 1 }, { animation: { entrance: 'zoomIn', delaySec: 0.35 } }),
    photo('photo', 'photo.cover', at(cx - p / 2, cy - p / 2, p, p), { mask: 'circle', animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
    orn('wreath', 'marigoldWreath', at(x, y, size, size), { color: '#fffaf0', shadow: 'soft', animation: { entrance: 'zoomIn', durationSec: 1.1 } }),
  ];
}

const gendaHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: TURMERIC,
  texture: 'paper',
  textureStrength: 0.55,
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'secondary' }),
    orn('leaves-l', 'bananaLeaf', at(-66, 652, 140, 242, 14), { color: '#3d7f3e', animation: { entrance: 'slideRight', delaySec: 0.4 } }),
    orn('leaves-r', 'bananaLeaf', at(316, 652, 140, 242, -14), { color: '#3d7f3e', flipX: true, animation: { entrance: 'slideLeft', delaySec: 0.4 } }),
    orn('swag', 'marigoldSwag', at(0, 0, 390, 150), { color: 'secondary', animation: { entrance: 'fadeDown', durationSec: 1, motion: 'sway' } }),
    text('eyebrow', t('template.haldi'), at(40, 158, 310, 18), { font: 'body', size: 11, weight: 700, color: 'accent', letterSpacing: 0.3, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 0.3 } }),
    text('names', TITLE, at(24, 178, 342, 84), { font: 'heading', size: 40, color: 'primary', lineHeight: 1.12 }, { animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    ...marigoldPhoto(75, 264, 240),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 510, 330, 22), { font: 'body', size: 12.5, weight: 600, color: 'text', letterSpacing: 0.14, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('time', b('event.startDate', { format: 'time' }), at(30, 532, 330, 26), { font: 'heading', size: 22, color: 'accent' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    text('venue', VENUE_LINE, at(40, 558, 310, 36), { font: 'body', size: 14, weight: 500, color: 'text', lineHeight: 1.3 }, { animation: { entrance: 'fadeUp', delaySec: 0.7 } }),
    ...rsvpBlock({ cx: 195, y: 604, panel: 'surface', metal: 'secondary', pill: ['accent', 'accent'], pillInk: 'surface', ink: 'primary', font: 'body', size: 13.5, scale: 0.94, delay: 0.8 }),
    text('closing', t('template.footer.thanks'), at(70, 684, 250, 44), { font: 'heading', size: 15.5, color: 'primary', lineHeight: 1.3 }, { animation: { entrance: 'fade', delaySec: 1 } }),
    orn('diyas', 'diyaRow', at(120, 742, 150, 41), { animation: { entrance: 'fadeUp', delaySec: 1.1 } }),
  ],
};

const gendaHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: TURMERIC,
  texture: 'paper',
  textureStrength: 0.55,
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'secondary' }),
    orn('leaves-l', 'bananaLeaf', at(-70, 560, 220, 380, 10), { color: '#3d7f3e', animation: { entrance: 'slideRight', delaySec: 0.4 } }),
    orn('leaves-r', 'bananaLeaf', at(1290, 560, 220, 380, -10), { color: '#3d7f3e', flipX: true, animation: { entrance: 'slideLeft', delaySec: 0.4 } }),
    orn('swag', 'marigoldSwag', at(0, 0, 1440, 190), { color: 'secondary', animation: { entrance: 'fadeDown', durationSec: 1, motion: 'sway' } }),
    ...marigoldPhoto(210, 230, 480),
    orn('diyas', 'diyaRow', at(360, 740, 180, 50), { animation: { entrance: 'fadeUp', delaySec: 1.1 } }),
    text('eyebrow', t('template.haldi'), at(760, 240, 560, 24), { font: 'body', size: 14, weight: 700, color: 'accent', letterSpacing: 0.3, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 0.3 } }),
    text('names', TITLE, at(740, 268, 600, 170), { font: 'heading', size: 72, color: 'primary', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(760, 448, 560, 28), { font: 'body', size: 17, weight: 600, color: 'text', letterSpacing: 0.14, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('time', b('event.startDate', { format: 'time' }), at(760, 478, 560, 34), { font: 'heading', size: 30, color: 'accent' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    text('venue', VENUE_LINE, at(760, 514, 560, 30), { font: 'body', size: 18, weight: 500, color: 'text' }, { animation: { entrance: 'fadeUp', delaySec: 0.7 } }),
    ...rsvpBlock({ cx: 1040, y: 600, panel: 'surface', metal: 'secondary', pill: ['accent', 'accent'], pillInk: 'surface', ink: 'primary', font: 'body', size: 13.5, scale: 1.25, delay: 0.8 }),
    text('closing', t('template.footer.thanks'), at(760, 724, 560, 36), { font: 'heading', size: 22, color: 'primary' }, { animation: { entrance: 'fade', delaySec: 1 } }),
  ],
};

const gendaCard = fnCard({
  height: 620,
  background: TURMERIC,
  texture: 'paper',
  textureStrength: 0.55,
  decor: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 620), { color: 'secondary' }),
    orn('swag', 'marigoldSwag', at(0, 0, 390, 104), { color: 'secondary', animation: { entrance: 'fadeDown', motion: 'sway' } }),
  ],
  top: 124,
  eyebrowInk: 'accent',
  name: { font: 'heading', size: 36, color: 'primary', lineHeight: 1.1 },
  divider: (y) => [orn('kalash', 'kalash', at(183, y - 8, 24, 31), {})],
  description: { font: 'body', size: 13, italic: false, color: 'muted', lineHeight: 1.3 },
  date: { font: 'body', size: 12.5, weight: 600, color: 'text', letterSpacing: 0.14, transform: 'upper' },
  time: { font: 'heading', size: 19, color: 'accent' },
  venue: { font: 'heading', size: 24, color: 'primary', lineHeight: 1.12 },
  address: { font: 'body', size: 10, weight: 500, color: 'muted', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'accent', ink: 'surface', font: 'body', size: 12.5, radius: 40 },
});

// ─────────────────────────── Midnight Deco: the reception ───────────────────────────

const MIDNIGHT = { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } } as const;
const DECO_EYEBROW: TextStyleInput = { font: 'body', size: 10.5, weight: 600, color: 'accent', letterSpacing: 0.42, transform: 'upper' };

/** A round porthole for the photo, ringed in gold; the monogram waits in it until there is a photo. */
function porthole(cx: number, cy: number, d: number, k = 1): LayerInput[] {
  const ring = (id: string, size: number, width: number) => shape(id, 'ellipse', at(cx - size / 2, cy - size / 2, size, size), { fill: { type: 'none' }, stroke: { width: width * k, color: 'secondary' }, animation: { entrance: 'zoomIn', delaySec: 0.25 } });
  return [
    ring('photo-ring-2', d + 26 * k, 0.6),
    ring('photo-ring-1', d + 12 * k, 1.2),
    shape('photo-bg', 'ellipse', at(cx - d / 2, cy - d / 2, d, d), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } }, animation: { entrance: 'zoomIn', delaySec: 0.2 } }),
    text('monogram', MONOGRAM, at(cx - d * 0.42, cy - d * 0.17, d * 0.84, d * 0.34), { font: 'heading', size: d * 0.24, color: 'secondary', foil: true, letterSpacing: 0.06, lineHeight: 1 }, { animation: { entrance: 'zoomIn', delaySec: 0.35 } }),
    photo('photo', 'photo.cover', at(cx - d / 2, cy - d / 2, d, d), { mask: 'circle', animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
  ];
}

const decoHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: MIDNIGHT,
  texture: 'grain',
  textureStrength: 0.35,
  layers: [
    orn('frame', 'decoFrame', at(0, 0, 390, 844), { color: 'secondary', foil: true, animation: { entrance: 'fade', durationSec: 1.2 } }),
    orn('sparkles', 'sparkles', at(40, 130, 84, 196), { color: 'secondary', opacity: 0.9, animation: { entrance: 'fade', delaySec: 0.6, motion: 'twinkle' } }),
    orn('sparkles-r', 'sparkles', at(266, 130, 84, 196), { color: 'secondary', opacity: 0.9, flipX: true, animation: { entrance: 'fade', delaySec: 0.7, motion: 'twinkle' } }),
    ...porthole(195, 236, 156),
    text('eyebrow', t('template.reception'), at(40, 344, 310, 18), DECO_EYEBROW, { animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('names', TITLE, at(44, 366, 302, 100), { font: 'heading', size: 40, color: 'secondary', foil: true, letterSpacing: 0.06, lineHeight: 1.14, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.5, motion: 'shimmer' } }),
    ...diamonds(195, 476, 'secondary', 8),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 494, 330, 20), { font: 'body', size: 11.5, weight: 600, color: 'accent', letterSpacing: 0.26, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('time', b('event.startDate', { format: 'time' }), at(30, 516, 330, 20), { font: 'body', size: 11.5, weight: 600, color: 'accent', letterSpacing: 0.26, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.62 } }),
    text('venue', VENUE_LINE, at(40, 540, 310, 44), { font: 'script', size: 22, color: 'secondary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 195, y: 606, panel: 'primary', metal: 'secondary', pill: ['accent', 'secondary'], pillInk: 'primary', ink: 'accent', font: 'body', size: 13, scale: 0.94, delay: 0.75 }),
    text('closing', t('template.footer.thanks'), at(56, 690, 278, 34), { font: 'heading', size: 16, color: 'secondary', letterSpacing: 0.06, lineHeight: 1.2 }, { animation: { entrance: 'fade', delaySec: 1 } }),
  ],
};

const decoHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: MIDNIGHT,
  texture: 'grain',
  textureStrength: 0.35,
  layers: [
    orn('frame', 'decoFrame', at(0, 0, 1440, 900), { color: 'secondary', foil: true, animation: { entrance: 'fade', durationSec: 1.2 } }),
    orn('sparkles', 'sparkles', at(120, 150, 560, 620), { color: 'secondary', opacity: 0.8, animation: { entrance: 'fade', delaySec: 0.6, motion: 'twinkle' } }),
    ...porthole(430, 470, 330, 1.6),
    text('eyebrow', t('template.reception'), at(760, 236, 560, 24), { ...DECO_EYEBROW, size: 14 }, { animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('names', TITLE, at(740, 266, 600, 150), { font: 'heading', size: 66, color: 'secondary', foil: true, letterSpacing: 0.06, lineHeight: 1.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.5, motion: 'shimmer' } }),
    ...diamonds(1040, 432, 'secondary', 11),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(760, 458, 560, 26), { font: 'body', size: 15, weight: 600, color: 'accent', letterSpacing: 0.26, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('time', b('event.startDate', { format: 'time' }), at(760, 486, 560, 26), { font: 'body', size: 15, weight: 600, color: 'accent', letterSpacing: 0.26, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.62 } }),
    text('venue', VENUE_LINE, at(760, 516, 560, 50), { font: 'script', size: 34, color: 'secondary', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 1040, y: 612, panel: 'primary', metal: 'secondary', pill: ['accent', 'secondary'], pillInk: 'primary', ink: 'accent', font: 'body', size: 13, scale: 1.25, delay: 0.75 }),
    text('closing', t('template.footer.thanks'), at(760, 732, 560, 32), { font: 'heading', size: 22, color: 'secondary', letterSpacing: 0.06 }, { animation: { entrance: 'fade', delaySec: 1 } }),
  ],
};

const decoCard = fnCard({
  height: 640,
  background: MIDNIGHT,
  texture: 'grain',
  textureStrength: 0.35,
  decor: [orn('frame', 'decoFrame', at(0, 0, 390, 640), { color: 'secondary', foil: true })],
  top: 128,
  eyebrowInk: 'accent',
  name: { font: 'heading', size: 34, color: 'secondary', foil: true, letterSpacing: 0.06, lineHeight: 1.1, transform: 'upper' },
  divider: (y) => diamonds(195, y + 6, 'secondary', 8),
  description: { font: 'script', size: 18, color: 'accent', lineHeight: 1.2 },
  date: { font: 'body', size: 11.5, weight: 600, color: 'accent', letterSpacing: 0.22, transform: 'upper' },
  time: { font: 'body', size: 13, weight: 600, color: 'secondary', letterSpacing: 0.22, transform: 'upper' },
  venue: { font: 'script', size: 25, color: 'secondary', lineHeight: 1.1 },
  address: { font: 'body', size: 10, weight: 500, color: 'accent', letterSpacing: 0.16, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'secondary', ink: 'primary', font: 'body', size: 12, radius: 2 },
});

// ─────────────────────────── Sangeet Sandhya: a night of music ───────────────────────────

const STAGE = { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } } as const;
const SANGEET_EYEBROW: TextStyleInput = { font: 'body', size: 11, weight: 600, color: 'secondary', letterSpacing: 0.36, transform: 'upper' };

/** Strands of ghungroo down both sides, longest at the edges. */
const ghungroos = (w: number, k = 1): LayerInput[] =>
  ([
    [26 * k, 236 * k],
    [58 * k, 168 * k],
    [w - 50 * k, 236 * k],
    [w - 82 * k, 168 * k],
  ] as const).map(([x, h], i) => orn(`ghungroo-${i + 1}`, 'ghungroo', at(x, 0, 24 * k, h), { color: 'secondary', animation: { entrance: 'fadeDown', delaySec: sec(0.1 + i * 0.08), motion: 'sway' } }));

const sangeetHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: STAGE,
  texture: 'grain',
  textureStrength: 0.3,
  layers: [
    shape('spotlight', 'ellipse', at(-40, 150, 470, 420), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', via: 'transparent', to: 'transparent' } }, opacity: 0.28 }),
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'secondary', foil: true }),
    orn('lights-1', 'fairyLights', at(0, -6, 390, 70), { animation: { entrance: 'fadeDown', motion: 'twinkle' } }),
    orn('lights-2', 'fairyLights', at(40, 34, 310, 64), { animation: { entrance: 'fadeDown', delaySec: 0.15, motion: 'twinkle' } }),
    ...ghungroos(390),
    orn('sparkles', 'sparkles', at(110, 112, 170, 88), { color: 'secondary', animation: { entrance: 'fade', delaySec: 0.5, motion: 'twinkle' } }),
    text('eyebrow', t('template.sangeet'), at(40, 214, 310, 18), SANGEET_EYEBROW, { animation: { entrance: 'fade', delaySec: 0.3 } }),
    text('names', TITLE, at(40, 236, 310, 96), { font: 'script', size: 50, color: 'secondary', foil: true, shadow: 'glow', lineHeight: 1.04 }, { animation: { entrance: 'fadeUp', delaySec: 0.4, motion: 'shimmer' } }),
    orn('dhol', 'dhol', at(117, 336, 156, 120), { color: 'secondary', shadow: 'glow', animation: { entrance: 'zoomIn', delaySec: 0.5, motion: 'float' } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 464, 330, 22), { font: 'body', size: 12.5, weight: 600, color: 'background', letterSpacing: 0.2, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('time', b('event.startDate', { format: 'time' }), at(30, 488, 330, 28), { font: 'heading', size: 20, weight: 600, color: 'secondary', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    text('venue', VENUE_LINE, at(40, 518, 310, 46), { font: 'script', size: 25, color: 'secondary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.7 } }),
    ...rsvpBlock({ cx: 195, y: 596, panel: 'primary', metal: 'secondary', pill: ['secondary', 'secondary'], pillInk: 'primary', ink: 'background', font: 'body', size: 13.5, scale: 0.94, delay: 0.8 }),
    text('closing', t('template.footer.thanks'), at(48, 682, 294, 44), { font: 'script', size: 23, color: 'secondary', lineHeight: 1.15 }, { animation: { entrance: 'fade', delaySec: 1 } }),
    orn('sparkles-foot', 'sparkles', at(60, 730, 270, 80), { color: 'secondary', opacity: 0.85, animation: { entrance: 'fade', delaySec: 1.1, motion: 'twinkle' } }),
  ],
};

const sangeetHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: STAGE,
  texture: 'grain',
  textureStrength: 0.3,
  layers: [
    shape('spotlight', 'ellipse', at(120, 120, 700, 700), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', via: 'transparent', to: 'transparent' } }, opacity: 0.28 }),
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'secondary', foil: true }),
    orn('lights-1', 'fairyLights', at(0, -8, 720, 90), { animation: { entrance: 'fadeDown', motion: 'twinkle' } }),
    orn('lights-2', 'fairyLights', at(720, -8, 720, 90), { animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'twinkle' } }),
    orn('lights-3', 'fairyLights', at(240, 44, 960, 96), { animation: { entrance: 'fadeDown', delaySec: 0.2, motion: 'twinkle' } }),
    ...ghungroos(1440, 1.5),
    orn('dhol', 'dhol', at(300, 330, 340, 263), { color: 'secondary', shadow: 'glow', animation: { entrance: 'zoomIn', delaySec: 0.5, motion: 'float' } }),
    orn('sparkles', 'sparkles', at(200, 200, 540, 520), { color: 'secondary', animation: { entrance: 'fade', delaySec: 0.5, motion: 'twinkle' } }),
    text('eyebrow', t('template.sangeet'), at(760, 220, 560, 24), { ...SANGEET_EYEBROW, size: 15 }, { animation: { entrance: 'fade', delaySec: 0.3 } }),
    text('names', TITLE, at(740, 250, 600, 160), { font: 'script', size: 88, color: 'secondary', foil: true, shadow: 'glow', lineHeight: 1.04 }, { animation: { entrance: 'fadeUp', delaySec: 0.4, motion: 'shimmer' } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(760, 424, 560, 28), { font: 'body', size: 16, weight: 600, color: 'background', letterSpacing: 0.2, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('time', b('event.startDate', { format: 'time' }), at(760, 454, 560, 34), { font: 'heading', size: 26, weight: 600, color: 'secondary', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    text('venue', VENUE_LINE, at(760, 492, 560, 52), { font: 'script', size: 36, color: 'secondary', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.7 } }),
    ...rsvpBlock({ cx: 1040, y: 590, panel: 'primary', metal: 'secondary', pill: ['secondary', 'secondary'], pillInk: 'primary', ink: 'background', font: 'body', size: 13.5, scale: 1.25, delay: 0.8 }),
    text('closing', t('template.footer.thanks'), at(760, 716, 560, 40), { font: 'script', size: 30, color: 'secondary' }, { animation: { entrance: 'fade', delaySec: 1 } }),
  ],
};

const sangeetCard = fnCard({
  height: 620,
  background: STAGE,
  texture: 'grain',
  textureStrength: 0.3,
  decor: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 620), { color: 'secondary', foil: true }),
    orn('lights', 'fairyLights', at(0, -6, 390, 64), { animation: { motion: 'twinkle' } }),
    orn('ghungroo-1', 'ghungroo', at(26, 0, 20, 170), { color: 'secondary', animation: { motion: 'sway' } }),
    orn('ghungroo-2', 'ghungroo', at(344, 0, 20, 170), { color: 'secondary', animation: { motion: 'sway' } }),
    orn('dhol', 'dhol', at(165, 66, 60, 46), { color: 'secondary', shadow: 'glow' }),
  ],
  top: 122,
  eyebrowInk: 'secondary',
  name: { font: 'script', size: 46, color: 'secondary', foil: true, shadow: 'glow', lineHeight: 1.05 },
  divider: (y) => diamonds(195, y + 6, 'secondary', 8),
  description: { font: 'script', size: 21, color: 'background', lineHeight: 1.2 },
  date: { font: 'body', size: 12.5, weight: 600, color: 'background', letterSpacing: 0.18, transform: 'upper' },
  time: { font: 'heading', size: 17, weight: 600, color: 'secondary', letterSpacing: 0.12, transform: 'upper' },
  venue: { font: 'script', size: 27, color: 'secondary', lineHeight: 1.08 },
  address: { font: 'body', size: 10, weight: 500, color: 'background', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'secondary', ink: 'primary', font: 'body', size: 12.5, radius: 40 },
});

// ─────────────────────────── The collection ───────────────────────────

const COUPLE_SLOTS: CanvasSpec['slots'] = ['tagline', 'story', 'partnerOneParents', 'partnerTwoParents', 'hashtag', 'closing'];
const COUPLE_PHOTOS: CanvasSpec['photoSlots'] = ['cover', 'partnerOne', 'partnerTwo', 'story', 'closing'];
const coupleMiddle = (couple: string, story: string, gallery: string): CanvasSpec['middle'] => [
  { id: 'couple', section: 'couple', variant: couple, props: { partnerOneParents: b('custom.partnerOneParents'), partnerTwoParents: b('custom.partnerTwoParents') } },
  { id: 'story', section: 'story', variant: story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
  { id: 'gallery', section: 'gallery', variant: gallery },
];

export const PREMIUM_SPECS: CanvasSpec[] = [
  {
    key: 'royal-maroon-gold',
    name: 'Royal Maroon & Gold',
    description:
      'Deep maroon stock printed in gold: a mandala crown, floral vines down both sides and a double hairline frame, your names in gold-foil script, your photo in a gilded frame, an RSVP to accept or decline and the first three celebrations on a gold timeline.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'stationery', 'hindu', 'north-indian', 'royal', 'mandala'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#5a0f28', '#d4af62', '#f2dca6', '#fbf5ec', '#fffdf8', '#2a0712', '#7a5a52'),
    presets: [
      { name: 'Maroon & Gold', colors: palette('#5a0f28', '#d4af62', '#f2dca6', '#fbf5ec', '#fffdf8', '#2a0712', '#7a5a52') },
      { name: 'Emerald & Gold', colors: palette('#0d3b2e', '#d4af62', '#f0dda8', '#f6f4ec', '#ffffff', '#04201a', '#5c6f66') },
      { name: 'Midnight & Gold', colors: palette('#16224a', '#d4af62', '#efddb0', '#f5f5f2', '#ffffff', '#080e24', '#5b6478') },
      { name: 'Plum & Rose Gold', colors: palette('#4a1238', '#d9a48f', '#f4d4c6', '#fbf4f3', '#ffffff', '#22071a', '#7a5c68') },
    ],
    fonts: 'royal',
    look: 'royal',
    effect: 'goldDust',
    intro: 'doors',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: maroonHeroMobile, desktop: maroonHeroDesktop },
    card: { mobile: maroonCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('arch', 'polaroid', 'mosaic'),
  },
  {
    key: 'kalyana-zari',
    name: 'Kalyana Zari',
    description:
      'A South Indian temple wedding woven like a Kanjeevaram: emerald silk with kolam buttas, a temple-tower zari border on rani pink, your photo in a flame-ringed prabhavali (a lit lamp waits there until you add one), brass kuthuvilakku lamps, names in gold capitals and the celebrations on a gold timeline.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'stationery', 'hindu', 'south-indian', 'tamil', 'telugu', 'kannada', 'temple', 'silk'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#0e4d3c', '#d4a53c', '#a3174f', '#fbf6ea', '#fffdf6', '#04241a', '#5f6f62'),
    presets: [
      { name: 'Emerald & Rani', colors: palette('#0e4d3c', '#d4a53c', '#a3174f', '#fbf6ea', '#fffdf6', '#04241a', '#5f6f62') },
      { name: 'Peacock & Purple', colors: palette('#0b3f5c', '#d4a53c', '#5a1a6b', '#f6f7f4', '#ffffff', '#04172a', '#5b6672') },
      { name: 'Maroon & Bottle Green', colors: palette('#6b0f1f', '#d4a53c', '#0f5132', '#fbf4ec', '#fffdf8', '#2a050c', '#76605a') },
      { name: 'Mayil Purple', colors: palette('#3f1650', '#d4a53c', '#0e6b4f', '#f8f4f8', '#ffffff', '#1a0624', '#6d5f73') },
    ],
    fonts: 'regal',
    look: 'heritage',
    effect: 'marigold',
    intro: 'gates',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: zariHeroMobile, desktop: zariHeroDesktop },
    card: { mobile: zariCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('stacked', 'polaroid', 'polaroid'),
  },
  {
    key: 'phulkari-anand-karaj',
    name: 'Phulkari',
    description:
      'An Anand Karaj card on madder-red khaddar: phulkari borders darned in golden and rani-pink silk, your photo in a silk-ringed diamond (your monogram waits there until you add one), names in gold, a script venue line and the celebrations marked with silk diamonds.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'stationery', 'sikh', 'punjabi', 'anand-karaj', 'phulkari'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#8a1c14', '#f2b705', '#d6246e', '#fff4dc', '#fffdf5', '#2c0603', '#7a5a4a'),
    presets: [
      { name: 'Madder & Gold', colors: palette('#8a1c14', '#f2b705', '#d6246e', '#fff4dc', '#fffdf5', '#2c0603', '#7a5a4a') },
      { name: 'Royal Blue Phulkari', colors: palette('#1b2a6b', '#f2b705', '#e0457b', '#f5f5fb', '#ffffff', '#0a1030', '#5d6380') },
      { name: 'Sarson Green', colors: palette('#3d4a12', '#f2b705', '#d6246e', '#f8f7ec', '#ffffff', '#141a05', '#5f6346') },
      { name: 'Midnight Phulkari', colors: palette('#24183d', '#f2b705', '#ff6f9c', '#f7f4fb', '#ffffff', '#0c0618', '#6a6283') },
    ],
    fonts: 'grand',
    look: 'heritage',
    effect: 'petals',
    intro: 'petals',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: phulHeroMobile, desktop: phulHeroDesktop },
    card: { mobile: phulCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('stacked', 'curtain', 'mosaic'),
  },
  {
    key: 'mehrab-nikah',
    name: 'Mehrab',
    description:
      'A nikah card on pearl stock framed by a Mughal mihrab in gold: a pointed, cusped arch on slender columns with a star lattice in its spandrels and a crescent finial, a lantern hanging at its heart, names in flowing script and the celebrations on a gold line.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'stationery', 'muslim', 'nikah', 'walima', 'mughal', 'arch'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#0b4a3a', '#b8862b', '#0e6b54', '#f6f1e4', '#fffdf7', '#0c211a', '#5b6b63'),
    presets: [
      { name: 'Emerald & Gold', colors: palette('#0b4a3a', '#b8862b', '#0e6b54', '#f6f1e4', '#fffdf7', '#0c211a', '#5b6b63') },
      { name: 'Midnight & Gold', colors: palette('#14213d', '#b8862b', '#2b4c8c', '#f5f5f2', '#ffffff', '#0a1022', '#5b6478') },
      { name: 'Rose & Gold', colors: palette('#8c3b4a', '#b8862b', '#b25b6c', '#fbf4f2', '#ffffff', '#3a1a20', '#806468') },
      { name: 'Teal & Silver', colors: palette('#0f5257', '#8a96a0', '#1f7a80', '#f3f6f6', '#ffffff', '#0a2526', '#5a6b6c') },
    ],
    fonts: 'elegant',
    look: 'royal',
    effect: 'goldDust',
    intro: 'curtain',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: mehrabHeroMobile, desktop: mehrabHeroDesktop },
    card: { mobile: mehrabCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('arch', 'polaroid', 'mosaic'),
  },
  {
    key: 'lal-paar-bengali',
    name: 'Lal Paar',
    description:
      'A Bengali wedding card like a bride\'s white saree with its red border: lal paar bands edged in alpana, a hand-painted alpana with your photo at its heart (its lotus shows until you add one), Shubho Bibaho in italic, names in red and the celebrations on a red line.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'STANDARD',
    badge: 'NEW',
    tags: ['canvas', 'stationery', 'bengali', 'hindu', 'alpana', 'east-indian'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#a3121f', '#c9a227', '#c9a227', '#fbf6ee', '#ffffff', '#2a0c0c', '#7a5a52'),
    presets: [
      { name: 'Sindoor Red', colors: palette('#a3121f', '#c9a227', '#c9a227', '#fbf6ee', '#ffffff', '#2a0c0c', '#7a5a52') },
      { name: 'Alta Crimson', colors: palette('#b0103f', '#c9a227', '#c9a227', '#fcf5f4', '#ffffff', '#2c0712', '#7d5a63') },
      { name: 'Banarasi Maroon', colors: palette('#6b0f1f', '#c9a227', '#c9a227', '#faf5ee', '#ffffff', '#24050b', '#76605a') },
      { name: 'Kantha Indigo', colors: palette('#22306b', '#c9a227', '#c9a227', '#f5f5f8', '#ffffff', '#0b1029', '#5d6380') },
    ],
    fonts: 'romantic',
    look: 'classic',
    effect: 'petals',
    intro: 'envelope',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: laalHeroMobile, desktop: laalHeroDesktop },
    card: { mobile: laalCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('profile', 'polaroid', 'polaroid'),
  },
  {
    key: 'champagne-wreath',
    name: 'Champagne Wreath',
    description:
      'A ring ceremony in blush and champagne: a gold olive wreath tied with a ribbon around your photo (your monogram until you add one), a pair of rings, names in flowing script and an RSVP to accept or decline, on soft watercolour stock.',
    category: 'Engagement',
    style: 'Canvas',
    tier: 'STANDARD',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'stationery', 'engagement', 'ring-ceremony', 'floral', 'modern'],
    eventTypes: ['ENGAGEMENT', 'WEDDING'],
    colors: palette('#7a3e48', '#b08a3e', '#f0d5cd', '#f8eeea', '#fffaf8', '#3a2328', '#8a6f72'),
    presets: [
      { name: 'Blush & Champagne', colors: palette('#7a3e48', '#b08a3e', '#f0d5cd', '#f8eeea', '#fffaf8', '#3a2328', '#8a6f72') },
      { name: 'Sage & Gold', colors: palette('#4f6b52', '#a8893f', '#dfe8d8', '#f4f6f0', '#ffffff', '#1f2b21', '#6b776c') },
      { name: 'Dusty Blue', colors: palette('#3f5b7a', '#a8893f', '#d6e2ee', '#f3f6f9', '#ffffff', '#1c2836', '#677585') },
      { name: 'Lilac', colors: palette('#6b4f8f', '#a8893f', '#e5dbf2', '#f7f4fb', '#ffffff', '#2a2138', '#76698a') },
    ],
    fonts: 'romantic',
    look: 'garden',
    effect: 'petals',
    intro: 'envelope',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: wreathHeroMobile, desktop: wreathHeroDesktop },
    card: { mobile: wreathCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('flip', 'polaroid', 'stack'),
  },
  {
    key: 'genda-phool-haldi',
    name: 'Genda Phool',
    description:
      'A haldi morning on turmeric stock: marigold garlands swagged across the top with strands and bells, a brass urli of haldi, banana leaves at the corners, names in a hand-painted display face and a row of diyas.',
    category: 'Haldi',
    style: 'Canvas',
    tier: 'STANDARD',
    badge: 'NEW',
    tags: ['canvas', 'stationery', 'haldi', 'hindu', 'marigold', 'festive'],
    eventTypes: ['WEDDING'],
    colors: palette('#8a3d00', '#e8a33d', '#2f6b2a', '#fde7a6', '#fff6d6', '#3b2200', '#7a5c2e'),
    presets: [
      { name: 'Turmeric', colors: palette('#8a3d00', '#e8a33d', '#2f6b2a', '#fde7a6', '#fff6d6', '#3b2200', '#7a5c2e') },
      { name: 'Marigold Orange', colors: palette('#9a3412', '#f59e0b', '#166534', '#ffe8c7', '#fff7ea', '#3a1608', '#7a5335') },
      { name: 'Mehendi Green', colors: palette('#3f5d12', '#e8a33d', '#8a3d00', '#eef2c7', '#fbfcef', '#1c2608', '#5e6640') },
      { name: 'Rani Haldi', colors: palette('#a3195b', '#f2a93b', '#2f6b2a', '#ffe6ee', '#fff6f9', '#3a0a20', '#7d5a68') },
    ],
    fonts: 'desi',
    look: 'celebration',
    effect: 'marigold',
    intro: 'petals',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: gendaHeroMobile, desktop: gendaHeroDesktop },
    card: { mobile: gendaCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('stacked', 'polaroid', 'polaroid'),
  },
  {
    key: 'midnight-deco-reception',
    name: 'Midnight Deco',
    description:
      'A reception in the manner of a 1920s ballroom: midnight stock in an art deco gold frame with a sunburst at its head, your photo in a gold porthole (your monogram until you add one), names in tall foil capitals and gold sparkles.',
    category: 'Reception',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'stationery', 'reception', 'art-deco', 'modern', 'night'],
    eventTypes: ['WEDDING'],
    colors: palette('#0e1a2b', '#d4b26a', '#ecdcb0', '#f6f4ef', '#ffffff', '#05090f', '#5b6474'),
    presets: [
      { name: 'Midnight & Gold', colors: palette('#0e1a2b', '#d4b26a', '#ecdcb0', '#f6f4ef', '#ffffff', '#05090f', '#5b6474') },
      { name: 'Onyx & Champagne', colors: palette('#1a1a1a', '#d9c08a', '#efe3c2', '#f5f4f1', '#ffffff', '#050505', '#5f5f5f') },
      { name: 'Emerald Deco', colors: palette('#0b3b30', '#d4b26a', '#e6dab0', '#f2f5f2', '#ffffff', '#03140f', '#586a63') },
      { name: 'Burgundy Deco', colors: palette('#4a0d1f', '#d4b26a', '#efdcb4', '#f8f3f1', '#ffffff', '#1c040b', '#6e5a60') },
    ],
    fonts: 'editorial',
    look: 'noir',
    effect: 'goldDust',
    intro: 'curtain',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: decoHeroMobile, desktop: decoHeroDesktop },
    card: { mobile: decoCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('profile', 'curtain', 'mosaic'),
  },
  {
    key: 'sangeet-sandhya',
    name: 'Sangeet Sandhya',
    description:
      'A night of music on plum stock: strings of fairy lights and ghungroo bells, a gold dhol in a soft spotlight, your names in glowing gold script, the time and the venue, and an RSVP to accept or decline.',
    category: 'Sangeet',
    style: 'Canvas',
    tier: 'STANDARD',
    badge: 'NEW',
    tags: ['canvas', 'stationery', 'sangeet', 'hindu', 'music', 'night'],
    eventTypes: ['WEDDING'],
    colors: palette('#2b0f3f', '#e2b04a', '#c2185b', '#f8f3fb', '#ffffff', '#12041c', '#6f5f7d'),
    presets: [
      { name: 'Plum Night', colors: palette('#2b0f3f', '#e2b04a', '#c2185b', '#f8f3fb', '#ffffff', '#12041c', '#6f5f7d') },
      { name: 'Peacock Night', colors: palette('#0b3d4f', '#e2b04a', '#16a3a0', '#f2f8f9', '#ffffff', '#031820', '#5a6f75') },
      { name: 'Rani Night', colors: palette('#5c0f36', '#f0c45a', '#ff7a3d', '#fbf3f6', '#ffffff', '#24040f', '#7b5a68') },
      { name: 'Midnight Indigo', colors: palette('#1b1f4b', '#e8b54f', '#e05297', '#f5f5fb', '#ffffff', '#090b24', '#5d6380') },
    ],
    fonts: 'regal',
    look: 'royal',
    effect: 'confetti',
    intro: 'curtain',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: sangeetHeroMobile, desktop: sangeetHeroDesktop },
    card: { mobile: sangeetCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('flip', 'curtain', 'mosaic'),
  },
];

export type { Frame };
