import { DARK_SCENE_NAMES, type SceneNameValue, type Value } from './base';
import { ArtboardSchema, CANVAS_SCENES, ORNAMENT_LAYERS, type Artboard, type ArtboardInput, type LayerInput, type OrnamentLayerName } from './canvas';
import { ADDED_SECTION_WIDTH } from './canvas-custom';
import type { SectionInstance, TemplateDefinition } from './definition';

/**
 * A template's own sections as canvas boards to start from (ADR-060): what the
 * invitation's canvas editor offers as "Redraw on the canvas". A board keeps
 * the section's words (its own values, so the host's details still fill them),
 * its photo spots and its look (the template's scene, ornament, pattern and
 * colours), laid out as layers the host can then move and restyle. Sections
 * that work on their own (gallery, RSVP, map, photo sharing, announcements and
 * the footer) are not redrawn: they stay the template's.
 */

const W = ADDED_SECTION_WIDTH;

export const REDRAWABLE_SECTIONS = ['hero', 'couple', 'parents', 'family', 'story', 'quote', 'countdown', 'venue', 'eventTimeline', 'accommodation', 'travel', 'giftRegistry', 'menu'] as const;

export const canRedraw = (section: Pick<SectionInstance, 'section'>): boolean => (REDRAWABLE_SECTIONS as readonly string[]).includes(section.section);

export interface SectionBoard {
  board: Artboard;
  /** The board is drawn once per function (a redrawn timeline). */
  perFunction: boolean;
}

type Def = Pick<TemplateDefinition, 'theme' | 'artworks'>;

/** How each scene hero sets the names, as the website hero does (template-engine sections/hero.tsx). */
const SCENE_NAME_STYLE: Partial<Record<SceneNameValue, NameStyle>> = {
  gopuram: 'caps',
  toran: 'caps',
  mandap: 'caps',
  sarovar: 'caps',
  balloons: 'caps',
  noir: 'italic',
};
/** Where a scene's sky leaves room for the words, as a fraction of the height (below torans, drapes and flower arches). */
const SCENE_TEXT_TOP: Partial<Record<SceneNameValue, number>> = { toran: 0.3, mandap: 0.34, floral: 0.3 };

type NameStyle = 'script' | 'caps' | 'italic' | 'heading';

interface Line {
  h: number;
  gap: number;
  layer: (y: number) => LayerInput;
}

const stackHeight = (lines: Line[]) => lines.reduce((sum, l, i) => sum + l.h + (i ? l.gap : 0), 0);

function stack(lines: Line[], top: number): LayerInput[] {
  let y = top;
  return lines.map((l, i) => {
    if (i) y += l.gap;
    const layer = l.layer(Math.round(y));
    y += l.h;
    return layer;
  });
}

const text = (id: string, frame: { x?: number; y: number; w?: number; h: number }, content: Value, style: Record<string, unknown>, overflow: 'shrink' | 'wrap' = 'shrink'): LayerInput => ({
  id,
  kind: 'text',
  frame: { x: frame.x ?? 30, y: frame.y, w: frame.w ?? W - 60, h: frame.h },
  content,
  style: { align: 'center', ...style },
  overflow,
});

const hairline = (id: string, y: number, color: string): LayerInput => ({ id, kind: 'shape', shape: 'rect', fill: { type: 'color', color }, opacity: 0.6, frame: { x: 115, y, w: 160, h: 1 } });

const heading = (id: string, y: number, content: Value, color = 'primary'): LayerInput => text(id, { y, h: 56 }, content, { font: 'script', size: 36, color });

const prop = (s: SectionInstance, key: string): Value | undefined => s.props[key];

/** A photo spot the section names (photo.*, photos[n]), else the given one. */
function photoBinding(value: Value | undefined, fallback: string): string {
  if (value && 'binding' in value && /^(photo\.\w+|photos\[\d+\])$/.test(value.binding)) return value.binding;
  return fallback;
}

/** "A & B" with the ampersand on a line of its own, as the hero's names are set (a fallback keeps its own words). */
function stacked(value: Value): Value {
  if ('template' in value) return { ...value, template: value.template.replace(/\s+&\s+/g, '\n&\n') };
  if ('literal' in value && typeof value.literal === 'string') return { literal: value.literal.replace(/\s+&\s+/g, '\n&\n') };
  return value;
}

/** The names as the hero writes them: one above the other with an ampersand between, else the honoree's name or the title. */
function namesValue(title: Value | undefined): Value {
  const fromEvent = !title || ('binding' in title && title.binding === 'event.title');
  return fromEvent ? { template: '{{couple.partnerOne}}\n&\n{{couple.partnerTwo}}', fallback: { binding: 'honoree.name', fallback: { binding: 'event.title' } } } : stacked(title);
}

function namesLine(style: NameStyle, color: string, title: Value | undefined, shadow: string): Line {
  const content = namesValue(title);
  const styles: Record<NameStyle, { h: number; style: Record<string, unknown> }> = {
    script: { h: 156, style: { font: 'script', size: 48, lineHeight: 1.04 } },
    caps: { h: 132, style: { font: 'heading', size: 30, letterSpacing: 0.12, transform: 'upper', lineHeight: 1.2 } },
    italic: { h: 150, style: { font: 'heading', size: 44, italic: true, lineHeight: 1.06 } },
    heading: { h: 144, style: { font: 'heading', size: 42, lineHeight: 1.06 } },
  };
  const pick = styles[style];
  return { h: pick.h, gap: 12, layer: (y) => text('names', { y, h: pick.h }, content, { ...pick.style, color, shadow }) };
}

/** The hero: its scene (or ornament, pattern or photo) with the words over it. */
function heroBoard(def: Def, s: SectionInstance): Artboard {
  const variant = s.variant;
  const scene = (CANVAS_SCENES as readonly string[]).includes(variant) ? (variant as SceneNameValue) : null;
  const artworkKey = variant === 'artwork' ? prop(s, 'artwork') : undefined;
  const artwork = artworkKey && 'literal' in artworkKey ? def.artworks?.[String(artworkKey.literal)] : undefined;
  const inverse = variant === 'photo';
  const dark = scene ? DARK_SCENE_NAMES.includes(scene) : artwork ? artwork.dark : variant === 'celestial' || variant === 'lantern' || (def.theme.heroTone === 'dark' && !inverse);
  // A phone's screen, as the website's hero fills it: the words in the sky, the art below them.
  const H = scene ? 844 : inverse ? 720 : 700;

  const ink = inverse ? '#ffffff' : dark ? 'background' : 'text';
  const accent = inverse ? '#ffffff' : dark ? 'accent' : 'secondary';
  const namesColor = inverse ? '#ffffff' : dark ? 'accent' : 'primary';
  const shadow = scene || inverse ? 'soft' : 'none';
  const styleProp = prop(s, 'nameStyle');
  const chosen = styleProp && 'literal' in styleProp ? String(styleProp.literal) : '';
  const nameStyle: NameStyle = scene ? (SCENE_NAME_STYLE[scene] ?? 'script') : variant === 'minimal' ? 'heading' : chosen === 'caps' || chosen === 'italic' ? chosen : 'script';

  const lines: Line[] = [];
  const add = (key: string, line: (content: Value) => Line) => {
    const v = prop(s, key);
    if (v) lines.push(line(v));
  };
  add('invocation', (v) => ({ h: 26, gap: 0, layer: (y) => text('invocation', { y, h: 26 }, v, { font: 'body', size: 14, color: accent, shadow }) }));
  add('eyebrow', (v) => ({ h: 22, gap: 12, layer: (y) => text('eyebrow', { y, h: 22 }, v, { font: 'body', size: 11, weight: 600, letterSpacing: 0.32, transform: 'upper', color: accent, shadow }) }));
  lines.push(namesLine(nameStyle, namesColor, prop(s, 'title'), shadow));
  add('subtitle', (v) => ({ h: 44, gap: 12, layer: (y) => text('subtitle', { x: 45, y, w: W - 90, h: 44 }, v, { font: 'body', size: 14, color: ink, lineHeight: 1.45, shadow }, 'wrap') }));
  add('date', (v) => ({ h: 30, gap: 18, layer: (y) => text('date', { y, h: 30 }, v, { font: 'heading', size: 18, letterSpacing: 0.04, color: ink, shadow }) }));
  add('place', (v) => ({ h: 20, gap: 8, layer: (y) => text('place', { y, h: 20 }, v, { font: 'body', size: 11, letterSpacing: 0.2, transform: 'upper', color: ink, shadow }) }));
  add('tagline', (v) => ({ h: 36, gap: 12, layer: (y) => text('tagline', { y, h: 36 }, v, { font: 'script', size: 24, color: accent, shadow }) }));

  const tall = stackHeight(lines);
  // Scenes: the words start below a toran or drape and end before the art (the top ~55%).
  const top = scene
    ? Math.max(40, Math.min(Math.round(H * (SCENE_TEXT_TOP[scene] ?? 0.12)), Math.round(H * 0.56) - tall))
    : inverse
      ? H - 64 - tall
      : variant === 'split'
        ? 356
        : variant === 'monogram'
          ? 250
          : variant === 'cathedral'
            ? 190
            : Math.max(60, Math.round((H - tall) / 2));
  const words = stack(lines, top);
  // The date sits between two fine rules, as on the website.
  const date = words.find((l) => l.id === 'date');
  const rules = date ? [hairline('date-rule-top', date.frame.y - 6, accent), hairline('date-rule-bottom', date.frame.y + date.frame.h + 5, accent)] : [];

  const orn = dark ? 'accent' : 'secondary';
  const pattern = def.theme.pattern;
  const plain: ArtboardInput['background'] = { type: 'color', color: dark ? 'primary' : 'background' };
  let background: ArtboardInput['background'] = pattern && pattern !== 'none' ? { type: 'pattern', pattern, color: orn, base: dark ? 'primary' : 'background', strength: 0.12 } : plain;
  const art: LayerInput[] = [];
  const ornament = (id: string, name: OrnamentLayerName, frame: { x: number; y: number; w: number; h: number; rotate?: number }, extra: Record<string, unknown> = {}): LayerInput => ({ id, kind: 'ornament', ornament: name, color: orn, frame, ...extra });

  if (scene) {
    background = plain;
    art.push({ id: 'scene', kind: 'scene', scene: scene as (typeof CANVAS_SCENES)[number], sky: true, frame: { x: 0, y: 0, w: W, h: H } });
  } else {
    switch (variant) {
      case 'arch':
        art.push(ornament('mandala', 'mandala', { x: -10, y: -170, w: 410, h: 410 }, { opacity: dark ? 0.18 : 0.13 }), ornament('arch', 'archFrame', { x: 38, y: 50, w: 314, h: 600 }));
        break;
      case 'temple':
        art.push(ornament('border-top', 'templeBorder', { x: 20, y: 24, w: 350, h: 32 }), ornament('border-bottom', 'templeBorder', { x: 20, y: H - 56, w: 350, h: 32 }, { flipY: true }));
        break;
      case 'monogram':
        art.push(
          ornament('crest', 'crest', { x: 115, y: 40, w: 160, h: 190 }),
          text('monogram', { x: 115, y: 92, w: 160, h: 70 }, { template: '{{couple.partnerOne|initial}} {{couple.partnerTwo|initial}}', fallback: { binding: 'event.title', format: 'initial' } }, { font: 'heading', size: 44, letterSpacing: 0.1, color: dark ? 'accent' : 'primary' }),
        );
        break;
      case 'cathedral':
        art.push(ornament('arch', 'gothicArch', { x: 38, y: 30, w: 314, h: 630 }), ornament('rose', 'roseWindow', { x: 155, y: 74, w: 80, h: 80 }, { animation: { motion: 'spin' } }));
        break;
      case 'seaside':
        background = { type: 'gradient', gradient: { kind: 'linear', from: 'surface', via: 'background', to: 'accent', angle: 180 } };
        art.push(ornament('waves', 'seaWaves', { x: -20, y: H - 150, w: W + 40, h: 150 }, { color: 'secondary' }));
        break;
      case 'celestial':
        background = { type: 'gradient', gradient: { kind: 'linear', from: 'primary', to: '#05060f', angle: 180 } };
        art.push(ornament('stars', 'sparkles', { x: 0, y: 0, w: W, h: 420 }, { color: 'accent', opacity: 0.7, animation: { motion: 'twinkle' } }), ornament('moon', 'crescent', { x: 300, y: 40, w: 56, h: 56 }, { color: 'accent' }));
        break;
      case 'lantern':
        background = { type: 'gradient', gradient: { kind: 'linear', from: '#070a1a', to: 'primary', angle: 180 } };
        [60, 170, 280].forEach((x, i) => art.push(ornament(`lantern-${i}`, 'lantern', { x, y: [16, 48, 24][i]!, w: 50, h: 90 }, { color: 'secondary', animation: { motion: 'sway' } })));
        break;
      case 'peacock':
        art.push(
          ornament('feather-left', 'peacockFeather', { x: -24, y: -12, w: 120, h: 300, rotate: -32 }, { color: 'secondary', opacity: 0.7 }),
          ornament('feather-right', 'peacockFeather', { x: 294, y: -12, w: 120, h: 300, rotate: 32 }, { color: 'secondary', opacity: 0.7, flipX: true }),
        );
        break;
      case 'festive':
        art.push(ornament('sparkles-top', 'sparkles', { x: 20, y: 20, w: 350, h: 150 }, { color: 'accent' }), ornament('sparkles-bottom', 'sparkles', { x: 20, y: H - 170, w: 350, h: 150 }, { color: 'accent', flipY: true }));
        break;
      case 'photo':
        background = { type: 'gradient', gradient: { kind: 'radial', from: 'secondary', to: 'primary' } };
        art.push(
          { id: 'photo', kind: 'image', source: { type: 'binding', binding: photoBinding(prop(s, 'image'), 'photo.cover') }, fit: 'cover', frame: { x: 0, y: 0, w: W, h: H }, alt: '' },
          { id: 'shade', kind: 'shape', shape: 'rect', fill: { type: 'gradient', gradient: { kind: 'linear', from: '#0000001a', via: '#0000004d', to: '#000000bf', angle: 180 } }, frame: { x: 0, y: 0, w: W, h: H } },
        );
        break;
      case 'split':
        art.push({ id: 'photo', kind: 'image', source: { type: 'binding', binding: photoBinding(prop(s, 'image'), 'photo.cover') }, fit: 'cover', mask: 'arch', border: { width: 4, color: 'secondary' }, frame: { x: 85, y: 40, w: 220, h: 290 }, alt: '' });
        break;
      case 'minimal':
        background = dark ? background : { type: 'color', color: 'background' };
        art.push(hairline('rule-top', Math.max(30, top - 30), orn), hairline('rule-bottom', Math.min(H - 30, top + tall + 30), orn));
        break;
      default: {
        const name = (ORNAMENT_LAYERS as readonly string[]).includes(def.theme.ornament) && def.theme.ornament !== 'none' ? (def.theme.ornament as OrnamentLayerName) : 'mandala';
        art.push(ornament('ornament', name, { x: -25, y: Math.round(H / 2 - 220), w: 440, h: 440 }, { opacity: dark ? 0.2 : 0.12 }));
      }
    }
  }
  return ArtboardSchema.parse({ width: W, height: H, background, layers: [...art, ...rules, ...words] });
}

const flourish = (y: number, color = 'secondary'): LayerInput => ({ id: 'flourish', kind: 'ornament', ornament: 'flourish', color, frame: { x: 125, y, w: 140, h: 36 } });

/** The couple: both photos, both names, the parents' lines. */
function coupleBoard(s: SectionInstance): Artboard {
  const photo = (id: string, binding: string, x: number): LayerInput => ({ id, kind: 'image', source: { type: 'binding', binding }, fit: 'cover', mask: 'circle', border: { width: 3, color: 'secondary' }, frame: { x, y: 116, w: 140, h: 140 }, alt: '' });
  const layers: LayerInput[] = [
    heading('heading', 34, prop(s, 'heading') ?? { t: 'template.couple.title' }),
    photo('photo-one', 'photo.partnerOne', 40),
    photo('photo-two', 'photo.partnerTwo', 210),
    text('ampersand', { x: 165, y: 160, w: 60, h: 52 }, { literal: '&' }, { font: 'script', size: 40, color: 'secondary' }),
    text('name-one', { x: 16, y: 274, w: 188, h: 36 }, { binding: 'couple.partnerOne' }, { font: 'heading', size: 22, color: 'primary' }),
    text('name-two', { x: 186, y: 274, w: 188, h: 36 }, { binding: 'couple.partnerTwo' }, { font: 'heading', size: 22, color: 'primary' }),
  ];
  const parents = (id: string, key: string, x: number) => {
    const v = prop(s, key);
    if (v) layers.push(text(id, { x, y: 316, w: 172, h: 76 }, v, { font: 'body', size: 12, color: 'muted', lineHeight: 1.45 }, 'wrap'));
  };
  parents('parents-one', 'partnerOneParents', 24);
  parents('parents-two', 'partnerTwoParents', 194);
  return ArtboardSchema.parse({ width: W, height: 440, background: { type: 'color', color: 'background' }, layers });
}

/** Words: a heading and its text (family, travel, stay, gifts, the menu). */
function wordsBoard(s: SectionInstance, defaultHeading: string): Artboard {
  const body = prop(s, 'text');
  const layers: LayerInput[] = [flourish(30), heading('heading', 76, prop(s, 'heading') ?? { t: defaultHeading })];
  if (body) layers.push(text('text', { y: 148, h: 220 }, body, { font: 'body', size: 15, color: 'text', lineHeight: 1.6 }, 'wrap'));
  return ArtboardSchema.parse({ width: W, height: body ? 400 : 160, background: { type: 'color', color: 'surface' }, layers });
}

function storyBoard(s: SectionInstance): Artboard {
  const body = prop(s, 'text');
  const layers: LayerInput[] = [
    heading('heading', 34, prop(s, 'heading') ?? { t: 'template.story.title' }),
    { id: 'photo', kind: 'image', source: { type: 'binding', binding: photoBinding(prop(s, 'image'), 'photo.story') }, fit: 'cover', mask: 'rounded', radius: 18, frame: { x: 45, y: 108, w: 300, h: 220 }, alt: '' },
  ];
  if (body) layers.push(text('text', { y: 350, h: 240 }, body, { font: 'body', size: 15, color: 'text', lineHeight: 1.6 }, 'wrap'));
  return ArtboardSchema.parse({ width: W, height: body ? 620 : 360, background: { type: 'color', color: 'background' }, layers });
}

function quoteBoard(s: SectionInstance): Artboard {
  const layers: LayerInput[] = [flourish(36), text('quote', { x: 36, y: 90, w: W - 72, h: 170 }, prop(s, 'text') ?? { literal: '' }, { font: 'heading', size: 22, italic: true, color: 'primary', lineHeight: 1.45 }, 'wrap')];
  const by = prop(s, 'by');
  if (by) layers.push(text('by', { y: 276, h: 28 }, by, { font: 'body', size: 13, letterSpacing: 0.08, color: 'muted' }));
  return ArtboardSchema.parse({ width: W, height: 340, background: { type: 'color', color: 'surface' }, layers });
}

function countdownBoard(s: SectionInstance): Artboard {
  const layers: LayerInput[] = [];
  const eyebrow = prop(s, 'eyebrow');
  if (eyebrow) layers.push(text('eyebrow', { y: 40, h: 22 }, eyebrow, { font: 'body', size: 11, weight: 600, letterSpacing: 0.3, transform: 'upper', color: 'secondary' }));
  layers.push(heading('heading', 66, prop(s, 'heading') ?? { t: 'template.countdown.title' }));
  layers.push({ id: 'countdown', kind: 'widget', widget: { type: 'countdown', variant: s.variant === 'flip' ? 'flip' : 'boxes', color: 'primary', labelColor: 'muted', boxColor: 'surface', size: 28, font: 'heading' }, frame: { x: 25, y: 148, w: 340, h: 110 } });
  return ArtboardSchema.parse({ width: W, height: 300, background: { type: 'color', color: 'background' }, layers });
}

const directions = (y: number): LayerInput => ({ id: 'directions', kind: 'widget', widget: { type: 'button', label: { t: 'template.getDirections' }, action: 'directions', icon: 'navigation' }, frame: { x: 95, y, w: 200, h: 48 } });

function venueBoard(s: SectionInstance): Artboard {
  return ArtboardSchema.parse({
    width: W,
    height: 400,
    background: { type: 'color', color: 'surface' },
    layers: [
      heading('heading', 34, prop(s, 'heading') ?? { t: 'template.venue.title' }),
      { id: 'pin', kind: 'icon', icon: 'pin', color: 'primary', frame: { x: 177, y: 102, w: 36, h: 36 } },
      text('venue', { y: 148, h: 36 }, { binding: 'venue.name' }, { font: 'heading', size: 22, color: 'primary' }),
      text('address', { x: 40, y: 190, w: W - 80, h: 90 }, { binding: 'venue.address' }, { font: 'body', size: 14, color: 'muted', lineHeight: 1.5 }, 'wrap'),
      directions(310),
    ],
  });
}

/** The timeline as a card per function: its name, date, time and venue, and the way there. */
function timelineBoard(): Artboard {
  return ArtboardSchema.parse({
    width: W,
    height: 400,
    background: { type: 'color', color: 'background' },
    layers: [
      text('function', { y: 34, h: 56 }, { binding: 'function.name' }, { font: 'script', size: 36, color: 'primary' }),
      { id: 'details', kind: 'widget', widget: { type: 'details', rows: ['date', 'time', 'venue'], icons: true, iconColor: 'primary', labelColor: 'muted', valueColor: 'text', dividers: true }, frame: { x: 40, y: 108, w: 310, h: 172 } },
      directions(306),
    ],
  });
}

const INFO_HEADINGS: Record<string, string> = {
  family: 'template.family.title',
  parents: 'template.family.title',
  accommodation: 'template.accommodation.title',
  travel: 'template.travel.title',
  giftRegistry: 'template.gift.title',
  menu: 'template.menu.title',
};

/** A template section as a canvas board to start from, or null when it is not redrawn. */
export function sectionBoard(definition: Def, section: SectionInstance): SectionBoard | null {
  switch (section.section) {
    case 'hero':
      return { board: heroBoard(definition, section), perFunction: false };
    case 'couple':
      return { board: coupleBoard(section), perFunction: false };
    case 'story':
      return { board: storyBoard(section), perFunction: false };
    case 'quote':
      return { board: quoteBoard(section), perFunction: false };
    case 'countdown':
      return { board: countdownBoard(section), perFunction: false };
    case 'venue':
      return { board: venueBoard(section), perFunction: false };
    case 'eventTimeline':
      return { board: timelineBoard(), perFunction: true };
    case 'family':
    case 'parents':
    case 'accommodation':
    case 'travel':
    case 'giftRegistry':
    case 'menu':
      return { board: wordsBoard(section, INFO_HEADINGS[section.section]!), perFunction: false };
    default:
      return null;
  }
}
