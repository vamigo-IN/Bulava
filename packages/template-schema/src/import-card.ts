import { z } from 'zod';
import { FONT_FAMILIES, type FontFamily, type Value } from './base';
import type { ArtboardInput, ColorRef, LayerInput, OrnamentLayerName, PaletteKey } from './canvas';
import type { TemplateDefinitionInput, ThemeColors } from './definition';

/**
 * Card JSON from outside Bulava (design tools, AI generators, agencies): a
 * canvas, a theme, sample data, image assets and a flat list of elements
 * (rect, circle, line, text, image, button). `importCardJson` turns it into a
 * Bulava canvas template, a website whose hero is the card and which every
 * digital card format can be made from. What Bulava cannot carry over is
 * reported: images that are not licensed assets are drawn with the engine's
 * own art where their name says what they are (a mandala, a floral border,
 * sparkles, a paper texture), and listed so staff can replace them.
 */

const num = z.coerce.number();
const loose = z.record(z.string(), z.unknown());

const ExternalFrameSchema = z.object({ x: num.default(0), y: num.default(0), w: num.default(0), h: num.default(0), rotate: num.optional() });

const ExternalElementSchema = z.object({
  id: z.string().max(120).optional(),
  kind: z.string().max(40),
  frame: ExternalFrameSchema,
  content: loose.optional(),
  style: loose.optional(),
  locked: z.boolean().optional(),
  editable: z.boolean().optional(),
  hidden: z.boolean().optional(),
  visible: z.boolean().optional(),
  action: loose.optional(),
});
type ExternalElement = z.infer<typeof ExternalElementSchema>;

export const ExternalCardSchema = z.object({
  id: z.string().max(120).optional(),
  name: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  canvas: z.object({ width: num.default(360), height: num.default(760), background: z.string().max(40).optional() }).loose(),
  theme: loose.optional(),
  data: loose.optional(),
  assets: z.record(z.string(), z.unknown()).optional(),
  elements: z.array(ExternalElementSchema).min(1).max(400),
  settings: loose.optional(),
});
export type ExternalCard = z.infer<typeof ExternalCardSchema>;

export interface CardImportOptions {
  /** Template key; from the card's id (or name) when absent. */
  key?: string;
  name?: string;
  category?: string;
  eventTypes?: string[];
}

/** An image the card points at that Bulava could not use as it is. */
export interface CardImportStandIn {
  element: string;
  source: string;
  /** What draws it instead (an ornament or the artboard's texture), or null when it was left out. */
  drawnAs: string | null;
}

export interface CardImportResult {
  key: string;
  name: string;
  category: string;
  eventTypes: string[];
  definition: TemplateDefinitionInput;
  standIns: CardImportStandIn[];
  warnings: string[];
}

// ─────────────────────────── Helpers ───────────────────────────

const SCRIPT_FAMILIES: ReadonlySet<string> = new Set(['Great Vibes', 'Pinyon Script', 'Parisienne', 'Alex Brush', 'Pacifico']);
const FAMILIES: ReadonlySet<string> = new Set(FONT_FAMILIES);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** #rgb, #rrggbb or #rrggbbaa as #rrggbb (lower case); anything else is not a colour. */
export function normalizeHex(value: unknown): string | undefined {
  const s = str(value)?.toLowerCase();
  if (!s) return undefined;
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
  const m6 = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  return m6 ? `#${m6[1]}` : undefined;
}

export function slugKey(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'imported-card'
  );
}

const EVENT_TYPE_WORDS: Array<[RegExp, string]> = [
  [/engag|roka|sagai|ring/, 'ENGAGEMENT'],
  [/anniversar/, 'ANNIVERSARY'],
  [/birthday|bday/, 'BIRTHDAY'],
  [/baby|shower|godh/, 'BABY_SHOWER'],
  [/naming|namkaran/, 'NAMING_CEREMONY'],
  [/mundan/, 'MUNDAN'],
  [/thread|upanayan|janeu/, 'THREAD_CEREMONY'],
  [/house|griha/, 'HOUSEWARMING'],
  [/puja|pooja|religious|satsang/, 'RELIGIOUS'],
  [/festival|diwali|eid|christmas|holi|navratri|pongal/, 'FESTIVAL'],
  [/corporate|conference|launch/, 'CORPORATE'],
  [/school|college/, 'SCHOOL_COLLEGE'],
  [/community/, 'COMMUNITY'],
  [/retire|farewell/, 'RETIREMENT'],
  [/wedding|shaadi|vivah|haldi|mehendi|mehndi|sangeet|reception|nikah|anand|marriage/, 'WEDDING'],
];

function eventTypeFor(category: string): string {
  const c = category.toLowerCase();
  return EVENT_TYPE_WORDS.find(([re]) => re.test(c))?.[1] ?? 'WEDDING';
}

const titleCase = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** A dotted path (a.b.0.c or a.b[0].c) from the card's data. */
function dataAt(data: unknown, path: string): unknown {
  let current: unknown = data;
  for (const part of path.replace(/\[(\d+)\]/g, '.$1').split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ─────────────────────────── Bindings ───────────────────────────

type TextValue = Value;

/** The function a path names, by position (events.1.name → 1 and "name"). */
function eventPath(path: string): { index: number; field: string } | null {
  const m = /^(?:events|functions|schedule)(?:\.|\[)(\d+)\]?\.(name|title|date|time|venue|place)$/.exec(path);
  return m ? { index: Number(m[1]), field: m[2]! } : null;
}

/** What a card's text binding becomes: a Bulava binding, or null to keep the sample text. */
function mapTextBinding(path: string, data: unknown, slots: Map<string, string>): { value: TextValue; functionIndex?: number } | null {
  const p = path.replace(/\[(\d+)\]/g, '.$1');
  switch (p) {
    case 'couple.displayName':
    case 'couple.names':
    case 'couple.name':
    case 'names':
      return { value: { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: { binding: 'event.title' } } };
    case 'couple.bride':
    case 'couple.brideName':
    case 'couple.partnerOne':
    case 'bride':
      return { value: { binding: 'couple.partnerOne' } };
    case 'couple.groom':
    case 'couple.groomName':
    case 'couple.partnerTwo':
    case 'groom':
      return { value: { binding: 'couple.partnerTwo' } };
    case 'honoree':
    case 'honoree.name':
    case 'person.name':
      return { value: { binding: 'honoree.name' } };
    case 'event.title':
    case 'wedding.title':
    case 'title':
      return { value: { binding: 'event.title' } };
    case 'wedding.dateLabel':
    case 'wedding.date':
    case 'event.date':
    case 'event.dateLabel':
    case 'date':
      return { value: { binding: 'event.startDate', format: 'date' } };
    case 'wedding.time':
    case 'event.time':
      return { value: { binding: 'event.startDate', format: 'time' } };
    case 'wedding.venue':
    case 'event.venue':
    case 'venue':
    case 'venue.name':
      return { value: { template: '{{venue.name}}, {{venue.city}}', fallback: { binding: 'venue.name' } } };
    case 'wedding.city':
    case 'venue.city':
      return { value: { binding: 'venue.city' } };
    case 'wedding.address':
    case 'venue.address':
      return { value: { binding: 'venue.address' } };
    case 'guest.name':
      return { value: { binding: 'guest.name' } };
    default:
      break;
  }
  const fn = eventPath(p);
  if (fn) {
    if (fn.index > 3) return null;
    const base = `functions[${fn.index}]`;
    const value: TextValue =
      fn.field === 'date' ? { binding: `${base}.date`, format: 'date' } : fn.field === 'time' ? { binding: `${base}.time`, format: 'time' } : fn.field === 'venue' || fn.field === 'place' ? { binding: `${base}.venue.name` } : { binding: `${base}.name` };
    return { value, functionIndex: fn.index };
  }
  // A line of words (the invitation, a message): a text the host can reword, starting as the card's own.
  if (/invitation|message|tagline|blessing|quote|caption|note/i.test(p)) {
    const sample = str(dataAt(data, p));
    const key = (/blessing/i.test(p) ? 'blessings' : /tagline/i.test(p) ? 'tagline' : 'invitation') as string;
    slots.set(key, /blessing/i.test(p) ? 'Blessings' : /tagline/i.test(p) ? 'Tagline' : 'Invitation line');
    return { value: sample ? { binding: `custom.${key}`, fallback: { literal: sample } } : { binding: `custom.${key}` } };
  }
  return null;
}

/** Photo spots by the card's path. */
function mapPhotoBinding(path: string): string | null {
  const p = path.replace(/\[(\d+)\]/g, '.$1').toLowerCase();
  if (/^(couple\.)?(photo|image|cover|picture)$|couple\.(photo|image|picture)|cover/.test(p)) return 'photo.cover';
  if (/bride|partnerone/.test(p)) return 'photo.partnerOne';
  if (/groom|partnertwo/.test(p)) return 'photo.partnerTwo';
  if (/story/.test(p)) return 'photo.story';
  const m = /photos\.(\d)/.exec(p);
  if (m && Number(m[1]) < 3) return `photos[${m[1]}]`;
  return null;
}

// ─────────────────────────── Stand-in art ───────────────────────────

type StandIn = { ornament: OrnamentLayerName; turnTall?: boolean } | { texture: true };

/** What an image's name says it is, drawn by the engine instead. */
function standInFor(name: string, w: number, h: number): StandIn | null {
  const s = name.toLowerCase();
  if (/texture|pattern|paper|grain|noise|fabric|silk/.test(s)) return { texture: true };
  if (/mandala|rangoli|kolam/.test(s)) return { ornament: 'mandala' };
  if (/corner/.test(s)) return { ornament: 'filigreeCorner' };
  if (/frame|border-frame/.test(s)) return { ornament: 'ornateFrame' };
  if (/floral|flower|vine|leaf|leaves|border|garland/.test(s)) return h > w * 3 ? { ornament: 'floralGarland', turnTall: true } : { ornament: 'floral' };
  if (/sparkle|star|glitter|twinkle/.test(s)) return { ornament: 'stars' };
  if (/paisley/.test(s)) return { ornament: 'paisleyOrnate' };
  if (/lotus/.test(s)) return { ornament: 'lotus' };
  if (/peacock/.test(s)) return { ornament: 'royalPeacock' };
  if (/elephant|gaj/.test(s)) return { ornament: 'elephant' };
  if (/diya|lamp/.test(s)) return { ornament: 'diya' };
  if (/toran/.test(s)) return { ornament: 'toran' };
  if (/kalash/.test(s)) return { ornament: 'kalash' };
  if (/lantern/.test(s)) return { ornament: 'lantern' };
  if (/marigold|genda/.test(s)) return { ornament: 'marigoldStrand' };
  if (/flourish|divider|swirl/.test(s)) return { ornament: 'flourish' };
  if (/medallion|crest|emblem/.test(s)) return { ornament: 'medallion' };
  if (/arch|jharokha/.test(s)) return { ornament: 'jharokha' };
  return null;
}

// ─────────────────────────── The import ───────────────────────────

/** Turns external card JSON into a Bulava canvas template (see the module comment). Throws a ZodError when it is not card JSON. */
export function importCardJson(input: unknown, options: CardImportOptions = {}): CardImportResult {
  const card = ExternalCardSchema.parse(input);
  const warnings: string[] = [];
  const standIns: CardImportStandIn[] = [];
  const theme = (card.theme ?? {}) as Record<string, unknown>;
  const data = card.data ?? {};

  // The board keeps the card's own size (cards and websites scale it), within Bulava's limits.
  const width = Math.round(clamp(n(card.canvas.width) ?? 360, 200, 4000));
  const height = Math.round(clamp(n(card.canvas.height) ?? 760, 100, 8000));
  if (width !== card.canvas.width || height !== card.canvas.height) warnings.push(`The canvas was ${card.canvas.width} × ${card.canvas.height}; it is ${width} × ${height} now.`);

  // ── Palette: the card's colours as roles, so colour presets restyle the design ──
  const pick = (...keys: string[]) => keys.map((k) => normalizeHex(theme[k])).find(Boolean);
  const background = normalizeHex(card.canvas.background) ?? pick('background', 'primary') ?? '#590f28';
  const colors: ThemeColors = {
    primary: pick('primary') ?? background,
    secondary: pick('gold', 'secondary', 'accent', 'metal') ?? '#e7c477',
    accent: pick('goldLight', 'accent', 'highlight') ?? '#f8e5ac',
    background,
    surface: pick('secondary', 'surface') ?? background,
    text: pick('text', 'foreground') ?? '#f8e5c0',
    muted: pick('goldDark', 'muted') ?? '#a87532',
  };
  // A colour equal to a palette colour follows the palette; the metal roles win ties.
  const ROLE_ORDER: PaletteKey[] = ['secondary', 'accent', 'text', 'muted', 'primary', 'surface', 'background'];
  const colorRef = (value: unknown, fallback: ColorRef): ColorRef => {
    if (typeof value === 'string' && /^(transparent|none)$/i.test(value.trim())) return 'transparent';
    const hex = normalizeHex(value);
    if (!hex) return fallback;
    return ROLE_ORDER.find((role) => colors[role] === hex) ?? hex;
  };

  // ── Fonts: a script face becomes the script role, the others heading and body ──
  const family = (v: unknown): FontFamily | undefined => {
    const s = str(v);
    return s && FAMILIES.has(s) ? (s as FontFamily) : undefined;
  };
  const headingRaw = str(theme.fontHeading);
  const bodyRaw = str(theme.fontBody);
  for (const f of [headingRaw, bodyRaw, str(theme.fontButton)]) if (f && !FAMILIES.has(f)) warnings.push(`The font "${f}" is not in Bulava's library; a similar one is used.`);
  const headingFamily = family(headingRaw);
  const bodyFamily = family(bodyRaw) ?? 'Cormorant Garamond';
  const script = headingFamily && SCRIPT_FAMILIES.has(headingFamily) ? headingFamily : undefined;
  const heading: FontFamily = headingFamily && !script ? headingFamily : SCRIPT_FAMILIES.has(bodyFamily) ? 'Playfair Display' : bodyFamily;
  const body: FontFamily = SCRIPT_FAMILIES.has(bodyFamily) ? 'Cormorant Garamond' : bodyFamily;
  const fontRole = (v: unknown): 'heading' | 'body' | 'script' | FontFamily => {
    const s = str(v);
    if (!s) return 'body';
    if (script && s === script) return 'script';
    if (s === body) return 'body';
    if (s === heading) return 'heading';
    if (FAMILIES.has(s)) return s as FontFamily;
    if (!warnings.some((w) => w.includes(`"${s}"`))) warnings.push(`The font "${s}" is not in Bulava's library; the body font is used.`);
    return SCRIPT_FAMILIES.has(heading) ? 'script' : 'body';
  };

  // ── Elements ──
  const slots = new Map<string, string>();
  const layers: LayerInput[] = [];
  const assetIds = new Set<string>();
  let texture = null as { strength: number } | null;
  let boardFill = colorRef(background, 'background') as ColorRef;
  let photoUsed = false as boolean;
  const ids = new Set<string>();
  const layerId = (raw: string | undefined, kind: string, i: number) => {
    let base = (raw ?? `${kind}-${i + 1}`).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 56) || `${kind}-${i + 1}`;
    if (!/^[a-z0-9]/.test(base)) base = `l-${base}`;
    let id = base;
    for (let k = 2; ids.has(id); k++) id = `${base}-${k}`;
    ids.add(id);
    return id;
  };
  // An element named "event-2-…" belongs to the second function: it shows while that function is listed.
  const functionOf = (id: string | undefined): number | undefined => {
    const m = id ? /(?:^|[-_])(?:event|function|fn|ceremony)[-_]?(\d)(?:[-_]|$)/i.exec(id) : null;
    const k = m ? Number(m[1]) - 1 : undefined;
    return k !== undefined && k >= 0 && k <= 3 ? k : undefined;
  };
  const assetName = (src: string) => {
    const entry = Object.entries(card.assets ?? {}).find(([, v]) => v === src);
    return `${entry?.[0] ?? ''} ${src}`;
  };

  card.elements.forEach((el: ExternalElement, i) => {
    const style = (el.style ?? {}) as Record<string, unknown>;
    const content = (el.content ?? {}) as Record<string, unknown>;
    const kind = el.kind.toLowerCase();
    const f = el.frame;
    const rotate = n(f.rotate) ?? n(style.rotation) ?? 0;
    const opacity = clamp(n(style.opacity) ?? 1, 0, 1);
    const hidden = el.hidden === true || el.visible === false;
    const common = { opacity, locked: el.locked === true, hidden };
    const fnIndex = functionOf(el.id);
    const when = fnIndex !== undefined ? { visibleWhen: { exists: `functions[${fnIndex}].name` } } : {};
    const frame = (x: number, y: number, w: number, h: number, turn = rotate) => ({ x: r1(x), y: r1(y), w: Math.max(1, r1(w)), h: Math.max(1, r1(h)), ...(turn ? { rotate: turn } : {}) });

    // The first full-canvas rectangle is the board's own colour.
    if (i === 0 && (kind === 'rect' || kind === 'rectangle') && f.x <= 0 && f.y <= 0 && f.w >= width && f.h >= height && !style.stroke) {
      boardFill = colorRef(style.fill ?? style.background, boardFill);
      return;
    }

    switch (kind) {
      case 'rect':
      case 'rectangle':
      case 'circle':
      case 'ellipse': {
        const fillRef = colorRef(style.fill ?? style.background, 'transparent');
        const strokeWidth = n(style.strokeWidth) ?? n(style.borderWidth);
        const stroke = (strokeWidth ?? 0) > 0 ? { width: clamp(strokeWidth!, 0, 100), color: colorRef(style.stroke ?? style.borderColor, 'secondary') } : undefined;
        layers.push({
          id: layerId(el.id, 'shape', i),
          kind: 'shape',
          shape: kind === 'circle' || kind === 'ellipse' ? 'ellipse' : 'rect',
          frame: frame(f.x, f.y, f.w, f.h),
          fill: fillRef === 'transparent' ? { type: 'none' } : { type: 'color', color: fillRef },
          ...(stroke ? { stroke: { ...stroke, dash: clamp(n(style.dash) ?? 0, 0, 100) } } : {}),
          radius: clamp(n(style.radius) ?? n(style.borderRadius) ?? 0, 0, 1000),
          ...common,
          ...when,
        });
        return;
      }
      case 'line': {
        const thickness = clamp(n(style.strokeWidth) ?? 1, 0.2, 100);
        const color = colorRef(style.stroke ?? style.color ?? style.fill, 'secondary');
        const vertical = f.w < f.h;
        const length = vertical ? f.h : f.w;
        const band = Math.max(2, thickness * 2);
        // Lines are drawn across a box: a vertical line is a horizontal one turned a quarter.
        const fr = vertical ? frame(f.x - length / 2, f.y + length / 2 - band / 2, length, band, rotate + 90) : frame(f.x, f.y - band / 2, length, band);
        layers.push({ id: layerId(el.id, 'line', i), kind: 'shape', shape: 'line', frame: fr, fill: { type: 'none' }, stroke: { width: thickness, color, dash: clamp(n(style.dash) ?? 0, 0, 100) }, ...common, ...when });
        return;
      }
      case 'text':
      case 'button': {
        let value: TextValue | null = null;
        let boundIndex: number | undefined;
        const binding = str(content.binding);
        const literal = str(content.text) ?? str(content.label) ?? str(content.value);
        if (binding) {
          const mapped = mapTextBinding(binding, data, slots);
          if (mapped) {
            value = mapped.value;
            boundIndex = mapped.functionIndex;
          } else {
            const sample = dataAt(data, binding);
            if (typeof sample === 'string' || typeof sample === 'number') {
              value = { literal: String(sample) };
              warnings.push(`"${el.id ?? `element ${i + 1}`}" was bound to ${binding}, which Bulava does not know: it shows "${sample}" as fixed text.`);
            } else {
              warnings.push(`"${el.id ?? `element ${i + 1}`}" was bound to ${binding}, which Bulava does not know: it was left out.`);
            }
          }
        } else if (literal) {
          value = { literal };
        }
        if (!value) return;
        const size = clamp(n(style.fontSize) ?? n(style.size) ?? 16, 6, 600);
        const weightRaw = style.fontWeight ?? style.weight;
        const weight = typeof weightRaw === 'string' && /bold/i.test(weightRaw) ? 700 : typeof weightRaw === 'string' && /semi/i.test(weightRaw) ? 600 : clamp(Math.round((n(weightRaw) ?? 400) / 100) * 100, 100, 900);
        const spacingPx = n(style.letterSpacing) ?? 0;
        const lineRaw = n(style.lineHeight);
        const shadow = style.shadow && typeof style.shadow === 'object' ? ((n((style.shadow as Record<string, unknown>).blur) ?? 0) > 6 ? 'glow' : 'soft') : 'none';
        const valign = str(style.verticalAlign) ?? str(style.valign);
        // A button with its own colour keeps it as a shape behind the words.
        const fill = kind === 'button' ? colorRef(style.background ?? style.fill, 'transparent') : 'transparent';
        if (fill !== 'transparent') {
          layers.push({ id: layerId(`${el.id ?? 'button'}-bg`, 'shape', i), kind: 'shape', shape: 'rect', frame: frame(f.x, f.y, f.w, f.h), fill: { type: 'color', color: fill }, radius: clamp(n(style.radius) ?? n(style.borderRadius) ?? 8, 0, 1000), ...common, ...when });
        }
        const index = boundIndex ?? fnIndex;
        layers.push({
          id: layerId(el.id, 'text', i),
          kind: 'text',
          content: value,
          frame: frame(f.x, f.y, f.w, f.h),
          style: {
            font: fontRole(style.font ?? style.fontFamily),
            size,
            weight,
            italic: style.italic === true || style.fontStyle === 'italic',
            color: colorRef(style.color, 'text'),
            align: (['left', 'center', 'right'] as const).find((a) => a === (str(style.align) ?? str(style.textAlign))) ?? 'left',
            valign: valign === 'middle' || valign === 'center' ? 'middle' : valign === 'bottom' ? 'bottom' : 'top',
            letterSpacing: clamp(r1((spacingPx / size) * 100) / 100, -0.2, 1),
            lineHeight: clamp(lineRaw === undefined ? 1.2 : lineRaw > 3 ? lineRaw / size : lineRaw, 0.7, 3),
            transform: str(style.textTransform) === 'uppercase' ? 'upper' : str(style.textTransform) === 'lowercase' ? 'lower' : str(style.textTransform) === 'capitalize' ? 'capitalize' : 'none',
            shadow,
            foil: style.foil === true,
          },
          ...common,
          ...(index !== undefined ? { visibleWhen: { exists: `functions[${index}].name` } } : {}),
        });
        if (kind === 'button' && el.action) warnings.push(`"${el.id ?? `element ${i + 1}`}" was a button: on the invitation website guests reply in its RSVP section, so the card shows it as words.`);
        return;
      }
      case 'image': {
        const binding = str(content.binding);
        const assetId = str(content.assetId) ?? (str(content.src)?.startsWith('asset:') ? str(content.src)!.slice(6) : undefined);
        const fit = str(style.fit) === 'contain' ? 'contain' : 'cover';
        const radius = n(style.radius) ?? n(style.borderRadius) ?? 0;
        const round = radius >= Math.min(f.w, f.h) / 2 - 0.5;
        const base = { frame: frame(f.x, f.y, f.w, f.h), fit, mask: round ? 'circle' : radius > 0 ? 'rounded' : 'none', radius: clamp(radius, 0, 1000), ...common, ...when } as const;
        if (binding) {
          const spot = mapPhotoBinding(binding);
          if (spot) {
            photoUsed = true;
            layers.push({ id: layerId(el.id, 'photo', i), kind: 'image', source: { type: 'binding', binding: spot }, alt: '', ...base });
          } else {
            warnings.push(`The image "${el.id ?? `element ${i + 1}`}" was bound to ${binding}, which is not a photo spot: it was left out.`);
          }
          return;
        }
        if (assetId && z.uuid().safeParse(assetId).success) {
          assetIds.add(assetId);
          layers.push({ id: layerId(el.id, 'image', i), kind: 'image', source: { type: 'asset', assetId }, alt: '', ...base });
          return;
        }
        const src = str(content.src) ?? str(content.url) ?? '';
        const stand = standInFor(`${el.id ?? ''} ${assetName(src)}`, f.w, f.h);
        if (!stand) {
          standIns.push({ element: el.id ?? `element ${i + 1}`, source: src, drawnAs: null });
          return;
        }
        if ('texture' in stand) {
          texture = { strength: clamp(opacity * 1.8, 0.15, 0.9) };
          standIns.push({ element: el.id ?? `element ${i + 1}`, source: src, drawnAs: 'paper texture' });
          return;
        }
        const tint = colorRef(theme.gold ?? colors.secondary, 'secondary');
        // A tall border drawn from a garland: the garland turned a quarter, centred where the border was.
        const fr = stand.turnTall ? frame(f.x + f.w / 2 - f.h / 2, f.y + f.h / 2 - f.w / 2, f.h, f.w, rotate + (f.x + f.w / 2 < width / 2 ? 90 : -90)) : frame(f.x, f.y, f.w, f.h);
        layers.push({ id: layerId(el.id, 'ornament', i), kind: 'ornament', ornament: stand.ornament, frame: fr, color: tint, foil: true, ...common, ...when });
        standIns.push({ element: el.id ?? `element ${i + 1}`, source: src, drawnAs: stand.ornament });
        return;
      }
      default:
        warnings.push(`"${el.id ?? `element ${i + 1}`}" is a ${el.kind}, which Bulava cannot draw: it was left out.`);
    }
  });

  if (layers.length > 120) {
    warnings.push(`The card has ${layers.length} layers; Bulava keeps the first 120.`);
    layers.length = 120;
  }
  for (const s of standIns) {
    warnings.push(
      s.drawnAs
        ? `"${s.element}" used ${s.source || 'an image'}, which is not a licensed asset: Bulava draws ${s.drawnAs === 'paper texture' ? 'a paper texture' : `its own ${s.drawnAs}`} instead. Replace it with the licensed image in the Canvas editor if you have it.`
        : `"${s.element}" used ${s.source || 'an image'}, which is not a licensed asset and has no drawn stand-in: it was left out. Add it from the asset library in the Canvas editor.`,
    );
  }
  if (card.settings) warnings.push('The card\'s editor settings were not imported: every Bulava template offers the same editing.');

  const mobile: ArtboardInput = {
    width,
    height,
    background: { type: 'color', color: boardFill },
    ...(texture ? { texture: 'paper' as const, textureStrength: texture.strength } : {}),
    layers,
  };

  const name = (options.name ?? str(card.name) ?? 'Imported card').slice(0, 80);
  const key = slugKey(options.key ?? str(card.id) ?? name);
  const category = titleCase(options.category ?? str(card.category) ?? 'Wedding').slice(0, 60);
  const eventTypes = options.eventTypes?.length ? options.eventTypes : [eventTypeFor(`${card.category ?? ''} ${name}`)];
  const description = str(dataAt(data, 'wedding.invitationText')) ?? str(dataAt(data, 'invitationText'));
  const dark = luminanceOf(colors.background) < 0.35;

  const definition: TemplateDefinitionInput = {
    schemaVersion: 1,
    templateKey: key,
    type: 'WEBSITE',
    name,
    ...(description ? { description: description.slice(0, 500) } : {}),
    eventTypes,
    languages: ['en', 'hi', 'hi-Latn'],
    theme: { colors, radius: 16, ornament: 'none', pattern: 'none', heroTone: dark ? 'dark' : 'light' },
    fonts: {
      heading: { family: heading, scripts: ['Latn'], fallbacks: { Deva: 'Noto Serif Devanagari' } },
      body: { family: body, scripts: ['Latn'], fallbacks: { Deva: 'Noto Sans Devanagari' } },
      ...(script ? { script: { family: script, scripts: ['Latn'], fallbacks: { Deva: 'Tiro Devanagari Hindi' } } } : {}),
    },
    capabilities: {
      editable: { colors: true, fonts: true, music: false, background: false, layout: true, photos: true, text: true, animation: true },
      textSlots: [...slots].map(([k, label]) => ({ key: k, label, maxLength: k === 'invitation' ? 300 : 160 })),
      maxPhotos: 6,
      photoSlots: photoUsed ? ['cover'] : [],
    },
    assets: [...assetIds].map((assetId) => ({ assetId, role: 'canvas' })),
    website: {
      intro: 'none',
      pages: [
        {
          id: 'home',
          sections: [
            { id: 'hero', section: 'canvas', canvas: { mobile } },
            { id: 'schedule', section: 'eventTimeline', variant: 'timeline' },
            { id: 'venue', section: 'venue' },
            { id: 'rsvp', section: 'rsvp' },
            { id: 'footer', section: 'footer' },
          ],
        },
      ],
    },
  } as TemplateDefinitionInput;

  return { key, name, category, eventTypes, definition, standIns, warnings };
}

/** Relative luminance of a #rrggbb colour (0 black, 1 white). */
function luminanceOf(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
