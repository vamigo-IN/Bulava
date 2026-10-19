import type { ArtboardInput, LayerInput } from '@bulava/template-schema';
import { palette, TITLE } from './builder';
import { at, b, eyebrows, orn, sec, shape, t, text, widget, type CanvasSpec, type TextStyleInput } from './canvas-kit';
import { COUPLE_PHOTOS, COUPLE_SLOTS, coupleMiddle, fnCard, MONOGRAM, rsvpBlock, VENUE_LINE } from './premium-cards';

/**
 * The atelier collection (ADR-074): invitations made like tactile stationery,
 * after the digital invitations that open like a gift. Each one opens the way
 * its stationery would: a zipper pulled open by its scalloped tag, a satin bow
 * untied, a wax seal broken. Linen, leather, satin and velvet are the boards'
 * colours under a printed texture; the zipper, tag, ribbon and seal are the
 * engine's own drawings, so every colour preset restyles them too.
 */

const EYEBROW: TextStyleInput = { font: 'body', size: 10.5, weight: 600, color: 'muted', letterSpacing: 0.34, transform: 'upper' };

/** The occasion's line above the names. */
const weddingEyebrows = (frame: ReturnType<typeof at>, style: TextStyleInput) =>
  eyebrows(
    'eyebrow',
    frame,
    [
      [['WEDDING'], t('template.weddingOf')],
      [['ENGAGEMENT'], t('template.engagementOf')],
    ],
    style,
  );

/** A scalloped tag hanging from a zipper's slider, with the couple's monogram: the pull of every zipped design. */
function zipTag(x: number, y: number, w: number, rotate: number, monogramSize: number, delay = 0.45): LayerInput[] {
  const h = (w * 260) / 200;
  const pullW = w * 0.3;
  const pullH = (pullW * 140) / 60;
  // The slider's ring sits on the tag's eyelet (the tag's cord passes through it).
  const pullX = x + w / 2 - pullW / 2;
  const pullY = y + h * 0.1 - pullH * 0.9;
  return [
    orn('pull', 'zipperPull', at(pullX, pullY, pullW, pullH, rotate), { color: 'secondary', foil: true, animation: { entrance: 'fadeDown', delaySec: sec(delay - 0.1) } }),
    orn('tag', 'scallopTag', at(x, y, w, h, rotate), { color: 'accent', shadow: 'soft', animation: { entrance: 'fadeDown', delaySec: delay, motion: 'sway' } }),
    text('tag-monogram', MONOGRAM, at(x + w * 0.16, y + h * 0.4, w * 0.68, h * 0.3, rotate), { font: 'script', size: monogramSize, color: 'text', lineHeight: 1, contrast: false }, { overflow: 'shrink', animation: { entrance: 'fade', delaySec: sec(delay + 0.15), motion: 'sway' } }),
  ];
}

// ─────────────────────────── Olive Zip: linen, a zipper and a blush tag ───────────────────────────

const OLIVE_NAMES: TextStyleInput = { font: 'script', size: 54, color: 'primary', lineHeight: 1 };
const OLIVE_DATE: TextStyleInput = { font: 'heading', size: 17.5, weight: 600, color: 'text', letterSpacing: 0.1, transform: 'upper' };
const OLIVE_VENUE: TextStyleInput = { font: 'heading', size: 20, italic: true, color: 'text', lineHeight: 1.15 };

const oliveHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'color', color: 'primary' },
  texture: 'linen',
  textureStrength: 0.95,
  layers: [
    shape('daylight', 'ellipse', at(-150, -170, 560, 560), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', via: 'transparent', to: 'transparent' } }, opacity: 0.18 }),
    // A zipper closed along the foot of the linen, as on the pouch the card came out of.
    orn('hem-zip', 'zipper', at(183, 611, 24, 390, 90), { color: 'secondary', animation: { entrance: 'fade', delaySec: 0.2 } }),
    shape('card', 'rect', at(28, 96, 334, 656), { fill: { type: 'color', color: 'background' }, radius: 3, shadow: true, animation: { entrance: 'fadeUp' } }),
    orn('frame', 'hairlineFrame', at(40, 108, 310, 632), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.15 } }),
    ...zipTag(250, 72, 98, 7, 23),
    ...weddingEyebrows(at(56, 214, 278, 18), EYEBROW),
    text('names', TITLE, at(44, 238, 302, 136), OLIVE_NAMES, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.25 } }),
    orn('divider', 'flourish', at(125, 380, 140, 28), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.35 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(40, 420, 310, 26), OLIVE_DATE, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('venue', VENUE_LINE, at(52, 450, 286, 50), OLIVE_VENUE, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    ...rsvpBlock({ cx: 195, y: 532, panel: 'background', metal: 'secondary', pill: ['primary', 'primary'], pillInk: 'background', ink: 'primary', font: 'heading', size: 16, scale: 0.92, delay: 0.6 }),
    widget('countdown', { type: 'countdown', variant: 'inline', size: 18, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(46, 626, 298, 44), { animation: { entrance: 'fadeUp', delaySec: 0.8 } }),
    text('closing', t('template.footer.thanks'), at(60, 690, 270, 24), { font: 'heading', size: 15.5, italic: true, color: 'muted' }, { animation: { entrance: 'fade', delaySec: 0.9 } }),
  ],
};

const oliveHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'color', color: 'primary' },
  texture: 'linen',
  textureStrength: 0.95,
  layers: [
    shape('daylight', 'ellipse', at(-200, -300, 1100, 1000), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', via: 'transparent', to: 'transparent' } }, opacity: 0.16 }),
    // The reel's still: a zipper down the linen, its tag hanging from the slider.
    orn('zip', 'zipper', at(344, -20, 32, 330), { color: 'secondary', animation: { entrance: 'fade' } }),
    ...zipTag(250, 318, 220, -3, 52, 0.3),
    shape('card', 'rect', at(640, 64, 640, 772), { fill: { type: 'color', color: 'background' }, radius: 4, shadow: true, animation: { entrance: 'fadeUp' } }),
    orn('frame', 'hairlineFrame', at(658, 82, 604, 736), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.15 } }),
    ...weddingEyebrows(at(700, 150, 520, 22), { ...EYEBROW, size: 13 }),
    text('names', TITLE, at(690, 182, 540, 190), { ...OLIVE_NAMES, size: 84 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.25 } }),
    orn('divider', 'flourish', at(855, 382, 210, 42), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.35 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(700, 440, 520, 32), { ...OLIVE_DATE, size: 22 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('venue', VENUE_LINE, at(720, 478, 480, 40), { ...OLIVE_VENUE, size: 25 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    ...rsvpBlock({ cx: 960, y: 566, panel: 'background', metal: 'secondary', pill: ['primary', 'primary'], pillInk: 'background', ink: 'primary', font: 'heading', size: 16, scale: 1.2, delay: 0.6 }),
    widget('countdown', { type: 'countdown', variant: 'inline', size: 22, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(720, 690, 480, 56), { animation: { entrance: 'fadeUp', delaySec: 0.8 } }),
    text('closing', t('template.footer.thanks'), at(720, 760, 480, 30), { font: 'heading', size: 19, italic: true, color: 'muted' }, { animation: { entrance: 'fade', delaySec: 0.9 } }),
  ],
};

const oliveCard = fnCard({
  height: 560,
  background: { type: 'color', color: 'primary' },
  texture: 'linen',
  textureStrength: 0.9,
  decor: [
    shape('card', 'rect', at(18, 18, 354, 524), { fill: { type: 'color', color: 'background' }, radius: 3, shadow: true }),
    orn('frame', 'hairlineFrame', at(28, 28, 334, 504), { color: 'secondary', foil: true }),
    orn('tag', 'scallopTag', at(167, 22, 56, 73), { color: 'accent', shadow: 'soft', animation: { entrance: 'fadeDown', motion: 'sway' } }),
    text('tag-monogram', MONOGRAM, at(175, 50, 40, 22), { font: 'script', size: 14, color: 'text', lineHeight: 1, contrast: false }, { overflow: 'shrink', animation: { entrance: 'fade', motion: 'sway' } }),
  ],
  top: 112,
  eyebrowInk: 'muted',
  name: { font: 'script', size: 44, color: 'primary', lineHeight: 1.05 },
  description: { font: 'heading', size: 16, italic: true, color: 'muted', lineHeight: 1.2 },
  date: { font: 'heading', size: 15, weight: 600, color: 'text', letterSpacing: 0.1, transform: 'upper' },
  time: { font: 'heading', size: 18, italic: true, color: 'primary' },
  venue: { font: 'script', size: 28, color: 'primary', lineHeight: 1.08 },
  address: { font: 'body', size: 10, weight: 500, color: 'muted', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'primary', ink: 'background', font: 'heading', size: 14, radius: 40 },
});

// ─────────────────────────── Noir Zip: a leather clutch, gold hardware ───────────────────────────

const NOIR_EYEBROW: TextStyleInput = { font: 'body', size: 10.5, weight: 600, color: 'muted', letterSpacing: 0.4, transform: 'upper' };
const NOIR_NAMES: TextStyleInput = { font: 'heading', size: 46, color: 'text', letterSpacing: 0.04, transform: 'upper', lineHeight: 1.04 };
const LEATHER = { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } } as const;

/** The clutch: leather with a gold zipper along its top and the tag at its end. */
function clutch(x: number, y: number, w: number, h: number, k: number): LayerInput[] {
  return [
    shape('clutch', 'rect', at(x, y, w, h), { fill: { type: 'gradient', gradient: { from: 'primary', to: 'text', angle: 180 } }, radius: 18 * k, shadow: true, animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    shape('clutch-stitch', 'rect', at(x + 10 * k, y + 10 * k, w - 20 * k, h - 20 * k), { fill: { type: 'color', color: 'transparent' }, stroke: { width: 1 * k, color: 'secondary' }, radius: 12 * k, opacity: 0.45, animation: { entrance: 'fade', delaySec: 0.2 } }),
    orn('clutch-zip', 'zipper', at(x + w / 2 - 12 * k, y - w / 2 + 34 * k, 24 * k, w - 40 * k, 90), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.2 } }),
  ];
}

const noirHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: LEATHER,
  texture: 'grain',
  textureStrength: 0.7,
  effect: 'goldDust',
  layers: [
    // The card, half out of the clutch.
    shape('card', 'rect', at(42, 66, 306, 560), { fill: { type: 'color', color: 'background' }, radius: 4, shadow: true, animation: { entrance: 'fadeDown' } }),
    orn('frame', 'decoFrame', at(54, 78, 282, 536), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.15 } }),
    text('eyebrow', t('template.joinUs'), at(80, 160, 230, 18), NOIR_EYEBROW, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('eyebrow-2', t('template.engagementOf'), at(80, 160, 230, 18), NOIR_EYEBROW, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('names', TITLE, at(74, 184, 242, 160), { ...NOIR_NAMES, size: 42 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    shape('rule', 'rect', at(165, 352, 60, 1.2), { fill: { type: 'color', color: 'secondary' }, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(84, 364, 222, 22), { font: 'body', size: 11.5, weight: 600, color: 'text', letterSpacing: 0.16, transform: 'upper' }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    text('venue', VENUE_LINE, at(80, 390, 230, 46), { font: 'script', size: 20, italic: true, color: 'muted', lineHeight: 1.15 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    ...clutch(14, 470, 362, 340, 1),
    ...zipTag(296, 470, 74, -6, 17, 0.55),
    ...rsvpBlock({ cx: 195, y: 566, panel: 'primary', metal: 'secondary', pill: ['secondary', 'accent'], pillInk: 'primary', ink: 'accent', font: 'body', size: 13, scale: 0.92, delay: 0.7 }),
    widget('countdown', { type: 'countdown', variant: 'inline', size: 18, color: 'secondary', labelColor: 'accent', boxColor: 'primary', font: 'heading' }, at(50, 670, 290, 44), { animation: { entrance: 'fadeUp', delaySec: 0.85 } }),
    text('closing', t('template.footer.thanks'), at(40, 730, 310, 26), { font: 'script', size: 17, italic: true, color: 'accent' }, { overflow: 'shrink', animation: { entrance: 'fade', delaySec: 0.95 } }),
  ],
};

const noirHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: LEATHER,
  texture: 'grain',
  textureStrength: 0.7,
  effect: 'goldDust',
  layers: [
    shape('card', 'rect', at(500, 40, 440, 600), { fill: { type: 'color', color: 'background' }, radius: 5, shadow: true, animation: { entrance: 'fadeDown' } }),
    orn('frame', 'decoFrame', at(516, 56, 408, 568), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.15 } }),
    text('eyebrow', t('template.joinUs'), at(560, 148, 320, 22), { ...NOIR_EYEBROW, size: 12.5 }, { visibleWhen: { eventTypes: ['WEDDING'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('eyebrow-2', t('template.engagementOf'), at(560, 148, 320, 22), { ...NOIR_EYEBROW, size: 12.5 }, { visibleWhen: { eventTypes: ['ENGAGEMENT'] }, animation: { entrance: 'fade', delaySec: 0.2 } }),
    text('names', TITLE, at(550, 176, 340, 180), { ...NOIR_NAMES, size: 54 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    shape('rule', 'rect', at(680, 368, 80, 1.5), { fill: { type: 'color', color: 'secondary' }, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(570, 382, 300, 26), { font: 'body', size: 13.5, weight: 600, color: 'text', letterSpacing: 0.18, transform: 'upper' }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    text('venue', VENUE_LINE, at(570, 414, 300, 50), { font: 'script', size: 24, italic: true, color: 'muted', lineHeight: 1.15 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    ...clutch(300, 520, 840, 360, 1.6),
    ...zipTag(1050, 520, 110, -6, 26, 0.55),
    ...rsvpBlock({ cx: 560, y: 640, panel: 'primary', metal: 'secondary', pill: ['secondary', 'accent'], pillInk: 'primary', ink: 'accent', font: 'body', size: 13, scale: 1.15, delay: 0.7 }),
    widget('countdown', { type: 'countdown', variant: 'inline', size: 22, color: 'secondary', labelColor: 'accent', boxColor: 'primary', font: 'heading' }, at(720, 650, 380, 56), { animation: { entrance: 'fadeUp', delaySec: 0.85 } }),
    text('closing', t('template.footer.thanks'), at(720, 720, 380, 30), { font: 'script', size: 21, italic: true, color: 'accent' }, { animation: { entrance: 'fade', delaySec: 0.95 } }),
  ],
};

const noirCard = fnCard({
  height: 560,
  background: LEATHER,
  texture: 'grain',
  textureStrength: 0.7,
  decor: [orn('frame', 'decoFrame', at(14, 14, 362, 532), { color: 'secondary', foil: true })],
  top: 150,
  eyebrowInk: 'accent',
  name: { font: 'heading', size: 34, color: 'secondary', foil: true, letterSpacing: 0.06, transform: 'upper', lineHeight: 1.08 },
  description: { font: 'script', size: 20, italic: true, color: 'accent', lineHeight: 1.2 },
  date: { font: 'body', size: 12.5, weight: 600, color: 'background', letterSpacing: 0.2, transform: 'upper' },
  time: { font: 'heading', size: 18, color: 'secondary', letterSpacing: 0.1 },
  venue: { font: 'script', size: 26, italic: true, color: 'background', lineHeight: 1.1 },
  address: { font: 'body', size: 10, weight: 500, color: 'accent', letterSpacing: 0.16, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'secondary', ink: 'primary', font: 'body', size: 12.5, radius: 4 },
});

// ─────────────────────────── Satin Bow: an ivory card tied with satin ───────────────────────────

const BOW_NAMES: TextStyleInput = { font: 'script', size: 56, color: 'primary', lineHeight: 1.02 };
const BOW_CAPS: TextStyleInput = { font: 'heading', size: 15, color: 'text', letterSpacing: 0.18, transform: 'upper' };
const IVORY = { type: 'gradient', gradient: { kind: 'radial', from: 'surface', to: 'background' } } as const;

const bowHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: IVORY,
  texture: 'paper',
  textureStrength: 0.85,
  effect: 'petals',
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'secondary', foil: true }),
    shape('oval', 'ellipse', at(127, 70, 136, 170), { fill: { type: 'color', color: 'transparent' }, stroke: { width: 1.2, color: 'secondary' }, animation: { entrance: 'zoomIn' } }),
    shape('oval-inner', 'ellipse', at(135, 78, 120, 154), { fill: { type: 'color', color: 'transparent' }, stroke: { width: 0.6, color: 'secondary' }, animation: { entrance: 'zoomIn', delaySec: 0.05 } }),
    text('monogram', MONOGRAM, at(135, 122, 120, 66), { font: 'heading', size: 30, color: 'primary', letterSpacing: 0.08, lineHeight: 1 }, { overflow: 'shrink', animation: { entrance: 'fade', delaySec: 0.2 } }),
    ...weddingEyebrows(at(50, 262, 290, 18), EYEBROW),
    // The satin across the card, tied in a bow.
    orn('ribbon', 'satinRibbon', at(0, 312, 390, 44), { color: 'accent', animation: { entrance: 'slideRight', delaySec: 0.3 } }),
    orn('bow', 'satinBow', at(105, 270, 180, 126), { color: 'accent', shadow: 'soft', animation: { entrance: 'pop', delaySec: 0.45, motion: 'sway' } }),
    text('names', TITLE, at(36, 408, 318, 140), BOW_NAMES, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.55 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(40, 556, 310, 24), BOW_CAPS, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('venue', VENUE_LINE, at(50, 584, 290, 44), { font: 'body', size: 13, color: 'muted', letterSpacing: 0.06, lineHeight: 1.4 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 195, y: 652, panel: 'surface', metal: 'secondary', pill: ['accent', 'primary'], pillInk: 'background', ink: 'primary', font: 'heading', size: 15, scale: 0.9, delay: 0.75 }),
    text('closing', t('template.footer.thanks'), at(50, 760, 290, 26), { font: 'script', size: 22, color: 'muted' }, { animation: { entrance: 'fade', delaySec: 0.95 } }),
  ],
};

const bowHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: IVORY,
  texture: 'paper',
  textureStrength: 0.85,
  effect: 'petals',
  layers: [
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'secondary', foil: true }),
    // The satin down the card's left third, the bow where it is tied.
    orn('ribbon', 'satinRibbon', at(420, 0, 64, 900), { color: 'accent', animation: { entrance: 'fadeDown', delaySec: 0.2 } }),
    orn('bow', 'satinBow', at(302, 330, 300, 210), { color: 'accent', shadow: 'soft', animation: { entrance: 'pop', delaySec: 0.4, motion: 'sway' } }),
    shape('oval', 'ellipse', at(160, 110, 150, 188), { fill: { type: 'color', color: 'transparent' }, stroke: { width: 1.4, color: 'secondary' }, animation: { entrance: 'zoomIn' } }),
    text('monogram', MONOGRAM, at(165, 168, 140, 72), { font: 'heading', size: 34, color: 'primary', letterSpacing: 0.08, lineHeight: 1 }, { overflow: 'shrink', animation: { entrance: 'fade', delaySec: 0.2 } }),
    ...weddingEyebrows(at(640, 220, 640, 22), { ...EYEBROW, size: 13 }),
    text('names', TITLE, at(620, 250, 680, 200), { ...BOW_NAMES, size: 96 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(640, 470, 640, 30), { ...BOW_CAPS, size: 19 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('venue', VENUE_LINE, at(660, 506, 600, 36), { font: 'body', size: 16, color: 'muted', letterSpacing: 0.06 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    ...rsvpBlock({ cx: 960, y: 588, panel: 'surface', metal: 'secondary', pill: ['accent', 'primary'], pillInk: 'background', ink: 'primary', font: 'heading', size: 15, scale: 1.2, delay: 0.75 }),
    text('closing', t('template.footer.thanks'), at(700, 730, 520, 34), { font: 'script', size: 28, color: 'muted' }, { animation: { entrance: 'fade', delaySec: 0.95 } }),
  ],
};

const bowCard = fnCard({
  height: 520,
  background: IVORY,
  texture: 'paper',
  textureStrength: 0.8,
  decor: [
    orn('frame', 'hairlineFrame', at(0, 0, 390, 520), { color: 'secondary', foil: true }),
    orn('ribbon', 'satinRibbon', at(0, 54, 390, 26), { color: 'accent' }),
    orn('bow', 'satinBow', at(145, 32, 100, 70), { color: 'accent', shadow: 'soft', animation: { entrance: 'pop', motion: 'sway' } }),
  ],
  top: 112,
  eyebrowInk: 'muted',
  name: { font: 'script', size: 44, color: 'primary', lineHeight: 1.05 },
  description: { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 },
  date: { font: 'heading', size: 14, color: 'text', letterSpacing: 0.16, transform: 'upper' },
  time: { font: 'heading', size: 16, color: 'primary', letterSpacing: 0.08 },
  venue: { font: 'script', size: 28, color: 'primary', lineHeight: 1.08 },
  address: { font: 'body', size: 10, weight: 500, color: 'muted', letterSpacing: 0.14, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'primary', ink: 'background', font: 'heading', size: 13.5, radius: 40 },
});

// ─────────────────────────── Velvet Seal: emerald velvet, a gold wax seal ───────────────────────────

const VELVET = { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } } as const;
const VELVET_EYEBROW: TextStyleInput = { font: 'heading', size: 11, weight: 600, color: 'accent', letterSpacing: 0.36, transform: 'upper' };

/** A gold wax seal with the couple's monogram pressed into it. */
function seal(x: number, y: number, size: number, delay = 0.2): LayerInput[] {
  return [
    orn('seal', 'waxSeal', at(x, y, size, size), { color: 'secondary', shadow: 'soft', animation: { entrance: 'pop', delaySec: delay } }),
    text('seal-monogram', MONOGRAM, at(x + size * 0.15, y + size * 0.36, size * 0.7, size * 0.28), { font: 'heading', size: size * 0.16, weight: 600, color: 'text', letterSpacing: 0.02, lineHeight: 1, contrast: false }, { overflow: 'shrink', animation: { entrance: 'fade', delaySec: sec(delay + 0.15) } }),
  ];
}

const velvetHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: VELVET,
  texture: 'grain',
  textureStrength: 0.55,
  effect: 'goldDust',
  layers: [
    shape('sheen', 'ellipse', at(-80, 120, 550, 520), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', via: 'transparent', to: 'transparent' } }, opacity: 0.08 }),
    orn('frame', 'hairlineFrame', at(0, 0, 390, 844), { color: 'secondary', foil: true }),
    orn('vine-l', 'goldVine', at(18, 150, 28, 520), { color: 'secondary', foil: true, opacity: 0.85, animation: { entrance: 'fade', delaySec: 0.3 } }),
    orn('vine-r', 'goldVine', at(344, 150, 28, 520), { color: 'secondary', foil: true, flipX: true, opacity: 0.85, animation: { entrance: 'fade', delaySec: 0.3 } }),
    ...seal(125, 70, 140),
    ...weddingEyebrows(at(50, 236, 290, 18), VELVET_EYEBROW),
    text('names', TITLE, at(40, 262, 310, 150), { font: 'script', size: 56, color: 'secondary', foil: true, lineHeight: 1.05 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.35 } }),
    shape('rule', 'rect', at(160, 424, 70, 1.2), { fill: { type: 'color', color: 'secondary' }, animation: { entrance: 'fade', delaySec: 0.45 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(40, 440, 310, 24), { font: 'heading', size: 15, weight: 600, color: 'background', letterSpacing: 0.16, transform: 'upper' }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    text('venue', VENUE_LINE, at(50, 468, 290, 46), { font: 'script', size: 24, color: 'accent', lineHeight: 1.12 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.55 } }),
    ...rsvpBlock({ cx: 195, y: 552, panel: 'primary', metal: 'secondary', pill: ['secondary', 'accent'], pillInk: 'primary', ink: 'background', font: 'body', size: 12.5, scale: 0.92, delay: 0.7 }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 22, color: 'secondary', labelColor: 'accent', boxColor: 'primary', font: 'heading' }, at(50, 652, 290, 76), { animation: { entrance: 'fadeUp', delaySec: 0.85 } }),
    text('closing', t('template.footer.thanks'), at(50, 752, 290, 26), { font: 'script', size: 21, color: 'accent' }, { animation: { entrance: 'fade', delaySec: 0.95 } }),
  ],
};

const velvetHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: VELVET,
  texture: 'grain',
  textureStrength: 0.55,
  effect: 'goldDust',
  layers: [
    shape('sheen', 'ellipse', at(80, 40, 900, 820), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', via: 'transparent', to: 'transparent' } }, opacity: 0.08 }),
    orn('frame', 'hairlineFrame', at(0, 0, 1440, 900), { color: 'secondary', foil: true }),
    ...seal(230, 270, 360),
    orn('vine', 'goldVine', at(660, 160, 34, 580), { color: 'secondary', foil: true, opacity: 0.8, animation: { entrance: 'fade', delaySec: 0.3 } }),
    ...weddingEyebrows(at(760, 210, 560, 22), { ...VELVET_EYEBROW, size: 13 }),
    text('names', TITLE, at(740, 240, 600, 200), { font: 'script', size: 92, color: 'secondary', foil: true, lineHeight: 1.04 }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.35 } }),
    shape('rule', 'rect', at(1000, 452, 80, 1.5), { fill: { type: 'color', color: 'secondary' }, animation: { entrance: 'fade', delaySec: 0.45 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(760, 470, 560, 30), { font: 'heading', size: 19, weight: 600, color: 'background', letterSpacing: 0.16, transform: 'upper' }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    text('venue', VENUE_LINE, at(780, 506, 520, 44), { font: 'script', size: 30, color: 'accent' }, { overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.55 } }),
    ...rsvpBlock({ cx: 1040, y: 590, panel: 'primary', metal: 'secondary', pill: ['secondary', 'accent'], pillInk: 'primary', ink: 'background', font: 'body', size: 12.5, scale: 1.2, delay: 0.7 }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 28, color: 'secondary', labelColor: 'accent', boxColor: 'primary', font: 'heading' }, at(830, 716, 420, 100), { animation: { entrance: 'fadeUp', delaySec: 0.85 } }),
  ],
};

const velvetCard = fnCard({
  height: 560,
  background: VELVET,
  texture: 'grain',
  textureStrength: 0.55,
  decor: [orn('frame', 'hairlineFrame', at(0, 0, 390, 560), { color: 'secondary', foil: true }), ...seal(160, 26, 70, 0.05)],
  top: 112,
  eyebrowInk: 'accent',
  name: { font: 'script', size: 44, color: 'secondary', foil: true, lineHeight: 1.05 },
  description: { font: 'heading', size: 14, color: 'accent', letterSpacing: 0.08, lineHeight: 1.3 },
  date: { font: 'heading', size: 14, weight: 600, color: 'background', letterSpacing: 0.16, transform: 'upper' },
  time: { font: 'heading', size: 17, color: 'secondary', letterSpacing: 0.08 },
  venue: { font: 'script', size: 27, color: 'accent', lineHeight: 1.1 },
  address: { font: 'body', size: 10, weight: 500, color: 'background', letterSpacing: 0.16, transform: 'upper', lineHeight: 1.4 },
  buttons: { fill: 'secondary', ink: 'primary', font: 'body', size: 12, radius: 4 },
});

// ─────────────────────────── The collection ───────────────────────────

export const ATELIER_SPECS: CanvasSpec[] = [
  {
    key: 'olive-zip-invite',
    name: 'Olive Zip',
    description:
      'An invitation that opens like a gift: guests pull a blush scalloped tag to unzip olive linen and find your ivory card inside, your names in flowing script, the date and venue, an RSVP to accept or decline and a countdown.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'stationery', 'modern', 'tactile', 'zipper', 'linen', 'minimal'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#5d6545', '#c8c1ac', '#efc8c0', '#f4efe4', '#fbf8f1', '#2d2a21', '#706c5d'),
    presets: [
      { name: 'Olive & Blush', colors: palette('#5d6545', '#c8c1ac', '#efc8c0', '#f4efe4', '#fbf8f1', '#2d2a21', '#706c5d') },
      { name: 'Dusty Blue & Silver', colors: palette('#566b83', '#c9cbcf', '#f3d6cb', '#f2f2ee', '#fbfbf8', '#1f2934', '#67717b') },
      { name: 'Terracotta & Gold', colors: palette('#97573d', '#d1b27a', '#f5d9c6', '#f7efe5', '#fdf9f3', '#3a2418', '#7b6455') },
      { name: 'Sage & Ivory', colors: palette('#7a876b', '#cfc9b6', '#f0d2c6', '#f5f3eb', '#fcfbf6', '#2a2f25', '#6e7367') },
    ],
    fonts: 'romantic',
    look: 'garden',
    ornament: 'laurel',
    dress: { frame: 'scallop', divider: 'flourish' },
    heroTone: 'light',
    closing: { rsvp: 'default', footer: 'blessing' },
    effect: 'none',
    intro: 'zipper',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: oliveHeroMobile, desktop: oliveHeroDesktop },
    card: { mobile: oliveCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('portraits', 'letter', 'frames'),
  },
  {
    key: 'noir-zip-reception',
    name: 'Noir Zip',
    description:
      'A reception in black leather and gold: guests unzip a leather clutch by its champagne tag, and your card rises out of it in tall capitals inside an art deco frame, with the date, the venue, an RSVP and a countdown.',
    category: 'Reception',
    style: 'Canvas',
    tier: 'SIGNATURE',
    badge: 'NEW',
    tags: ['canvas', 'stationery', 'reception', 'modern', 'tactile', 'zipper', 'night', 'art-deco'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#1f1d1b', '#d3b46e', '#ead9b6', '#f4efe6', '#fbf9f4', '#0b0a09', '#6d665c'),
    presets: [
      { name: 'Black & Gold', colors: palette('#1f1d1b', '#d3b46e', '#ead9b6', '#f4efe6', '#fbf9f4', '#0b0a09', '#6d665c') },
      { name: 'Oxblood & Gold', colors: palette('#3d1418', '#d3b46e', '#eed7c1', '#f5eee7', '#fcf8f4', '#160608', '#715a5b') },
      { name: 'Navy & Silver', colors: palette('#18233a', '#c9ccd2', '#dfe4ec', '#f2f3f5', '#fbfbfc', '#070b14', '#646b78') },
      { name: 'Chocolate & Champagne', colors: palette('#3a2a21', '#d8c19a', '#efe1c8', '#f6f0e7', '#fcf9f4', '#140d09', '#76685c') },
    ],
    fonts: 'editorial',
    look: 'noir',
    ornament: 'deco',
    dress: { frame: 'ticket', seal: 'sunburst', edge: 'deco' },
    heroTone: 'dark',
    closing: { rsvp: 'card', footer: 'seal' },
    effect: 'goldDust',
    intro: 'zipper',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: noirHeroMobile, desktop: noirHeroDesktop },
    card: { mobile: noirCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('duet', 'curtain', 'mosaic'),
  },
  {
    key: 'satin-bow-engagement',
    name: 'Satin Bow',
    description:
      'An engagement card tied with satin: guests pull the ribbon to untie a dusty blue bow, and your names appear in a flowing hand under your monogram, with the date, the venue and an RSVP on soft ivory stock.',
    category: 'Engagement',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'stationery', 'engagement', 'romantic', 'tactile', 'ribbon', 'pastel'],
    eventTypes: ['ENGAGEMENT', 'WEDDING'],
    colors: palette('#3b4f66', '#bdb6a5', '#93aeca', '#f4f1ea', '#fbf9f4', '#1f2733', '#69717d'),
    presets: [
      { name: 'Dusty Blue', colors: palette('#3b4f66', '#bdb6a5', '#93aeca', '#f4f1ea', '#fbf9f4', '#1f2733', '#69717d') },
      { name: 'Blush Satin', colors: palette('#7a4352', '#c9ad84', '#e8b4bc', '#f8f1ee', '#fdf9f7', '#361b22', '#7e6a6f') },
      { name: 'Sage Satin', colors: palette('#45573f', '#c4b48a', '#a9bb9b', '#f3f3ec', '#fbfbf6', '#1f2a1c', '#6a7364') },
      { name: 'Lilac Satin', colors: palette('#59456f', '#c3b28d', '#bba7d4', '#f6f2f8', '#fcfafd', '#271d33', '#76698a') },
    ],
    fonts: 'elegant',
    look: 'classic',
    ornament: 'floral',
    dress: { frame: 'oval', seal: 'botanicalWreath' },
    heroTone: 'light',
    closing: { rsvp: 'default', footer: 'blessing' },
    effect: 'petals',
    intro: 'ribbon',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: bowHeroMobile, desktop: bowHeroDesktop },
    card: { mobile: bowCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('monogram', 'polaroid', 'stack'),
  },
  {
    key: 'velvet-seal-invite',
    name: 'Velvet Seal',
    description:
      'Emerald velvet sealed in gold wax: guests break the seal to open it, and your names shine in gold-foil script between gold vines, with the date, the venue, an RSVP and a countdown.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'SIGNATURE',
    badge: 'NEW',
    tags: ['canvas', 'stationery', 'royal', 'tactile', 'velvet', 'wax-seal', 'night'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#173f35', '#d0ad62', '#e9dcb8', '#f6f1e6', '#fcf9f2', '#071a14', '#5f6b64'),
    presets: [
      { name: 'Emerald Velvet', colors: palette('#173f35', '#d0ad62', '#e9dcb8', '#f6f1e6', '#fcf9f2', '#071a14', '#5f6b64') },
      { name: 'Wine Velvet', colors: palette('#4a1020', '#d0ad62', '#eed9c0', '#f7f0ec', '#fdf8f6', '#1d0309', '#705c62') },
      { name: 'Royal Blue Velvet', colors: palette('#162b5c', '#d0ad62', '#e3dcc4', '#f3f4f8', '#fbfbfd', '#060f26', '#5c6680') },
      { name: 'Plum Velvet', colors: palette('#3b1a47', '#d0ad62', '#ead7c7', '#f6f1f7', '#fcf9fd', '#16071c', '#6e5e75') },
    ],
    fonts: 'regal',
    look: 'royal',
    ornament: 'stars',
    dress: { frame: 'circle', seal: 'medallion', divider: 'rule' },
    heroTone: 'dark',
    closing: { rsvp: 'card', footer: 'seal' },
    effect: 'goldDust',
    intro: 'seal',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: velvetHeroMobile, desktop: velvetHeroDesktop },
    card: { mobile: velvetCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('profile', 'curtain', 'polaroid'),
  },
];
