import type { ArtboardInput, LayerInput } from '@bulava/template-schema';
import { palette, TITLE } from './builder';
import { at, b, cardButtons, eyebrows, lit, orn, photo, scene, sec, shape, t, text, widget, type CanvasSpec, type TextStyleInput } from './canvas-kit';

/**
 * The card collection: canvas invitations composed like printed cards, with the
 * engine's full-colour illustrations (elephants, a jharokha, peacocks, temple
 * bells, domes, roses, cakes…), foil lettering, illustrated scenes as layers
 * and paper textures. Every colour is a palette role, so each preset restyles
 * the whole card; photos are the host's own (an illustration or shape sits
 * behind each, for invitations without photos).
 */

const WEDDING_EYEBROWS: Array<[string[], ReturnType<typeof t>]> = [
  [['WEDDING'], t('template.weddingOf')],
  [['ENGAGEMENT'], t('template.engagementOf')],
];

/** Where a photo sits inside a jharokha layer at (x, y, w): its see-through opening. */
const jharokhaOpening = (x: number, y: number, w: number) => at(Math.round(x + w * 0.2067), Math.round(y + w * (440 / 300) * 0.2545), Math.round(w * 0.5867), Math.round(w * (440 / 300) * 0.5));

// ─────────────────────────── Shahi Gajraj: royal elephants ───────────────────────────

const GAJRAJ_EYEBROW: TextStyleInput = { font: 'body', size: 11, weight: 600, color: 'accent', letterSpacing: 0.3, transform: 'upper' };

const gajrajHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } },
  texture: 'paper',
  textureStrength: 0.55,
  layers: [
    orn('medallion', 'medallion', at(-35, 118, 460, 460), { color: 'secondary', opacity: 0.12, animation: { entrance: 'fade', motion: 'spin' } }),
    orn('frame', 'ornateFrame', at(14, 86, 362, 744), { color: 'secondary', foil: true, animation: { entrance: 'fade', durationSec: 1.2 } }),
    orn('toran', 'toran', at(-14, -10, 418, 112), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('lantern-l', 'lantern', at(28, 64, 32, 64), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: 0.3, motion: 'sway' } }),
    orn('lantern-r', 'lantern', at(330, 64, 32, 64), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: 0.4, motion: 'sway' } }),
    text('invocation', lit('॥ श्री गणेशाय नमः ॥'), at(70, 100, 250, 22), { font: 'Tiro Devanagari Hindi', size: 14, color: 'accent', letterSpacing: 0.04 }, { animation: { entrance: 'fade', delaySec: 0.2 } }),
    shape('photo-bg', 'arch', jharokhaOpening(95, 126, 200), { fill: { type: 'gradient', gradient: { from: 'accent', to: 'secondary', angle: 180 } } }),
    photo('photo', 'photo.cover', jharokhaOpening(95, 126, 200), { mask: 'arch', animation: { entrance: 'zoomIn', delaySec: 0.15 } }),
    orn('jharokha', 'jharokha', at(95, 126, 200, 293), { color: 'secondary', foil: true, shadow: 'soft', animation: { entrance: 'zoomIn' } }),
    orn('elephant-l', 'elephant', at(-10, 344, 160, 128), { color: 'accent', shadow: 'soft', animation: { entrance: 'slideRight', delaySec: 0.3 } }),
    orn('elephant-r', 'elephant', at(240, 344, 160, 128), { color: 'accent', flipX: true, shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.3 } }),
    ...eyebrows('eyebrow', at(40, 486, 310, 20), WEDDING_EYEBROWS, GAJRAJ_EYEBROW),
    text('names', TITLE, at(18, 504, 354, 104), { font: 'script', size: 54, color: 'secondary', foil: true, lineHeight: 1.04 }, { animation: { entrance: 'fadeUp', delaySec: 0.45, motion: 'shimmer' } }),
    orn('flourish', 'flourish', at(105, 610, 180, 36), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.55 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 648, 330, 26), { font: 'heading', size: 16, weight: 600, color: 'accent', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('city', b('venue.city'), at(40, 676, 310, 20), { font: 'body', size: 11, weight: 500, color: 'accent', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 20, color: 'primary', labelColor: 'primary', boxColor: 'accent', font: 'heading' }, at(48, 704, 294, 64), { animation: { entrance: 'fadeUp', delaySec: 0.75 } }),
    text('blessings', t('template.blessings'), at(44, 774, 302, 16), { font: 'body', size: 8.5, weight: 500, color: 'accent', letterSpacing: 0.14, transform: 'upper' }, { animation: { entrance: 'fade', delaySec: 0.9 } }),
  ],
};

const gajrajHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } },
  texture: 'paper',
  textureStrength: 0.55,
  layers: [
    orn('medallion', 'medallion', at(790, 0, 640, 640), { color: 'secondary', opacity: 0.1, animation: { entrance: 'fade', motion: 'spin' } }),
    orn('frame', 'ornateFrame', at(28, 104, 1384, 772), { color: 'secondary', foil: true, animation: { entrance: 'fade', durationSec: 1.2 } }),
    ...[0, 1, 2, 3].map((i) => orn(`toran-${i + 1}`, 'toran', at(-14 + i * 366, -12, 372, 112), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.08), motion: 'sway' } })),
    ...[
      [70, 0.2],
      [700, 0.3],
      [1330, 0.4],
    ].map(([x, d], i) => orn(`lantern-${i + 1}`, 'lantern', at(x!, 96, 42, 84), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: d!, motion: 'sway' } })),
    shape('photo-bg', 'arch', jharokhaOpening(940, 130, 300), { fill: { type: 'gradient', gradient: { from: 'accent', to: 'secondary', angle: 180 } } }),
    photo('photo', 'photo.cover', jharokhaOpening(940, 130, 300), { mask: 'arch', animation: { entrance: 'zoomIn', delaySec: 0.15 } }),
    orn('jharokha', 'jharokha', at(940, 130, 300, 440), { color: 'secondary', foil: true, shadow: 'soft', animation: { entrance: 'zoomIn' } }),
    orn('elephant-l', 'elephant', at(762, 462, 220, 176), { color: 'accent', shadow: 'soft', animation: { entrance: 'slideRight', delaySec: 0.3 } }),
    orn('elephant-r', 'elephant', at(1198, 462, 220, 176), { color: 'accent', flipX: true, shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.3 } }),
    text('invocation', lit('॥ श्री गणेशाय नमः ॥'), at(150, 186, 560, 30), { font: 'Tiro Devanagari Hindi', size: 20, color: 'accent', align: 'left' }, { animation: { entrance: 'fade', delaySec: 0.2 } }),
    ...eyebrows('eyebrow', at(150, 250, 600, 26), WEDDING_EYEBROWS, { ...GAJRAJ_EYEBROW, size: 15, align: 'left' }),
    text('names', TITLE, at(140, 280, 680, 220), { font: 'script', size: 108, color: 'secondary', foil: true, lineHeight: 1.02, align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.45, motion: 'shimmer' } }),
    orn('flourish', 'flourish', at(140, 508, 300, 60), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.55 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(150, 580, 640, 36), { font: 'heading', size: 26, weight: 600, color: 'accent', letterSpacing: 0.1, transform: 'upper', align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    text('city', b('venue.city'), at(150, 620, 640, 26), { font: 'body', size: 15, weight: 500, color: 'accent', letterSpacing: 0.24, transform: 'upper', align: 'left' }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.65 } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 30, color: 'primary', labelColor: 'primary', boxColor: 'accent', font: 'heading' }, at(150, 664, 450, 98), { animation: { entrance: 'fadeUp', delaySec: 0.75 } }),
    text('blessings', t('template.blessings'), at(150, 782, 640, 22), { font: 'body', size: 12, weight: 500, color: 'accent', letterSpacing: 0.16, transform: 'upper', align: 'left' }, { animation: { entrance: 'fade', delaySec: 0.9 } }),
  ],
};

const gajrajCard: ArtboardInput = {
  width: 390,
  height: 640,
  background: { type: 'color', color: 'surface' },
  texture: 'paper',
  textureStrength: 0.6,
  layers: [
    orn('frame', 'ornateFrame', at(10, 10, 370, 620), { color: 'secondary', foil: true }),
    orn('medallion', 'medallion', at(158, 26, 74, 74), { color: 'secondary', foil: true, animation: { entrance: 'zoomIn', motion: 'spin' } }),
    text('eyebrow', t('template.schedule.title'), at(40, 106, 310, 18), { font: 'body', size: 10, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' }, { animation: { entrance: 'fade' } }),
    text('name', b('function.name'), at(24, 124, 342, 76), { font: 'script', size: 46, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 200, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' }, animation: { entrance: 'fadeUp', delaySec: 0.15 } }),
    orn('flourish', 'flourish', at(115, 242, 160, 32), { color: 'secondary', foil: true }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'primary', iconCircle: 'accent', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'secondary' }, at(40, 282, 310, 228), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(522, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
    orn('elephant-l', 'elephant', at(22, 574, 66, 53), { color: 'secondary', opacity: 0.9 }),
    orn('elephant-r', 'elephant', at(302, 574, 66, 53), { color: 'secondary', flipX: true, opacity: 0.9 }),
  ],
};

// ─────────────────────────── Mor Pankh: the peacock garden ───────────────────────────

const PANKH_EYEBROW: TextStyleInput = { font: 'body', size: 11, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' };

const pankhHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'gradient', gradient: { from: 'surface', to: 'background', angle: 180 } },
  texture: 'watercolor',
  textureStrength: 0.6,
  layers: [
    shape('wash', 'ellipse', at(-60, 500, 510, 460), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', to: 'background' } }, opacity: 0.3 }),
    orn('paisley-l', 'paisleyOrnate', at(-30, -22, 120, 166, -16), { color: 'accent', animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('paisley-r', 'paisleyOrnate', at(300, -22, 120, 166, 16), { color: 'accent', flipX: true, animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'sway' } }),
    shape('photo-bg', 'arch', at(118, 78, 154, 216), { fill: { type: 'gradient', gradient: { from: 'accent', to: 'primary', angle: 160 } }, opacity: 0.9 }),
    photo('photo', 'photo.cover', at(118, 78, 154, 216), { mask: 'arch', border: { width: 3, color: 'surface' }, animation: { entrance: 'zoomIn', delaySec: 0.1 } }),
    orn('arch', 'archFrame', at(104, 62, 182, 248), { color: 'secondary', foil: true, animation: { entrance: 'zoomIn' } }),
    orn('lotus', 'lotus', at(155, 288, 80, 48), { color: 'secondary', foil: true, animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...eyebrows('eyebrow', at(40, 344, 310, 20), WEDDING_EYEBROWS, PANKH_EYEBROW),
    text('names', TITLE, at(16, 362, 358, 96), { font: 'script', size: 54, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    orn('flourish', 'flourish', at(110, 458, 170, 30), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 490, 330, 26), { font: 'heading', size: 17, weight: 600, color: 'text', letterSpacing: 0.1, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    text('city', b('venue.city'), at(40, 516, 310, 20), { font: 'body', size: 11, weight: 500, color: 'muted', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    orn('lotus-pond', 'lotus', at(4, 774, 118, 70), { color: 'accent', opacity: 0.8 }),
    orn('peacock', 'royalPeacock', at(60, 524, 266, 333), { color: 'accent', shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.35, durationSec: 1.2 } }),
  ],
};

const pankhHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'gradient', gradient: { from: 'surface', to: 'background', angle: 160 } },
  texture: 'watercolor',
  textureStrength: 0.6,
  layers: [
    shape('wash', 'ellipse', at(860, 150, 760, 760), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', to: 'background' } }, opacity: 0.3 }),
    orn('paisley-l', 'paisleyOrnate', at(-36, -30, 160, 222, -16), { color: 'accent', animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('paisley-b', 'paisleyOrnate', at(-20, 700, 140, 194, 196), { color: 'accent', opacity: 0.9 }),
    shape('photo-bg', 'arch', at(196, 196, 280, 400), { fill: { type: 'gradient', gradient: { from: 'accent', to: 'primary', angle: 160 } }, opacity: 0.9 }),
    photo('photo', 'photo.cover', at(196, 196, 280, 400), { mask: 'arch', border: { width: 4, color: 'surface' }, animation: { entrance: 'zoomIn', delaySec: 0.1 } }),
    orn('arch', 'archFrame', at(174, 170, 324, 448), { color: 'secondary', foil: true, animation: { entrance: 'zoomIn' } }),
    orn('lotus', 'lotus', at(276, 592, 120, 72), { color: 'secondary', foil: true }),
    ...eyebrows('eyebrow', at(540, 250, 520, 26), WEDDING_EYEBROWS, { ...PANKH_EYEBROW, size: 15 }),
    text('names', TITLE, at(520, 280, 560, 200), { font: 'script', size: 96, color: 'primary', lineHeight: 1.02 }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    orn('flourish', 'flourish', at(650, 486, 300, 56), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(540, 556, 520, 34), { font: 'heading', size: 24, weight: 600, color: 'text', letterSpacing: 0.1, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    text('city', b('venue.city'), at(540, 594, 520, 24), { font: 'body', size: 14, weight: 500, color: 'muted', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 28, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(580, 650, 440, 96), { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    orn('peacock', 'royalPeacock', at(1060, 250, 380, 475), { color: 'accent', shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.35, durationSec: 1.2 } }),
  ],
};

const pankhCard: ArtboardInput = {
  width: 390,
  height: 600,
  background: { type: 'color', color: 'surface' },
  texture: 'paper',
  textureStrength: 0.45,
  layers: [
    shape('border', 'rect', at(12, 12, 366, 576), { fill: { type: 'none' }, stroke: { width: 1.5, color: 'secondary' }, radius: 18 }),
    orn('feathers', 'peacock', at(150, 18, 90, 90), { color: 'secondary', animation: { entrance: 'zoomIn', motion: 'sway' } }),
    text('eyebrow', t('template.schedule.title'), at(40, 110, 310, 18), { font: 'body', size: 10, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' }),
    text('name', b('function.name'), at(24, 128, 342, 72), { font: 'script', size: 44, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 198, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
    orn('flourish', 'flourish', at(115, 238, 160, 30), { color: 'secondary', foil: true }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'surface', iconCircle: 'accent', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'muted' }, at(40, 274, 310, 224), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(512, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
    orn('paisley-l', 'paisleyOrnate', at(-10, 548, 46, 64, -30), { color: 'accent', opacity: 0.9 }),
    orn('paisley-r', 'paisleyOrnate', at(354, 548, 46, 64, 30), { color: 'accent', flipX: true, opacity: 0.9 }),
  ],
};

// ─────────────────────────── Kovil Mani: temple bells (South Indian) ───────────────────────────

const KOVIL_EYEBROW: TextStyleInput = { font: 'body', size: 11, weight: 600, color: 'accent', letterSpacing: 0.3, transform: 'upper' };
const BANANA = '#3d7f3e';

const kovilHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'color', color: 'primary' },
  texture: 'linen',
  textureStrength: 0.55,
  layers: [
    orn('kolam', 'kolam', at(60, 196, 270, 270), { color: 'accent', opacity: 0.1, animation: { entrance: 'fade', motion: 'spin' } }),
    shape('zari-l', 'rect', at(14, 30, 2, 470), { fill: { type: 'color', color: 'secondary' }, opacity: 0.8 }),
    shape('zari-r', 'rect', at(374, 30, 2, 470), { fill: { type: 'color', color: 'secondary' }, opacity: 0.8 }),
    orn('border-top', 'templeBorder', at(-4, 0, 398, 34), { color: 'secondary', foil: true }),
    orn('jasmine-l', 'jasmineStrand', at(24, 30, 28, 290), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('jasmine-r', 'jasmineStrand', at(338, 30, 28, 290), { animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'sway' } }),
    orn('bells', 'templeBells', at(105, 22, 180, 180), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeDown', motion: 'sway' } }),
    ...eyebrows('eyebrow', at(40, 224, 310, 20), WEDDING_EYEBROWS, KOVIL_EYEBROW),
    text('names', TITLE, at(20, 246, 350, 124), { font: 'heading', size: 42, color: 'secondary', foil: true, lineHeight: 1.12 }, { animation: { entrance: 'fadeUp', delaySec: 0.3, motion: 'shimmer' } }),
    orn('lotus', 'lotus', at(150, 370, 90, 54), { color: 'secondary', foil: true, animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 428, 330, 26), { font: 'body', size: 15, weight: 600, color: 'accent', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    text('city', b('venue.city'), at(40, 456, 310, 20), { font: 'body', size: 11, weight: 500, color: 'accent', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' }, animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    widget('countdown', { type: 'countdown', variant: 'inline', size: 18, color: 'accent', labelColor: 'accent', boxColor: 'surface', font: 'heading' }, at(70, 482, 250, 34), { animation: { entrance: 'fadeUp', delaySec: 0.55 } }),
    scene('temple', 'gopuram', at(0, 506, 390, 338), { sky: false, animation: { entrance: 'fade', durationSec: 1.2 } }),
    orn('banana-l', 'bananaLeaf', at(-56, 600, 140, 242), { color: BANANA, animation: { entrance: 'slideRight', delaySec: 0.3 } }),
    orn('banana-r', 'bananaLeaf', at(306, 600, 140, 242), { color: BANANA, flipX: true, animation: { entrance: 'slideLeft', delaySec: 0.3 } }),
    shape('band-bottom', 'rect', at(0, 814, 390, 30), { fill: { type: 'color', color: 'primary' } }),
    orn('border-bottom', 'templeBorder', at(-4, 812, 398, 32), { color: 'secondary', foil: true, flipY: true }),
  ],
};

const kovilHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'color', color: 'primary' },
  texture: 'linen',
  textureStrength: 0.55,
  layers: [
    orn('kolam', 'kolam', at(530, 40, 380, 380), { color: 'accent', opacity: 0.08, animation: { entrance: 'fade', motion: 'spin' } }),
    orn('border-top', 'templeBorder', at(-4, 0, 1448, 40), { color: 'secondary', foil: true }),
    ...[40, 150, 1262, 1372].map((x, i) => orn(`jasmine-${i + 1}`, 'jasmineStrand', at(x, 34, 30, i % 3 ? 220 : 320), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.08), motion: 'sway' } })),
    orn('bells-l', 'templeBells', at(220, 30, 200, 200), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('bells-r', 'templeBells', at(1020, 30, 200, 200), { color: 'secondary', shadow: 'soft', animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'sway' } }),
    ...eyebrows('eyebrow', at(420, 112, 600, 24), WEDDING_EYEBROWS, { ...KOVIL_EYEBROW, size: 14 }),
    text('names', TITLE, at(320, 138, 800, 110), { font: 'heading', size: 72, color: 'secondary', foil: true, lineHeight: 1.08 }, { animation: { entrance: 'fadeUp', delaySec: 0.3, motion: 'shimmer' } }),
    orn('lotus', 'lotus', at(660, 250, 120, 72), { color: 'secondary', foil: true }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(420, 326, 600, 32), { font: 'body', size: 20, weight: 600, color: 'accent', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    text('city', b('venue.city'), at(420, 360, 600, 24), { font: 'body', size: 14, weight: 500, color: 'accent', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('countdown', { type: 'countdown', variant: 'inline', size: 24, color: 'accent', labelColor: 'accent', boxColor: 'surface', font: 'heading' }, at(520, 392, 400, 44), { animation: { entrance: 'fadeUp', delaySec: 0.55 } }),
    scene('temple', 'gopuram', at(0, 452, 1440, 448), { animation: { entrance: 'fade', durationSec: 1.2 } }),
    shape('scallop', 'scallop', at(-10, 438, 1460, 30, 180), { fill: { type: 'color', color: 'primary' } }),
    orn('banana-l', 'bananaLeaf', at(-30, 520, 220, 380), { color: BANANA, animation: { entrance: 'slideRight', delaySec: 0.3 } }),
    orn('banana-r', 'bananaLeaf', at(1250, 520, 220, 380), { color: BANANA, flipX: true, animation: { entrance: 'slideLeft', delaySec: 0.3 } }),
    shape('band-bottom', 'rect', at(0, 864, 1440, 36), { fill: { type: 'color', color: 'primary' } }),
    orn('border-bottom', 'templeBorder', at(-4, 862, 1448, 38), { color: 'secondary', foil: true, flipY: true }),
  ],
};

const kovilCard: ArtboardInput = {
  width: 390,
  height: 620,
  background: { type: 'color', color: 'surface' },
  texture: 'linen',
  textureStrength: 0.35,
  layers: [
    shape('band-top', 'rect', at(0, 0, 390, 46), { fill: { type: 'color', color: 'primary' } }),
    orn('border-top', 'templeBorder', at(-4, 12, 398, 34), { color: 'secondary', foil: true }),
    shape('band-bottom', 'rect', at(0, 586, 390, 34), { fill: { type: 'color', color: 'primary' } }),
    orn('border-bottom', 'templeBorder', at(-4, 586, 398, 30), { color: 'secondary', foil: true, flipY: true }),
    orn('kolam', 'kolam', at(95, 210, 200, 200), { color: 'primary', opacity: 0.07 }),
    orn('bells', 'templeBells', at(155, 44, 80, 80), { color: 'secondary', animation: { entrance: 'fadeDown', motion: 'sway' } }),
    text('eyebrow', t('template.schedule.title'), at(40, 126, 310, 18), { font: 'body', size: 10, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' }),
    text('name', b('function.name'), at(24, 144, 342, 64), { font: 'heading', size: 34, color: 'primary', lineHeight: 1.1 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 208, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'surface', iconCircle: 'primary', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'secondary' }, at(40, 256, 310, 228), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(500, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary', radius: 12 }),
    orn('jasmine-l', 'jasmineStrand', at(10, 46, 20, 170)),
    orn('jasmine-r', 'jasmineStrand', at(360, 46, 20, 170)),
  ],
};

// ─────────────────────────── Mehendi Rang ───────────────────────────

const RANG_EYEBROW: TextStyleInput = { font: 'body', size: 11, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper', align: 'left' };
/** Henna is henna whatever the palette. */
const HENNA = '#8a3a17';

const rangHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', via: 'background', to: 'secondary' } },
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    ...[
      [24, 230],
      [74, 150],
      [316, 150],
      [366, 230],
    ].map(([x, h], i) => orn(`strand-${i + 1}`, 'marigoldStrand', at(x! - 12, 40, 24, h!), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.06), motion: 'sway' } })),
    orn('toran', 'toran', at(-14, -10, 418, 112), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('hand', 'mehendiHand', at(164, 180, 246, 348, 8), { color: HENNA, flipX: true, shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.3, durationSec: 1.1 } }),
    text('eyebrow', t('template.mehendi'), at(36, 200, 200, 20), RANG_EYEBROW, { animation: { entrance: 'fadeDown', delaySec: 0.1 } }),
    text('names', TITLE, at(30, 222, 190, 150), { font: 'script', size: 46, color: 'primary', lineHeight: 1.08, align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('date', b('event.startDate', { format: 'date' }), at(36, 378, 170, 26), { font: 'heading', size: 16, color: 'text', align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.35 } }),
    text('city', b('venue.city'), at(36, 406, 166, 20), { font: 'body', size: 11, weight: 600, color: 'muted', letterSpacing: 0.24, transform: 'upper', align: 'left' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('rsvp', { type: 'button', label: t('rsvp.title'), action: 'rsvp', icon: 'heart', fill: 'accent', color: 'surface', size: 13, weight: 700, font: 'body', radius: 40, shadow: true }, at(36, 442, 168, 44), { animation: { entrance: 'pop', delaySec: 0.5 } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 19, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(44, 556, 302, 64), { animation: { entrance: 'fadeUp', delaySec: 0.6 } }),
    orn('rangoli', 'rangoliBloom', at(65, 646, 260, 260), { color: 'secondary', animation: { entrance: 'zoomIn', delaySec: 0.4, motion: 'spin' } }),
    orn('paisley-l', 'paisleyOrnate', at(-12, 724, 66, 92, -20), { color: 'accent' }),
    orn('paisley-r', 'paisleyOrnate', at(336, 724, 66, 92, 20), { color: 'accent', flipX: true }),
  ],
};

const rangHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', via: 'background', to: 'secondary' } },
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    ...[0, 1, 2, 3].map((i) => orn(`toran-${i + 1}`, 'toran', at(-14 + i * 366, -12, 372, 112), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.08), motion: 'sway' } })),
    ...[
      [40, 300],
      [104, 200],
      [1336, 200],
      [1400, 300],
    ].map(([x, h], i) => orn(`strand-${i + 1}`, 'marigoldStrand', at(x! - 14, 44, 28, h!), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.06), motion: 'sway' } })),
    orn('rangoli', 'rangoliBloom', at(-180, 660, 400, 400), { color: 'secondary', opacity: 0.95, animation: { entrance: 'zoomIn', motion: 'spin' } }),
    orn('paisley', 'paisleyOrnate', at(1190, 650, 140, 194, 16), { color: 'accent', flipX: true }),
    orn('hand', 'mehendiHand', at(860, 104, 420, 595, 8), { color: HENNA, flipX: true, shadow: 'soft', animation: { entrance: 'slideLeft', delaySec: 0.3, durationSec: 1.1 } }),
    text('eyebrow', t('template.mehendi'), at(250, 230, 560, 26), { ...RANG_EYEBROW, size: 15 }, { animation: { entrance: 'fadeDown', delaySec: 0.1 } }),
    text('names', TITLE, at(240, 260, 600, 200), { font: 'script', size: 92, color: 'primary', lineHeight: 1.04, align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(250, 476, 560, 34), { font: 'heading', size: 24, color: 'text', align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.35 } }),
    text('city', b('venue.city'), at(250, 514, 560, 24), { font: 'body', size: 14, weight: 600, color: 'muted', letterSpacing: 0.24, transform: 'upper', align: 'left' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 28, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(250, 566, 420, 96), { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    widget('rsvp', { type: 'button', label: t('rsvp.title'), action: 'rsvp', icon: 'heart', fill: 'accent', color: 'surface', size: 16, weight: 700, font: 'body', radius: 50, shadow: true }, at(250, 690, 230, 56), { animation: { entrance: 'pop', delaySec: 0.6 } }),
  ],
};

const rangCard: ArtboardInput = {
  width: 390,
  height: 610,
  background: { type: 'color', color: 'surface' },
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    shape('wash', 'rect', at(0, 0, 390, 120), { fill: { type: 'gradient', gradient: { from: 'secondary', to: 'surface', angle: 180 } }, opacity: 0.55 }),
    orn('toran', 'toran', at(-14, -8, 418, 112), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
    text('eyebrow', t('template.schedule.title'), at(40, 112, 310, 18), { font: 'body', size: 10, weight: 700, color: 'accent', letterSpacing: 0.3, transform: 'upper' }),
    text('name', b('function.name'), at(24, 130, 342, 70), { font: 'script', size: 42, color: 'primary', lineHeight: 1.08 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 200, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'surface', iconCircle: 'accent', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'secondary' }, at(40, 248, 310, 228), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(492, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
    orn('paisley-l', 'paisleyOrnate', at(-14, 548, 48, 66, -24), { color: 'accent' }),
    orn('paisley-r', 'paisleyOrnate', at(356, 548, 48, 66, 24), { color: 'accent', flipX: true }),
  ],
};

// ─────────────────────────── Noor Mahal: lanterns and arches ───────────────────────────

const NOOR_EYEBROW: TextStyleInput = { font: 'body', size: 11, weight: 600, color: 'accent', letterSpacing: 0.3, transform: 'upper' };

const lanterns = (items: Array<[number, number, number]>): LayerInput[] =>
  items.map(([x, w, h], i) => orn(`lantern-${i + 1}`, 'lantern', at(x, -6, w, h), { color: 'secondary', shadow: 'glow', animation: { entrance: 'fadeDown', delaySec: sec(0.1 + i * 0.08), motion: 'sway' } }));

const noorHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'gradient', gradient: { from: 'text', to: 'primary', angle: 180 } },
  texture: 'grain',
  textureStrength: 0.35,
  layers: [
    orn('stars', 'stars', at(0, 0, 390, 300), { color: 'accent', opacity: 0.75, animation: { entrance: 'fade', motion: 'twinkle' } }),
    orn('moon', 'crescent', at(296, 108, 58, 58), { color: 'accent', shadow: 'glow', animation: { entrance: 'fade', delaySec: 0.2 } }),
    ...lanterns([
      [34, 40, 112],
      [96, 30, 78],
      [262, 30, 78],
    ]),
    orn('arabesque', 'arabesque', at(70, 150, 250, 250), { color: 'primary', shadow: 'glow', animation: { entrance: 'zoomIn', delaySec: 0.1, motion: 'spin' } }),
    shape('photo-bg', 'ellipse', at(144, 224, 102, 102), { fill: { type: 'color', color: 'primary' } }),
    photo('photo', 'photo.cover', at(144, 224, 102, 102), { mask: 'circle', border: { width: 3, color: 'secondary' }, animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
    ...eyebrows('eyebrow', at(40, 418, 310, 20), WEDDING_EYEBROWS, NOOR_EYEBROW),
    text('names', TITLE, at(16, 438, 358, 108), { font: 'script', size: 58, color: 'secondary', foil: true, lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.35, motion: 'shimmer' } }),
    orn('flourish', 'flourish', at(105, 546, 180, 34), { color: 'secondary', foil: true }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 584, 330, 26), { font: 'heading', size: 17, color: 'accent', letterSpacing: 0.12, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    text('city', b('venue.city'), at(40, 612, 310, 20), { font: 'body', size: 11, weight: 500, color: 'accent', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
    orn('domes', 'domes', at(-14, 640, 418, 242), { color: 'secondary', foil: true, animation: { entrance: 'fadeUp', delaySec: 0.3, durationSec: 1.2 } }),
  ],
};

const noorHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'gradient', gradient: { from: 'text', to: 'primary', angle: 180 } },
  texture: 'grain',
  textureStrength: 0.35,
  layers: [
    orn('stars', 'stars', at(0, 0, 1440, 480), { color: 'accent', opacity: 0.7, animation: { entrance: 'fade', motion: 'twinkle' } }),
    orn('moon', 'crescent', at(1240, 110, 90, 90), { color: 'accent', shadow: 'glow' }),
    ...lanterns([
      [80, 50, 150],
      [190, 36, 100],
      [470, 40, 120],
      [940, 40, 120],
      [1150, 36, 100],
      [1340, 50, 150],
    ]),
    orn('arabesque', 'arabesque', at(160, 170, 380, 380), { color: 'primary', shadow: 'glow', animation: { entrance: 'zoomIn', motion: 'spin' } }),
    shape('photo-bg', 'ellipse', at(273, 283, 154, 154), { fill: { type: 'color', color: 'primary' } }),
    photo('photo', 'photo.cover', at(273, 283, 154, 154), { mask: 'circle', border: { width: 4, color: 'secondary' } }),
    ...eyebrows('eyebrow', at(640, 230, 640, 26), WEDDING_EYEBROWS, { ...NOOR_EYEBROW, size: 15 }),
    text('names', TITLE, at(620, 258, 680, 190), { font: 'script', size: 100, color: 'secondary', foil: true, lineHeight: 1.02 }, { animation: { entrance: 'fadeUp', delaySec: 0.35, motion: 'shimmer' } }),
    orn('flourish', 'flourish', at(810, 450, 300, 56), { color: 'secondary', foil: true }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(640, 516, 640, 34), { font: 'heading', size: 24, color: 'accent', letterSpacing: 0.12, transform: 'upper' }),
    text('city', b('venue.city'), at(640, 554, 640, 24), { font: 'body', size: 14, weight: 500, color: 'accent', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
    orn('domes-l', 'domes', at(40, 668, 400, 232), { color: 'secondary', foil: true, opacity: 0.85 }),
    orn('domes', 'domes', at(470, 600, 520, 302), { color: 'secondary', foil: true }),
    orn('domes-r', 'domes', at(1000, 668, 400, 232), { color: 'secondary', foil: true, opacity: 0.85 }),
  ],
};

const noorCard: ArtboardInput = {
  width: 390,
  height: 630,
  background: { type: 'color', color: 'surface' },
  texture: 'grain',
  textureStrength: 0.25,
  layers: [
    orn('frame', 'ornateFrame', at(10, 10, 370, 610), { color: 'secondary', foil: true }),
    orn('arabesque', 'arabesque', at(160, 26, 70, 70), { color: 'primary', animation: { entrance: 'zoomIn', motion: 'spin' } }),
    text('eyebrow', t('template.schedule.title'), at(40, 106, 310, 18), { font: 'body', size: 10, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' }),
    text('name', b('function.name'), at(24, 124, 342, 74), { font: 'script', size: 46, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 198, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
    orn('flourish', 'flourish', at(115, 240, 160, 30), { color: 'secondary', foil: true }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'surface', iconCircle: 'primary', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'secondary' }, at(40, 278, 310, 228), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(520, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
    orn('lantern-l', 'lantern', at(30, 14, 22, 50), { color: 'secondary' }),
    orn('lantern-r', 'lantern', at(338, 14, 22, 50), { color: 'secondary' }),
  ],
};

// ─────────────────────────── Eternal Bloom: roses and doves ───────────────────────────

const SAGE = '#6b8f6e';
const BLOOM_EYEBROW: TextStyleInput = { font: 'body', size: 11, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' };

const bloomHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'color', color: 'background' },
  texture: 'watercolor',
  textureStrength: 0.65,
  layers: [
    shape('blush', 'ellipse', at(-60, 120, 510, 460), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', to: 'background' } }, opacity: 0.45 }),
    orn('roses-top', 'roseCluster', at(-26, -18, 272, 230), { color: SAGE, animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('roses-bottom', 'roseCluster', at(144, 632, 272, 230), { color: SAGE, flipX: true, flipY: true, animation: { entrance: 'fadeUp', delaySec: 0.2, motion: 'sway' } }),
    shape('photo-bg', 'ellipse', at(104, 150, 182, 228), { fill: { type: 'gradient', gradient: { from: 'accent', to: 'primary', angle: 170 } } }),
    photo('photo', 'photo.cover', at(104, 150, 182, 228), { mask: 'ellipse', border: { width: 3, color: 'secondary' }, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.1 } }),
    orn('doves', 'doves', at(130, 386, 130, 87), { color: 'secondary', animation: { entrance: 'fadeUp', delaySec: 0.25, motion: 'float' } }),
    ...eyebrows('eyebrow', at(40, 478, 310, 20), [...WEDDING_EYEBROWS, [['ANNIVERSARY'], t('template.celebrateWith')]], BLOOM_EYEBROW),
    text('names', TITLE, at(16, 496, 358, 104), { font: 'script', size: 56, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 604, 330, 26), { font: 'heading', size: 17, weight: 600, color: 'text', letterSpacing: 0.08, transform: 'upper' }, { animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('city', b('venue.city'), at(40, 632, 310, 20), { font: 'body', size: 11, weight: 500, color: 'muted', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 19, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(48, 664, 294, 62), { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
  ],
};

const bloomHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'color', color: 'background' },
  texture: 'watercolor',
  textureStrength: 0.65,
  layers: [
    shape('blush', 'ellipse', at(80, 80, 640, 740), { fill: { type: 'gradient', gradient: { kind: 'radial', from: 'accent', to: 'background' } }, opacity: 0.45 }),
    orn('roses-top', 'roseCluster', at(-30, -24, 420, 354), { color: SAGE, animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('roses-bottom', 'roseCluster', at(1060, 560, 420, 354), { color: SAGE, flipX: true, flipY: true, animation: { entrance: 'fadeUp', delaySec: 0.2, motion: 'sway' } }),
    shape('photo-bg', 'ellipse', at(250, 170, 300, 380), { fill: { type: 'gradient', gradient: { from: 'accent', to: 'primary', angle: 170 } } }),
    photo('photo', 'photo.cover', at(250, 170, 300, 380), { mask: 'ellipse', border: { width: 4, color: 'secondary' }, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.1 } }),
    orn('doves', 'doves', at(870, 150, 180, 120), { color: 'secondary', animation: { entrance: 'fadeUp', delaySec: 0.25, motion: 'float' } }),
    ...eyebrows('eyebrow', at(660, 290, 600, 26), [...WEDDING_EYEBROWS, [['ANNIVERSARY'], t('template.celebrateWith')]], { ...BLOOM_EYEBROW, size: 15 }),
    text('names', TITLE, at(640, 318, 640, 180), { font: 'script', size: 96, color: 'primary', lineHeight: 1.02 }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    orn('flourish', 'flourish', at(810, 500, 300, 56), { color: 'secondary' }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(660, 566, 600, 34), { font: 'heading', size: 24, weight: 600, color: 'text', letterSpacing: 0.08, transform: 'upper' }),
    text('city', b('venue.city'), at(660, 604, 600, 24), { font: 'body', size: 14, weight: 500, color: 'muted', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 28, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(750, 652, 420, 96), { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
  ],
};

const bloomCard: ArtboardInput = {
  width: 390,
  height: 630,
  background: { type: 'color', color: 'surface' },
  texture: 'watercolor',
  textureStrength: 0.45,
  layers: [
    orn('garland', 'floralGarland', at(-14, -10, 418, 116), { color: SAGE, animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('rings', 'rings', at(166, 110, 58, 43), { color: 'secondary', animation: { entrance: 'zoomIn', delaySec: 0.1 } }),
    text('eyebrow', t('template.schedule.title'), at(40, 160, 310, 18), { font: 'body', size: 10, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' }),
    text('name', b('function.name'), at(24, 178, 342, 70), { font: 'script', size: 44, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 246, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'primary', iconCircle: 'accent', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'accent' }, at(40, 290, 310, 228), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(532, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
  ],
};

// ─────────────────────────── Cake & Candles ───────────────────────────

const partyHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', to: 'background' } },
  texture: 'grain',
  textureStrength: 0.25,
  layers: [
    orn('confetti', 'confetti', at(-20, 90, 430, 250), { color: 'accent', opacity: 0.55, animation: { entrance: 'fade' } }),
    orn('balloons-l', 'balloonBunch', at(-40, 66, 162, 210), { animation: { entrance: 'fadeUp', delaySec: 0.1, motion: 'float' } }),
    orn('balloons-r', 'balloonBunch', at(268, 46, 162, 210), { flipX: true, animation: { entrance: 'fadeUp', delaySec: 0.2, motion: 'float' } }),
    orn('bunting', 'bunting', at(0, -4, 390, 96), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
    shape('photo-pop', 'ellipse', at(116, 120, 158, 158), { fill: { type: 'color', color: 'secondary' }, animation: { entrance: 'zoomIn' } }),
    { id: 'photo-empty', kind: 'icon', icon: 'sparkle', color: 'surface', frame: at(160, 164, 70, 70), opacity: 0.9 },
    photo('photo', 'photo.cover', at(116, 120, 158, 158), { mask: 'circle', border: { width: 6, color: 'surface' }, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.1 } }),
    ...eyebrows('eyebrow', at(40, 296, 310, 22), [[['BIRTHDAY'], t('template.birthdayOf')]], { font: 'body', size: 12, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper' }),
    text('names', TITLE, at(16, 318, 358, 96), { font: 'heading', size: 46, weight: 800, color: 'text', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('tagline', b('custom.tagline'), at(40, 414, 310, 40), { font: 'body', size: 14, color: 'muted', lineHeight: 1.4 }, { visibleWhen: { exists: 'custom.tagline' } }),
    shape('pill', 'rect', at(55, 460, 280, 50), { fill: { type: 'color', color: 'primary' }, radius: 999, shadow: true, animation: { entrance: 'pop', delaySec: 0.3 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(66, 460, 258, 50), { font: 'heading', size: 15, weight: 700, color: 'surface', letterSpacing: 0.02 }, { animation: { entrance: 'fade', delaySec: 0.4 } }),
    text('city', b('venue.city'), at(40, 518, 310, 20), { font: 'body', size: 12, weight: 600, color: 'muted', letterSpacing: 0.18, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
    orn('cake', 'cake', at(112, 548, 166, 208), { animation: { entrance: 'zoomIn', delaySec: 0.35 } }),
    orn('gift-l', 'giftBox', at(20, 676, 92, 92), { animation: { entrance: 'pop', delaySec: 0.5 } }),
    orn('gift-r', 'giftBox', at(282, 690, 80, 80), { animation: { entrance: 'pop', delaySec: 0.55 } }),
    widget('rsvp', { type: 'button', label: t('rsvp.title'), action: 'rsvp', icon: 'heart', fill: 'accent', color: 'surface', size: 14, weight: 700, font: 'body', radius: 40, shadow: true }, at(95, 772, 200, 46), { animation: { entrance: 'pop', delaySec: 0.7 } }),
  ],
};

const partyHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'gradient', gradient: { kind: 'radial', from: 'surface', to: 'background' } },
  texture: 'grain',
  textureStrength: 0.25,
  layers: [
    orn('confetti', 'confetti', at(640, 40, 800, 460), { color: 'accent', opacity: 0.5 }),
    orn('bunting-l', 'bunting', at(0, -6, 720, 140), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('bunting-r', 'bunting', at(720, -6, 720, 140), { animation: { entrance: 'fadeDown', delaySec: 0.1, motion: 'sway' } }),
    orn('balloons-l', 'balloonBunch', at(-30, 160, 240, 311), { animation: { entrance: 'fadeUp', motion: 'float' } }),
    orn('balloons-r', 'balloonBunch', at(1230, 140, 240, 311), { flipX: true, animation: { entrance: 'fadeUp', delaySec: 0.1, motion: 'float' } }),
    orn('cake', 'cake', at(830, 250, 340, 425), { animation: { entrance: 'zoomIn', delaySec: 0.3 } }),
    orn('gift-l', 'giftBox', at(730, 570, 140, 140), { animation: { entrance: 'pop', delaySec: 0.45 } }),
    orn('gift-r', 'giftBox', at(1150, 596, 116, 116), { animation: { entrance: 'pop', delaySec: 0.5 } }),
    shape('photo-pop', 'ellipse', at(250, 170, 150, 150), { fill: { type: 'color', color: 'secondary' } }),
    { id: 'photo-empty', kind: 'icon', icon: 'sparkle', color: 'surface', frame: at(290, 210, 70, 70), opacity: 0.9 },
    photo('photo', 'photo.cover', at(250, 170, 150, 150), { mask: 'circle', border: { width: 6, color: 'surface' }, shadow: true }),
    ...eyebrows('eyebrow', at(250, 346, 560, 26), [[['BIRTHDAY'], t('template.birthdayOf')]], { font: 'body', size: 15, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper', align: 'left' }),
    text('names', TITLE, at(244, 376, 560, 180), { font: 'heading', size: 76, weight: 800, color: 'text', lineHeight: 1.02, align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('tagline', b('custom.tagline'), at(250, 560, 520, 56), { font: 'body', size: 18, color: 'muted', lineHeight: 1.4, align: 'left' }, { visibleWhen: { exists: 'custom.tagline' } }),
    shape('pill', 'rect', at(250, 628, 400, 62), { fill: { type: 'color', color: 'primary' }, radius: 999, shadow: true }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(268, 628, 364, 62), { font: 'heading', size: 19, weight: 700, color: 'surface' }),
    text('city', b('venue.city'), at(250, 702, 400, 24), { font: 'body', size: 15, weight: 600, color: 'muted', letterSpacing: 0.18, transform: 'upper', align: 'left' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('rsvp', { type: 'button', label: t('rsvp.title'), action: 'rsvp', icon: 'heart', fill: 'accent', color: 'surface', size: 18, weight: 700, font: 'body', radius: 60, shadow: true }, at(250, 748, 240, 62), { animation: { entrance: 'pop', delaySec: 0.6 } }),
  ],
};

const partyCard: ArtboardInput = {
  width: 390,
  height: 600,
  background: { type: 'color', color: 'surface' },
  layers: [
    shape('wash', 'rect', at(0, 0, 390, 150), { fill: { type: 'gradient', gradient: { from: 'primary', via: 'secondary', to: 'accent', angle: 120 } }, opacity: 0.95 }),
    orn('confetti', 'confetti', at(-10, -20, 410, 200), { color: 'surface', opacity: 0.45 }),
    orn('bunting', 'bunting', at(0, -4, 390, 70)),
    text('eyebrow', t('template.schedule.title'), at(40, 66, 310, 18), { font: 'body', size: 10, weight: 700, color: 'surface', letterSpacing: 0.3, transform: 'upper' }),
    text('name', b('function.name'), at(24, 84, 342, 56), { font: 'heading', size: 32, weight: 800, color: 'surface', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 160, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'surface', iconCircle: 'primary', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'muted' }, at(40, 208, 310, 228), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(452, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary', radius: 14 }),
    orn('balloons', 'balloonBunch', at(300, 506, 70, 91), { animation: { motion: 'float' } }),
    orn('gift', 'giftBox', at(22, 520, 64, 64)),
  ],
};

// ─────────────────────────── Twinkle Star ───────────────────────────

const twinkleHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'gradient', gradient: { from: 'background', to: 'accent', angle: 180 } },
  texture: 'watercolor',
  textureStrength: 0.5,
  layers: [
    orn('stars', 'stars', at(0, 0, 390, 420), { color: 'secondary', opacity: 0.85, animation: { entrance: 'fade', motion: 'twinkle' } }),
    orn('moon', 'moonCloud', at(56, 30, 278, 241), { color: 'secondary', animation: { entrance: 'fadeDown', motion: 'float' } }),
    shape('photo-bg', 'ellipse', at(130, 286, 130, 130), { fill: { type: 'color', color: 'surface' } }),
    { id: 'photo-empty', kind: 'icon', icon: 'star', color: 'secondary', frame: at(165, 321, 60, 60) },
    photo('photo', 'photo.cover', at(130, 286, 130, 130), { mask: 'circle', border: { width: 5, color: 'surface' }, shadow: true, animation: { entrance: 'zoomIn', delaySec: 0.2 } }),
    ...eyebrows('eyebrow', at(40, 432, 310, 20), [[['BABY_SHOWER', 'NAMING_CEREMONY'], t('template.celebrateWith')]], { font: 'body', size: 11, weight: 600, color: 'muted', letterSpacing: 0.26, transform: 'upper' }),
    text('names', TITLE, at(16, 452, 358, 96), { font: 'script', size: 56, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    text('tagline', b('custom.tagline'), at(40, 546, 310, 36), { font: 'body', size: 14, color: 'muted', lineHeight: 1.4 }, { visibleWhen: { exists: 'custom.tagline' } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 586, 330, 26), { font: 'heading', size: 17, color: 'text', letterSpacing: 0.08, transform: 'upper' }),
    text('city', b('venue.city'), at(40, 612, 310, 20), { font: 'body', size: 11, weight: 500, color: 'muted', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 19, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(48, 644, 294, 62), { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    orn('balloons-l', 'balloonBunch', at(-6, 712, 78, 101), { flipX: true, animation: { entrance: 'fadeUp', delaySec: 0.4, motion: 'float' } }),
    orn('balloons-r', 'balloonBunch', at(312, 700, 86, 111), { animation: { entrance: 'fadeUp', delaySec: 0.5, motion: 'float' } }),
    ...[
      [-40, 778, 170, 110],
      [96, 792, 200, 110],
      [252, 774, 190, 120],
    ].map(([x, y, w, h], i) => shape(`cloud-${i + 1}`, 'ellipse', at(x!, y!, w!, h!), { fill: { type: 'color', color: 'surface' }, opacity: 0.92, animation: { entrance: 'fadeUp', delaySec: sec(0.2 + i * 0.1) } })),
  ],
};

const twinkleHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'gradient', gradient: { from: 'background', to: 'accent', angle: 160 } },
  texture: 'watercolor',
  textureStrength: 0.5,
  layers: [
    orn('stars', 'stars', at(0, 0, 1440, 600), { color: 'secondary', opacity: 0.8, animation: { entrance: 'fade', motion: 'twinkle' } }),
    orn('moon', 'moonCloud', at(860, 100, 460, 399), { color: 'secondary', animation: { entrance: 'fadeDown', motion: 'float' } }),
    shape('photo-bg', 'ellipse', at(1010, 520, 170, 170), { fill: { type: 'color', color: 'surface' } }),
    { id: 'photo-empty', kind: 'icon', icon: 'star', color: 'secondary', frame: at(1055, 565, 80, 80) },
    photo('photo', 'photo.cover', at(1010, 520, 170, 170), { mask: 'circle', border: { width: 6, color: 'surface' }, shadow: true }),
    ...eyebrows('eyebrow', at(200, 270, 560, 26), [[['BABY_SHOWER', 'NAMING_CEREMONY'], t('template.celebrateWith')]], { font: 'body', size: 15, weight: 600, color: 'muted', letterSpacing: 0.26, transform: 'upper', align: 'left' }),
    text('names', TITLE, at(190, 298, 620, 170), { font: 'script', size: 96, color: 'primary', lineHeight: 1.02, align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.3 } }),
    text('tagline', b('custom.tagline'), at(200, 472, 520, 56), { font: 'body', size: 18, color: 'muted', lineHeight: 1.4, align: 'left' }, { visibleWhen: { exists: 'custom.tagline' } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(200, 540, 560, 34), { font: 'heading', size: 24, color: 'text', letterSpacing: 0.08, transform: 'upper', align: 'left' }),
    text('city', b('venue.city'), at(200, 578, 560, 24), { font: 'body', size: 14, weight: 500, color: 'muted', letterSpacing: 0.24, transform: 'upper', align: 'left' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 28, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(200, 630, 420, 96), { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
    orn('balloons', 'balloonBunch', at(1260, 560, 150, 194), { animation: { motion: 'float' } }),
  ],
};

const twinkleCard: ArtboardInput = {
  width: 390,
  height: 600,
  background: { type: 'color', color: 'surface' },
  texture: 'watercolor',
  textureStrength: 0.4,
  layers: [
    shape('sky', 'rect', at(0, 0, 390, 130), { fill: { type: 'gradient', gradient: { from: 'background', to: 'accent', angle: 180 } } }),
    orn('stars', 'stars', at(0, 0, 390, 130), { color: 'secondary', opacity: 0.85, animation: { motion: 'twinkle' } }),
    orn('moon', 'moonCloud', at(135, 10, 120, 104), { color: 'secondary', animation: { motion: 'float' } }),
    text('eyebrow', t('template.schedule.title'), at(40, 142, 310, 18), { font: 'body', size: 10, weight: 600, color: 'muted', letterSpacing: 0.3, transform: 'upper' }),
    text('name', b('function.name'), at(24, 160, 342, 66), { font: 'script', size: 42, color: 'primary', lineHeight: 1.05 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 226, 302, 40), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'surface', iconCircle: 'primary', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'accent' }, at(40, 270, 310, 228), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(512, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary' }),
  ],
};

// ─────────────────────────── Shubh Griha: a home blessed ───────────────────────────

const grihaHeroMobile: ArtboardInput = {
  width: 390,
  height: 844,
  background: { type: 'gradient', gradient: { from: 'surface', to: 'background', angle: 180 } },
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    orn('medallion', 'medallion', at(-30, 220, 450, 450), { color: 'secondary', opacity: 0.1, animation: { motion: 'spin' } }),
    ...[
      [22, 210],
      [368, 210],
    ].map(([x, h], i) => orn(`strand-${i + 1}`, 'marigoldStrand', at(x! - 12, 40, 24, h!), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.06), motion: 'sway' } })),
    orn('toran', 'toran', at(-14, -10, 418, 112), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
    text('invocation', lit('॥ शुभ गृह प्रवेश ॥'), at(60, 104, 270, 26), { font: 'Tiro Devanagari Hindi', size: 17, color: 'primary' }, { animation: { entrance: 'fade', delaySec: 0.1 } }),
    text('eyebrow', t('template.joinUs'), at(40, 136, 310, 20), { font: 'body', size: 11, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper' }),
    text('names', TITLE, at(16, 156, 358, 96), { font: 'script', size: 44, color: 'primary', lineHeight: 1.08 }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    orn('house', 'house', at(55, 254, 280, 280), { shadow: 'soft', animation: { entrance: 'zoomIn', delaySec: 0.25 } }),
    orn('diyas', 'diyaRow', at(45, 528, 300, 83), { animation: { entrance: 'fadeUp', delaySec: 0.4 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(30, 622, 330, 26), { font: 'heading', size: 17, color: 'text' }, { animation: { entrance: 'fadeUp', delaySec: 0.45 } }),
    text('city', b('venue.city'), at(40, 650, 310, 20), { font: 'body', size: 11, weight: 600, color: 'muted', letterSpacing: 0.24, transform: 'upper' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 18, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(52, 682, 286, 60), { animation: { entrance: 'fadeUp', delaySec: 0.55 } }),
    orn('rangoli', 'rangoliBloom', at(110, 752, 170, 170), { color: 'secondary', animation: { entrance: 'zoomIn', delaySec: 0.5, motion: 'spin' } }),
  ],
};

const grihaHeroDesktop: ArtboardInput = {
  width: 1440,
  height: 900,
  background: { type: 'gradient', gradient: { from: 'surface', to: 'background', angle: 160 } },
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    orn('medallion', 'medallion', at(780, 80, 620, 620), { color: 'secondary', opacity: 0.1, animation: { motion: 'spin' } }),
    ...[0, 1, 2, 3].map((i) => orn(`toran-${i + 1}`, 'toran', at(-14 + i * 366, -12, 372, 112), { animation: { entrance: 'fadeDown', delaySec: sec(i * 0.08), motion: 'sway' } })),
    orn('house', 'house', at(840, 170, 480, 480), { shadow: 'soft', animation: { entrance: 'zoomIn', delaySec: 0.2 } }),
    orn('diyas', 'diyaRow', at(860, 650, 440, 121), { animation: { entrance: 'fadeUp', delaySec: 0.35 } }),
    orn('rangoli', 'rangoliBloom', at(-110, 600, 380, 380), { color: 'secondary', opacity: 0.95, animation: { motion: 'spin' } }),
    text('invocation', lit('॥ शुभ गृह प्रवेश ॥'), at(200, 200, 560, 34), { font: 'Tiro Devanagari Hindi', size: 24, color: 'primary', align: 'left' }),
    text('eyebrow', t('template.joinUs'), at(200, 244, 560, 26), { font: 'body', size: 15, weight: 700, color: 'accent', letterSpacing: 0.26, transform: 'upper', align: 'left' }),
    text('names', TITLE, at(190, 272, 620, 170), { font: 'script', size: 84, color: 'primary', lineHeight: 1.04, align: 'left' }, { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    text('date', b('event.startDate', { format: 'dateWithWeekday' }), at(200, 470, 560, 34), { font: 'heading', size: 24, color: 'text', align: 'left' }),
    text('city', b('venue.city'), at(200, 508, 560, 24), { font: 'body', size: 14, weight: 600, color: 'muted', letterSpacing: 0.24, transform: 'upper', align: 'left' }, { visibleWhen: { exists: 'venue.city' } }),
    widget('countdown', { type: 'countdown', variant: 'boxes', size: 28, color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' }, at(200, 560, 420, 96), { animation: { entrance: 'fadeUp', delaySec: 0.5 } }),
  ],
};

const grihaCard: ArtboardInput = {
  width: 390,
  height: 600,
  background: { type: 'color', color: 'surface' },
  texture: 'paper',
  textureStrength: 0.5,
  layers: [
    orn('toran', 'toran', at(-14, -8, 418, 112), { animation: { entrance: 'fadeDown', motion: 'sway' } }),
    orn('kalash', 'kalash', at(171, 92, 48, 62), { animation: { entrance: 'zoomIn' } }),
    text('eyebrow', t('template.schedule.title'), at(40, 158, 310, 18), { font: 'body', size: 10, weight: 700, color: 'accent', letterSpacing: 0.3, transform: 'upper' }),
    text('name', b('function.name'), at(24, 176, 342, 60), { font: 'script', size: 38, color: 'primary', lineHeight: 1.08 }, { animation: { entrance: 'fadeUp', delaySec: 0.1 } }),
    text('description', b('function.description'), at(44, 236, 302, 36), { font: 'body', size: 13, color: 'muted', lineHeight: 1.4 }, { overflow: 'clip', visibleWhen: { exists: 'function.description' } }),
    widget('details', { type: 'details', rows: ['date', 'time', 'venue', 'address'], icons: true, iconColor: 'surface', iconCircle: 'primary', labelColor: 'muted', valueColor: 'text', labelSize: 9, valueSize: 15, font: 'body', dividers: true, dividerColor: 'secondary' }, at(40, 276, 310, 228), { animation: { entrance: 'fadeUp', delaySec: 0.2 } }),
    ...cardButtons(518, 40, 310, { fill: 'primary', color: 'surface', outline: 'primary', radius: 12 }),
  ],
};

// ─────────────────────────── The collection ───────────────────────────

const COUPLE_SLOTS: CanvasSpec['slots'] = ['tagline', 'story', 'partnerOneParents', 'partnerTwoParents', 'hashtag', 'closing'];
const COUPLE_PHOTOS: CanvasSpec['photoSlots'] = ['cover', 'partnerOne', 'partnerTwo', 'story', 'closing'];
const coupleMiddle = (couple: string, story: string, gallery: string): CanvasSpec['middle'] => [
  { id: 'couple', section: 'couple', variant: couple, props: { partnerOneParents: b('custom.partnerOneParents'), partnerTwoParents: b('custom.partnerTwoParents') } },
  { id: 'story', section: 'story', variant: story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
  { id: 'gallery', section: 'gallery', variant: gallery },
];
const HONOREE_SLOTS: CanvasSpec['slots'] = ['tagline', 'about', 'hashtag', 'closing'];
const HONOREE_PHOTOS: CanvasSpec['photoSlots'] = ['cover', 'story', 'closing'];
const honoreeMiddle = (story: string, gallery: string): CanvasSpec['middle'] => [
  { id: 'about', section: 'story', variant: story, props: { text: b('custom.about'), image: b('photo.story', { fallback: b('photos[1]') }) } },
  { id: 'gallery', section: 'gallery', variant: gallery },
];

export const CARD_SPECS: CanvasSpec[] = [
  {
    key: 'shahi-gajraj-card',
    name: 'Shahi Gajraj',
    description:
      'A royal Rajasthani card on paper stock: your photo in a gilded jharokha guarded by two caparisoned elephants, a marigold toran with lanterns, names in shimmering gold foil and a framed card for every function.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'hindu', 'rajasthani', 'royal', 'heritage'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#5c0f1f', '#c9973f', '#f3d9a4', '#fbf4ea', '#fffaf2', '#2b1712', '#7a5d52'),
    presets: [
      { name: 'Maroon & Gold', colors: palette('#5c0f1f', '#c9973f', '#f3d9a4', '#fbf4ea', '#fffaf2', '#2b1712', '#7a5d52') },
      { name: 'Emerald Durbar', colors: palette('#0f3d2e', '#c9a24a', '#ecdcae', '#f6f3e9', '#fffdf6', '#122019', '#5f6f66') },
      { name: 'Royal Indigo', colors: palette('#1e2457', '#d1a54a', '#f0dca8', '#f6f5f1', '#ffffff', '#141833', '#5d6380') },
    ],
    fonts: 'regal',
    look: 'royal',
    effect: 'goldDust',
    intro: 'doors',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: gajrajHeroMobile, desktop: gajrajHeroDesktop },
    card: { mobile: gajrajCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('arch', 'polaroid', 'mosaic'),
  },
  {
    key: 'mor-pankh-card',
    name: 'Mor Pankh',
    description:
      'A peacock garden in watercolour: a royal peacock trailing its jewelled train below your photo in a gilded arch, paisley corners, names in flowing script, a live countdown and a card for every function.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'hindu', 'peacock', 'garden', 'romantic'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#0d4f4c', '#c9a24a', '#1f8a7a', '#f7f2e7', '#ffffff', '#15302d', '#5c726e'),
    presets: [
      { name: 'Peacock Teal', colors: palette('#0d4f4c', '#c9a24a', '#1f8a7a', '#f7f2e7', '#ffffff', '#15302d', '#5c726e') },
      { name: 'Peacock Blue', colors: palette('#1b3a7a', '#c9a24a', '#2a7fb0', '#f3f5fa', '#ffffff', '#141c33', '#5d6582') },
      { name: 'Jade Blush', colors: palette('#2f6b5a', '#c08a5c', '#d98f8c', '#fbf5f1', '#ffffff', '#20302b', '#6e7c76') },
    ],
    fonts: 'romantic',
    look: 'garden',
    effect: 'petals',
    intro: 'envelope',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: pankhHeroMobile, desktop: pankhHeroDesktop },
    card: { mobile: pankhCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('flip', 'curtain', 'mosaic'),
  },
  {
    key: 'kovil-mani-card',
    name: 'Kovil Mani',
    description:
      'A South Indian temple wedding card: brass temple bells and jasmine strings over a Kanjeevaram border, names in gold foil, a gopuram at dusk framed by banana leaves and a card for every function.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'hindu', 'south-indian', 'tamil', 'temple', 'heritage'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#7d1515', '#d4a017', '#f6e7c1', '#fff8ec', '#ffffff', '#2e120c', '#7a5a4a'),
    presets: [
      { name: 'Temple Red', colors: palette('#7d1515', '#d4a017', '#f6e7c1', '#fff8ec', '#ffffff', '#2e120c', '#7a5a4a') },
      { name: 'Mayil Green', colors: palette('#0f4d3a', '#d4a017', '#f1e5bf', '#f8f6ec', '#ffffff', '#11241c', '#5e6f64') },
      { name: 'Kanjeevaram Purple', colors: palette('#4a1658', '#d4a017', '#f2dfb3', '#fbf6f2', '#ffffff', '#261030', '#76647c') },
    ],
    fonts: 'grand',
    look: 'heritage',
    effect: 'marigold',
    intro: 'doors',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: kovilHeroMobile, desktop: kovilHeroDesktop },
    card: { mobile: kovilCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('stacked', 'polaroid', 'polaroid'),
  },
  {
    key: 'mehendi-rang-card',
    name: 'Mehendi Rang',
    description:
      'A mehendi afternoon in colour: marigold strings and a toran, a hand painted with henna, paisleys, a spinning rangoli and a bright RSVP button, with a card for every function.',
    category: 'Mehendi',
    style: 'Canvas',
    tier: 'STANDARD',
    badge: 'NEW',
    tags: ['canvas', 'mehendi', 'hindu', 'festive', 'colourful'],
    eventTypes: ['WEDDING'],
    colors: palette('#2f5d1e', '#e8a33d', '#d9532b', '#fbf4df', '#fffaf0', '#2a2414', '#6b6a4a'),
    presets: [
      { name: 'Henna Green', colors: palette('#2f5d1e', '#e8a33d', '#d9532b', '#fbf4df', '#fffaf0', '#2a2414', '#6b6a4a') },
      { name: 'Rani Pink', colors: palette('#a3195b', '#f2a93b', '#e0662f', '#fff3f6', '#ffffff', '#2e1220', '#7d5a68') },
      { name: 'Lime & Turmeric', colors: palette('#4d6b12', '#f0b429', '#c2410c', '#fbfbe4', '#ffffff', '#262a12', '#6a6e4a') },
    ],
    fonts: 'desi',
    look: 'celebration',
    effect: 'marigold',
    intro: 'petals',
    slots: HONOREE_SLOTS,
    photoSlots: HONOREE_PHOTOS,
    hero: { mobile: rangHeroMobile, desktop: rangHeroDesktop },
    card: { mobile: rangCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: honoreeMiddle('polaroid', 'polaroid'),
  },
  {
    key: 'noor-mahal-card',
    name: 'Noor Mahal',
    description:
      'A night under the stars: glowing lanterns, a crescent moon and a turning arabesque around your photo, names in gold foil and a skyline of domes, with a gilded card for every function.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'PREMIUM',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'muslim', 'nikah', 'walima', 'royal', 'night'],
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    colors: palette('#0b3d2e', '#c9a227', '#f1e3b0', '#f7f4ea', '#fffdf5', '#0e1f18', '#5b6f65'),
    presets: [
      { name: 'Emerald Night', colors: palette('#0b3d2e', '#c9a227', '#f1e3b0', '#f7f4ea', '#fffdf5', '#0e1f18', '#5b6f65') },
      { name: 'Midnight Blue', colors: palette('#13285c', '#cfa63a', '#efe0b2', '#f4f5f9', '#ffffff', '#0c1430', '#5a6383') },
      { name: 'Plum & Gold', colors: palette('#4b1840', '#cda23e', '#f0deb4', '#faf5f8', '#ffffff', '#230b1f', '#77627a') },
    ],
    fonts: 'elegant',
    look: 'royal',
    effect: 'lanterns',
    intro: 'lanterns',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: noorHeroMobile, desktop: noorHeroDesktop },
    card: { mobile: noorCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('arch', 'curtain', 'mosaic'),
  },
  {
    key: 'eternal-bloom-card',
    name: 'Eternal Bloom',
    description:
      'Garden roses in soft watercolour: blooms falling from the corners, your photo in an oval frame, a pair of doves and names in classic script, with a garlanded card for every function.',
    category: 'Wedding',
    style: 'Canvas',
    tier: 'STANDARD',
    badge: 'NEW',
    tags: ['canvas', 'floral', 'romantic', 'christian', 'garden', 'classic'],
    eventTypes: ['WEDDING', 'ENGAGEMENT', 'ANNIVERSARY'],
    colors: palette('#8c3b4a', '#a88a5a', '#f2c4cc', '#fbf7f2', '#ffffff', '#3a2a2c', '#857174'),
    presets: [
      { name: 'Blush Rose', colors: palette('#8c3b4a', '#a88a5a', '#f2c4cc', '#fbf7f2', '#ffffff', '#3a2a2c', '#857174') },
      { name: 'Sage Garden', colors: palette('#4f6b52', '#b0915c', '#d8e4d3', '#f7f8f2', '#ffffff', '#232d24', '#6b776c') },
      { name: 'Dusty Blue', colors: palette('#3f5b7a', '#b39a6b', '#cfdcea', '#f5f7fa', '#ffffff', '#1f2a36', '#677585') },
    ],
    fonts: 'classic',
    look: 'garden',
    effect: 'petals',
    intro: 'envelope',
    slots: COUPLE_SLOTS,
    photoSlots: COUPLE_PHOTOS,
    hero: { mobile: bloomHeroMobile, desktop: bloomHeroDesktop },
    card: { mobile: bloomCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: coupleMiddle('profile', 'polaroid', 'stack'),
  },
  {
    key: 'cake-candles-card',
    name: 'Cake & Candles',
    description:
      'A party on a card: bunting and balloon bunches, the birthday star in a round photo, a tiered cake with candles, presents and a big RSVP button, then a bright card for every part of the day.',
    category: 'Birthday',
    style: 'Canvas',
    tier: 'FREE',
    badge: 'NEW',
    featured: true,
    tags: ['canvas', 'party', 'kids', 'playful', 'colourful'],
    eventTypes: ['BIRTHDAY', 'ANNIVERSARY', 'RETIREMENT'],
    colors: palette('#ef476f', '#ffd166', '#118ab2', '#fff8ee', '#ffffff', '#1d1b3a', '#6b6880'),
    presets: [
      { name: 'Party Pop', colors: palette('#ef476f', '#ffd166', '#118ab2', '#fff8ee', '#ffffff', '#1d1b3a', '#6b6880') },
      { name: 'Jungle Fun', colors: palette('#2d6a4f', '#f4a261', '#e76f51', '#f6fbf3', '#ffffff', '#1b2a22', '#5f7268') },
      { name: 'Royal Party', colors: palette('#5a189a', '#ffb703', '#ff006e', '#faf6ff', '#ffffff', '#1f0d33', '#6d5e80') },
    ],
    fonts: 'modern',
    look: 'celebration',
    effect: 'confetti',
    slots: HONOREE_SLOTS,
    photoSlots: HONOREE_PHOTOS,
    hero: { mobile: partyHeroMobile, desktop: partyHeroDesktop },
    card: { mobile: partyCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: honoreeMiddle('polaroid', 'polaroid'),
  },
  {
    key: 'twinkle-star-card',
    name: 'Twinkle Star',
    description:
      'A lullaby of a card for the newest arrival: a sleepy moon on a cloud, twinkling stars, a round photo, pastel balloons and a countdown, with a starry card for every function.',
    category: 'Baby Shower',
    style: 'Canvas',
    tier: 'FREE',
    badge: 'NEW',
    tags: ['canvas', 'baby', 'pastel', 'kids', 'dreamy'],
    eventTypes: ['BABY_SHOWER', 'NAMING_CEREMONY'],
    colors: palette('#4f5d9e', '#f2c96b', '#f6b8c8', '#f3f5ff', '#ffffff', '#262b4d', '#6b7196'),
    presets: [
      { name: 'Lullaby Blue', colors: palette('#4f5d9e', '#f2c96b', '#f6b8c8', '#f3f5ff', '#ffffff', '#262b4d', '#6b7196') },
      { name: 'Pink Dream', colors: palette('#b04a78', '#f2c96b', '#f9c6d6', '#fff5f8', '#ffffff', '#3a1a2a', '#85677a') },
      { name: 'Mint Cloud', colors: palette('#2f7a6b', '#f2c96b', '#bfe8dc', '#f2fbf8', '#ffffff', '#183530', '#5f7a74') },
    ],
    fonts: 'elegant',
    look: 'garden',
    effect: 'none',
    intro: 'celestial',
    slots: HONOREE_SLOTS,
    photoSlots: HONOREE_PHOTOS,
    hero: { mobile: twinkleHeroMobile, desktop: twinkleHeroDesktop },
    card: { mobile: twinkleCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: honoreeMiddle('polaroid', 'stack'),
  },
  {
    key: 'shubh-griha-card',
    name: 'Shubh Griha',
    description:
      'A home blessed for the first time: a marigold toran over the doorway, a house glowing with lamps, a row of diyas and a rangoli at the threshold, with a card for the puja and every function.',
    category: 'Housewarming',
    style: 'Canvas',
    tier: 'FREE',
    badge: 'NEW',
    tags: ['canvas', 'hindu', 'griha-pravesh', 'puja', 'festive'],
    eventTypes: ['HOUSEWARMING', 'RELIGIOUS'],
    colors: palette('#8a2c1d', '#e2a23b', '#2f6b3f', '#fff7ea', '#fffdf7', '#2f1d14', '#76604f'),
    presets: [
      { name: 'Sindoor & Marigold', colors: palette('#8a2c1d', '#e2a23b', '#2f6b3f', '#fff7ea', '#fffdf7', '#2f1d14', '#76604f') },
      { name: 'Tulsi Green', colors: palette('#2f5d34', '#e0a83a', '#b5452c', '#f8f8ec', '#ffffff', '#1d2a1e', '#66705f') },
      { name: 'Haldi Yellow', colors: palette('#7a3e0e', '#f2b705', '#c0392b', '#fffbe6', '#ffffff', '#2e1e0b', '#7a6a4f') },
    ],
    fonts: 'desi',
    look: 'heritage',
    effect: 'marigold',
    slots: HONOREE_SLOTS,
    photoSlots: HONOREE_PHOTOS,
    hero: { mobile: grihaHeroMobile, desktop: grihaHeroDesktop },
    card: { mobile: grihaCard, desktopMaxWidth: 520, repeatPerFunction: true },
    middle: honoreeMiddle('curtain', 'mosaic'),
  },
];
