import { z } from 'zod';
import { FONT_FAMILIES, PATTERNS, VALUE_FORMATS, type EffectName, type FontFamily, type OrnamentNameValue, type Value } from './base';
import { BINDINGS, bindingsIn } from './bindings';
import { luminance } from './contrast';
import { PHOTO_SLOTS, SECTION_KEYS, type IntroName, type LookName, type SectionKey, type TemplateDefinitionInput, type ThemeColors } from './definition';
import { eventTypeFor, importCardJson, normalizeHex, slugKey, type CardImportOptions, type CardImportResult, type CardImportStandIn } from './import-card';

/**
 * Website JSON from outside Bulava (AI generators, agencies, other builders):
 * a `design` (colours, typography and words for the style), `assets` (the
 * photo places, usually as bindings such as {{photo.cover}}) and an ordered
 * list of `sections`, each with a `type`, `visible` and `bindings`
 * ({{couple.partnerOne}} …). `importWebsiteJson` turns it into a Bulava
 * WEBSITE template: the palette and fonts (the nearest of Bulava's families
 * when one is not in the library), each section as the Bulava section that
 * shows the same thing, its bindings as the render context's paths (text the
 * host writes becomes a text slot) and the photo places as the host's photo
 * spots. What cannot come across is reported, and small mistakes (a missing
 * brace, a binding's other name) are repaired and listed, never errors.
 * `importDesignJson` tells card JSON and website JSON apart.
 */

// ─────────────────────────── The JSON ───────────────────────────

const loose = z.record(z.string(), z.unknown());
/** A table's own entry: names such as "constructor" or "toString" in the JSON never reach Object.prototype. */
const ownEntry = <T>(table: Record<string, T>, k: string): T | undefined => (Object.prototype.hasOwnProperty.call(table, k) ? table[k] : undefined);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined);

/** What a section is: its type, else what it is called. */
function sectionType(s: Record<string, unknown>): string {
  return str(s.type) ?? str(s.section) ?? str(s.kind) ?? str(s.component) ?? str(s.name) ?? str(s.id) ?? '';
}

const ExternalWebsiteSectionSchema = loose.refine((s) => sectionType(s) !== '', { message: 'Each section needs a type' });

/** Only the sections decide whether this is website JSON: names, a category or a design in another shape are read where they make sense and otherwise left aside. */
export const ExternalWebsiteSchema = z
  .object({
    sections: z.array(ExternalWebsiteSectionSchema).min(1).max(80),
  })
  .loose();
export type ExternalWebsite = z.infer<typeof ExternalWebsiteSchema>;

export type WebsiteImportOptions = CardImportOptions;

/** A JSON section and the Bulava section it became (one JSON section can become two: an invitation with a verse, travel with a stay). */
export interface WebsiteImportSection {
  /** The JSON section's id and type. */
  from: string;
  type: string;
  /** The Bulava section, or null when it was left out. */
  id: string | null;
  section: SectionKey | null;
  variant: string | null;
  /** Why it was left out: hidden in the JSON, a type no Bulava section shows, a second hero or RSVP, or past the page's limit of sections. */
  skipped: 'hidden' | 'unknown' | 'duplicate' | 'limit' | null;
}

export interface WebsiteImportFont {
  role: 'heading' | 'body' | 'script';
  /** The family the JSON asked for (null: it named none). */
  requested: string | null;
  family: FontFamily;
  /** The requested family is not in Bulava's library: the nearest is used. */
  substituted: boolean;
}

/** A binding written wrongly and read as Bulava's: a missing or extra brace, another name for the same thing, a format. */
export interface WebsiteImportRepair {
  at: string;
  from: string;
  to: string;
}

/** A photo place the JSON's assets name, and the host photo it became. */
export interface WebsiteImportPhoto {
  asset: string;
  binding: string;
  /** cover, partnerOne… (a named spot), "photos" (the host's chosen photos) or "gallery". */
  slot: string;
  /** Whether a section on this page shows it. */
  shown: boolean;
}

export interface WebsiteImportBinding {
  at: string;
  binding: string;
}

export interface WebsiteImportResult {
  key: string;
  name: string;
  category: string;
  eventTypes: string[];
  definition: TemplateDefinitionInput;
  sections: WebsiteImportSection[];
  fonts: WebsiteImportFont[];
  repairs: WebsiteImportRepair[];
  photos: WebsiteImportPhoto[];
  unknownBindings: WebsiteImportBinding[];
  /** Images that are files or addresses, not host photos or licensed assets: left out. */
  standIns: CardImportStandIn[];
  warnings: string[];
}

// ─────────────────────────── Words ───────────────────────────

/** Letters and digits only: "Love Story", "love_story" and "loveStory" all read "lovestory". */
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** "loveStory", "Love Story" and "love_story" as "love-story". */
const kebab = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const titleCase = (s: string) => s.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase());
const clip = (s: string, max = 60) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const camel = (s: string) =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w[0]!.toLowerCase() + w.slice(1) : w[0]!.toUpperCase() + w.slice(1)))
    .join('');

// ─────────────────────────── Colours ───────────────────────────

function mix(a: string, b: string, t: number): string {
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = ch(a);
  const y = ch(b);
  return `#${x.map((c, i) => Math.round(c + (y[i]! - c) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Palette roles and the names generators give them (letters only). A metal colour (`METAL_NAME`, or an
 * accent of a metal tone) is not among them: Bulava draws ornaments, frames, rules and dividers in the
 * secondary, so the metal becomes the secondary and the JSON's own secondary the accent.
 */
const COLOR_NAMES: Record<Exclude<keyof ThemeColors, 'deep'>, string[]> = {
  background: ['background', 'bg', 'backgroundcolor', 'page', 'pagebackground', 'base'],
  surface: ['surface', 'card', 'paper', 'panel', 'surfacecolor', 'cardbackground', 'backgroundalt'],
  primary: ['primary', 'primarycolor', 'brand', 'main'],
  secondary: ['secondary', 'secondarycolor'],
  accent: ['accent', 'accentcolor', 'highlight'],
  text: ['text', 'textcolor', 'foreground', 'ink', 'body', 'textprimary'],
  muted: ['muted', 'mutedtext', 'textmuted', 'subtle', 'textsecondary', 'secondarytext', 'caption'],
};
/** Colour names (letters only) that are a metal: "gold", "goldFoil", "metallic", "antique_brass". */
const METAL_NAME = /gold|metal|foil|brass|silver|copper|bronze/;

/** Gold, brass, bronze and copper: a warm, muted hue of middle lightness (not a bright orange or a brown). */
function isMetalTone(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return false;
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return h >= 18 && h <= 55 && s >= 0.25 && s <= 0.8 && l >= 0.3 && l <= 0.72;
}

// ─────────────────────────── Fonts ───────────────────────────

const FAMILY_BY_NAME = new Map(FONT_FAMILIES.map((f) => [flat(f), f] as const));
const SCRIPT_FACES: ReadonlySet<FontFamily> = new Set(['Great Vibes', 'Pinyon Script', 'Parisienne', 'Alex Brush', 'Pacifico']);
const SERIF_FACES: ReadonlySet<FontFamily> = new Set(['Playfair Display', 'Cormorant Garamond', 'Noto Serif', 'Cinzel', 'Marcellus', 'Italiana', 'Yeseva One', 'Lora']);
/** Families that draw Devanagari themselves. */
const DEVA_FACES: ReadonlySet<FontFamily> = new Set(['Poppins', 'Baloo 2', 'Yatra One', 'Rozha One', 'Tiro Devanagari Hindi', 'Noto Sans Devanagari', 'Noto Serif Devanagari']);

/** Families outside the library and the nearest one in it, by kind of letter. */
const NEAREST_FAMILY: Array<[RegExp, FontFamily]> = [
  [/garamond|caslon|baskerville|sabon|minion|bembo|crimson|cardo|goudy|oldstandard|cormorant/, 'Cormorant Garamond'],
  [/playfair|bodoni|didot|prata|abril|dmserif|gloock|fraunces|rufina|librecaslondisplay/, 'Playfair Display'],
  [/cinzel|trajan|forum/, 'Cinzel'],
  [/marcellus|tenor|philosopher|federo|josefinslab/, 'Marcellus'],
  [/italiana|poiret|bellefair|antic|limelight/, 'Italiana'],
  [/yeseva|ultra|ptserifcaption/, 'Yeseva One'],
  [/lora/, 'Lora'],
  [/merriweather|ptserif|sourceserif|georgia|times|spectral|alegreya(?!sans)|vollkorn|libre|domine|cambria|(?<!sans)serif/, 'Noto Serif'],
  [/pacifico|lobster|satisfy|kaushan|cookie|yellowtail|courgette|damion|grandhotel|caveat|kalam|amatic|indieflower|permanentmarker|handlee/, 'Pacifico'],
  [/pinyon|tangerine|italianno|rouge|herrvon|mrssaint|monsieur|ephesis|petitformal/, 'Pinyon Script'],
  [/parisienne|sacramento|allura|meow|corinthia|windsong/, 'Parisienne'],
  [/alex|brush|signature|birthstone|lavishly|luxurious/, 'Alex Brush'],
  [/vibes|dancing|style|ballet|imperial|script|calligraph|hand/, 'Great Vibes'],
  [/baloo|nunito(?!sans)|quicksand|varela|comfortaa|fredoka|mali|rounded/, 'Baloo 2'],
  [/montserrat|raleway|jost|futura|josefin|worksans|dmsans|inter|manrope|outfit|urbanist|lexend|jakarta|figtree|gotham|avenir|centurygothic|questrial|nunitosans/, 'Montserrat'],
  [/yatra|amita|laila|sura|kurale|eczar|martel|sahitya/, 'Yatra One'],
  [/devanagari|hindi|marathi|mukta|hind|karma/, 'Noto Sans Devanagari'],
  [/sans|roboto|lato|opensans|helvetica|arial|segoe|system|karla|mulish|plex|fira/, 'Noto Sans'],
  [/display|decorative/, 'Playfair Display'],
];

/** "'Lora', serif", { family: "Lora" } or "Lora" as "Lora". */
function familyName(v: unknown): string | undefined {
  const o = rec(v);
  const s = str(v) ?? str(o.family) ?? str(o.fontFamily) ?? str(o.name);
  return s?.split(',')[0]?.replace(/["']/g, '').trim() || undefined;
}

function nearestFamily(name: string): FontFamily | undefined {
  const f = flat(name);
  return FAMILY_BY_NAME.get(f) ?? NEAREST_FAMILY.find(([re]) => re.test(f))?.[1];
}

// ─────────────────────────── Bindings ───────────────────────────

type ValueFormat = (typeof VALUE_FORMATS)[number];
/** Plain words, or one binding (the render context's path, a text slot's `custom.<key>`). */
type Part = { text: string } | { path: string; format?: ValueFormat; slot?: string };

const SLOT_KEY = /^[a-z][a-zA-Z0-9]{0,31}$/;
const looseKey = (p: string) => p.toLowerCase().replace(/[_-]/g, '');
const BINDING_BY_LOOSE = new Map(Object.keys(BINDINGS).map((k) => [looseKey(k), k] as const));
/** Other names generators use for Bulava's bindings (lower case, without _ and -). */
const BINDING_ALIASES: Record<string, string> = {
  bride: 'couple.partnerOne',
  'bride.name': 'couple.partnerOne',
  'couple.bride': 'couple.partnerOne',
  'couple.partner1': 'couple.partnerOne',
  groom: 'couple.partnerTwo',
  'groom.name': 'couple.partnerTwo',
  'couple.groom': 'couple.partnerTwo',
  'couple.partner2': 'couple.partnerTwo',
  'wedding.date': 'event.startDate',
  'event.date': 'event.startDate',
  'event.start': 'event.startDate',
  'event.startsat': 'event.startDate',
  'event.end': 'event.endDate',
  'event.endsat': 'event.endDate',
  'wedding.title': 'event.title',
  'event.name': 'event.title',
  'wedding.venue': 'venue.name',
  'event.venue': 'venue.name',
  'wedding.city': 'venue.city',
  'event.city': 'venue.city',
  'wedding.address': 'venue.address',
  'event.address': 'venue.address',
  'venue.map': 'venue.mapUrl',
  'venue.maplink': 'venue.mapUrl',
  'venue.mapsurl': 'venue.mapUrl',
  'venue.mapslink': 'venue.mapUrl',
  'venue.googlemapsurl': 'venue.mapUrl',
  'venue.directions': 'venue.mapUrl',
  'function.title': 'function.name',
  'function.start': 'function.startsAt',
  'function.venue': 'function.venue.name',
  'function.venuename': 'function.venue.name',
  'function.location': 'function.venue.name',
  'function.address': 'function.venue.address',
  'function.city': 'function.venue.city',
  events: 'functions',
  schedule: 'functions',
  gallery: 'gallery.images',
  'gallery.photos': 'gallery.images',
  guest: 'guest.name',
  guestname: 'guest.name',
  honoree: 'honoree.name',
  'photo.couple': 'photo.cover',
  'photo.hero': 'photo.cover',
  'photo.bride': 'photo.partnerOne',
  'photo.groom': 'photo.partnerTwo',
  updates: 'announcements',
};
/** Formats generators write after a binding (`{{event.startDate|longDate}}`) and Bulava's. */
const FORMAT_ALIASES: Record<string, ValueFormat> = {
  date: 'date',
  longdate: 'dateWithWeekday',
  fulldate: 'dateWithWeekday',
  datewithweekday: 'dateWithWeekday',
  shortdate: 'dateShort',
  dateshort: 'dateShort',
  numericdate: 'dateNumeric',
  datenumeric: 'dateNumeric',
  time: 'time',
  datetime: 'dateTime',
  upper: 'upper',
  uppercase: 'upper',
  lower: 'lower',
  lowercase: 'lower',
  initial: 'initial',
  initials: 'initial',
};

/** A binding as Bulava names it (null: Bulava does not know it). */
function knownBinding(raw: string): { path: string; slot?: string } | null {
  const p = raw
    .replace(/\s+/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.(\d+)(?=\.|$)/g, '[$1]');
  if (ownEntry(BINDINGS, p)) return { path: p };
  const custom = /^custom\.([A-Za-z0-9_-]+)$/i.exec(p);
  if (custom) {
    const key = camel(custom[1]!);
    // A text field named like an object's own method ({{custom.constructor}}) would read that method, not the host's words.
    return SLOT_KEY.test(key) && !(key in Object.prototype) ? { path: `custom.${key}`, slot: key } : null;
  }
  const path = ownEntry(BINDING_ALIASES, looseKey(p)) ?? BINDING_BY_LOOSE.get(looseKey(p));
  return path ? { path } : null;
}

const bindingType = (path: string) => ownEntry(BINDINGS, path)?.type ?? (path.startsWith('custom.') ? 'text' : undefined);

/** `{{path}}` with every brace mistake: `{{x}`, `{x}}`, `{x}`, `{{{x}}}`, `x}}`, and `{{x|format}}`. A bare `x}}` starts only where a word does, so a long word is read once, not once per letter. */
const TOKEN = /(\{+)\s*([A-Za-z_]\w*(?:\s*\.\s*\w+|\s*\[\s*\d+\s*\])*)\s*(?:\|\s*([A-Za-z]+)\s*)?(\}*)|(?<![\w.\]])([A-Za-z_]\w*(?:\.\w+|\[\d+\])*)\s*(?:\|\s*([A-Za-z]+)\s*)?(\}+)/g;

// ─────────────────────────── Sections ───────────────────────────

/** What a JSON section becomes: a Bulava section, or an invitation (its words as a story, its verse as a quote). */
type Kind = Exclude<SectionKey, 'canvas' | 'map' | 'parents' | 'invitation' | 'essentials'> | 'invitation';

const KIND_WORDS: Array<[RegExp, Kind]> = [
  [/\b(hero|cover|banner|masthead|landing|splash|header)\b/, 'hero'],
  [/countdown|count-down|timer/, 'countdown'],
  [/rsvp|\breply\b|respond|attendance|confirm/, 'rsvp'],
  [/announce|\bupdates?\b|\bnews\b|notice/, 'announcements'],
  [/photo-share|share-photos?|upload|guest-photos/, 'photoShare'],
  [/gift|registry|shagun/, 'giftRegistry'],
  [/menu|food|cuisine|dinner|dining|feast/, 'menu'],
  [/accommodation|\bstay\b|hotel|lodging/, 'accommodation'],
  [/travel|transport|getting-there/, 'travel'],
  [/gallery|album|moments|photos|pictures/, 'gallery'],
  [/venue|location|\bmap\b|direction|address/, 'venue'],
  [/function|schedule|timeline|itinerary|programme|program|agenda|ceremon|\bevents?\b/, 'eventTimeline'],
  [/famil|parent|blessing/, 'family'],
  [/couple|bride|groom|partners|meet-the/, 'couple'],
  [/story|journey|how-we-met|about-us|love/, 'story'],
  [/quote|verse|shloka|scripture|poem/, 'quote'],
  [/invitation|invite|welcome|intro|greeting|message|about/, 'invitation'],
  [/closing|footer|thank|see-you|outro|farewell|goodbye/, 'footer'],
];

function kindOf(type: string): Kind | null {
  const exact = SECTION_KEYS.find((k) => flat(k) === flat(type));
  if (exact === 'map') return 'venue';
  if (exact === 'parents') return 'family';
  if (exact && exact !== 'canvas' && exact !== 'essentials') return exact;
  const k = kebab(type);
  return KIND_WORDS.find(([re]) => re.test(k))?.[1] ?? null;
}

type PropType = 'text' | 'date' | 'image';
const HEADING = ['title', 'heading', 'headline'];
const PARENTS_ONE = ['custompartneroneparents', 'partneroneparents', 'partneronefamily', 'brideparents', 'bridesparents', 'bridefamily'];
const PARENTS_TWO = ['custompartnertwoparents', 'partnertwoparents', 'partnertwofamily', 'groomparents', 'groomsparents', 'groomfamily'];
/** Each Bulava section's props, and the JSON keys (letters only) that fill them, best first. */
const PROPS: Record<Exclude<Kind, 'invitation'>, Array<[prop: string, type: PropType, keys: string[]]>> = {
  hero: [
    ['title', 'text', ['title', 'names', 'name', 'heading', 'headline', 'couple', 'couplenames']],
    ['eyebrow', 'text', ['eyebrow', 'kicker', 'overline', 'pretitle']],
    ['subtitle', 'text', ['subtitle', 'subheading']],
    ['tagline', 'text', ['tagline', 'slogan', 'caption', 'message']],
    ['date', 'date', ['date', 'startdate', 'startsat', 'datelabel', 'when']],
    ['place', 'text', ['place', 'city', 'location', 'venue', 'where']],
    ['invocation', 'text', ['invocation', 'mantra', 'shloka']],
    ['image', 'image', ['image', 'photo', 'background', 'backgroundimage', 'cover', 'coverimage', 'coverphoto', 'picture']],
  ],
  story: [
    ['heading', 'text', HEADING],
    ['text', 'text', ['story', 'text', 'description', 'body', 'content', 'message', 'about', 'paragraph', 'invitation']],
    ['image', 'image', ['image', 'photo', 'picture']],
  ],
  quote: [
    ['text', 'text', ['quote', 'verse', 'shloka', 'text', 'line']],
    ['by', 'text', ['quoteby', 'by', 'author', 'attribution', 'cite']],
  ],
  family: [
    ['heading', 'text', HEADING],
    ['text', 'text', ['blessings', 'blessing', 'text', 'message', 'description']],
    ['partnerOneParents', 'text', PARENTS_ONE],
    ['partnerTwoParents', 'text', PARENTS_TWO],
  ],
  couple: [
    ['heading', 'text', HEADING],
    ['partnerOneParents', 'text', PARENTS_ONE],
    ['partnerTwoParents', 'text', PARENTS_TWO],
  ],
  countdown: [
    ['heading', 'text', HEADING],
    ['eyebrow', 'text', ['eyebrow', 'label', 'kicker']],
  ],
  eventTimeline: [['heading', 'text', HEADING]],
  venue: [['heading', 'text', HEADING]],
  gallery: [['heading', 'text', HEADING]],
  rsvp: [['heading', 'text', HEADING]],
  announcements: [['heading', 'text', HEADING]],
  photoShare: [['heading', 'text', HEADING]],
  menu: [
    ['heading', 'text', HEADING],
    ['text', 'text', ['menu', 'text', 'items', 'courses', 'dishes', 'description']],
  ],
  accommodation: [
    ['heading', 'text', HEADING],
    ['text', 'text', ['accommodation', 'stay', 'hotel', 'hotels', 'lodging', 'text', 'details', 'description', 'message']],
  ],
  travel: [
    ['heading', 'text', HEADING],
    ['text', 'text', ['travel', 'transport', 'directions', 'gettingthere', 'text', 'details', 'description', 'message']],
  ],
  giftRegistry: [
    ['heading', 'text', HEADING],
    ['text', 'text', ['gifts', 'gift', 'registry', 'message', 'text', 'note', 'description']],
  ],
  footer: [
    ['closing', 'text', ['message', 'closing', 'closingline', 'text', 'title', 'heading']],
    ['hashtag', 'text', ['hashtag', 'tag']],
  ],
};
const STAY_KEYS = new Set(['accommodation', 'stay', 'hotel', 'hotels', 'lodging']);
const TRAVEL_KEYS = new Set(['travel', 'transport', 'directions', 'gettingthere']);
const QUOTE_KEYS = new Set(['quote', 'verse', 'shloka', 'quoteby', 'by', 'author', 'attribution', 'cite']);

/** What a section shows by itself (from the event, its functions and photos): bindings to these need no prop. */
const SHOWS: Partial<Record<SectionKey, RegExp>> = {
  hero: /^(couple\.(partnerOne|partnerTwo|brideName|groomName)|honoree\.name|event\.title|guest\.name|photo\.cover|photos(\[0\])?)$/,
  countdown: /^(event\.startDate|function\.(startsAt|date|time)|functions(\[0\]\.(startsAt|date|time))?)$/,
  couple: /^(couple\.\w+|honoree\.name|photo\.partner(One|Two)|photos(\[[01]\])?)$/,
  family: /^(couple\.\w+|honoree\.name)$/,
  story: /^photos(\[\d\])?$/,
  eventTimeline: /^(functions(\[\d\]\.[\w.]+)?|function\.[\w.]+|venue\.mapUrl|event\.(startDate|endDate))$/,
  venue: /^(venue\.\w+|function\.venue\.\w+|functions\[\d\]\.venue\.\w+)$/,
  gallery: /^(gallery\.images|photos(\[\d\])?)$/,
  rsvp: /^(guest\.name|event\.title|functions|function\.name|couple\.\w+|honoree\.name)$/,
  announcements: /^announcements$/,
  photoShare: /^(gallery\.images|photos)$/,
  footer: /^(couple\.\w+|honoree\.name|event\.title|photo\.closing)$/,
};
/** Buttons Bulava's sections bring themselves (the reply form, map links). */
const OWN_ACTIONS = /rsvp|reply|respond|map|direction|navigat/;

const LABEL: Record<Exclude<Kind, 'invitation'>, string> = {
  hero: 'hero',
  story: 'story section',
  quote: 'quote section',
  family: 'family section',
  couple: 'couple section',
  countdown: 'countdown',
  eventTimeline: 'schedule',
  venue: 'venue section',
  gallery: 'gallery',
  rsvp: 'RSVP section',
  announcements: 'updates section',
  photoShare: 'photo sharing section',
  menu: 'menu section',
  accommodation: 'stay section',
  travel: 'travel section',
  giftRegistry: 'gifts section',
  footer: 'closing section',
};

/** Words the host writes for a section that shows nothing without them (the catalog's text slots). */
const OWN_WORDS: Partial<Record<SectionKey, Array<[prop: string, slot: string]>>> = {
  story: [['text', 'story']],
  quote: [
    ['text', 'quote'],
    ['by', 'quoteBy'],
  ],
  family: [['text', 'blessings']],
  menu: [['text', 'menu']],
  accommodation: [['text', 'accommodation']],
  travel: [['text', 'travel']],
  giftRegistry: [['text', 'gifts']],
};

/** Text slots' labels and lengths (the catalog's, templates/src/builder.ts SLOTS). */
const SLOT_LABELS: Record<string, [label: string, maxLength: number]> = {
  tagline: ['Tagline', 80],
  story: ['Your story', 1200],
  blessings: ['Blessings / family lines', 600],
  partnerOneParents: ['First partner’s family', 160],
  partnerTwoParents: ['Second partner’s family', 160],
  accommodation: ['Stay details', 600],
  travel: ['Travel details', 600],
  gifts: ['Gift note', 400],
  hashtag: ['Hashtag', 40],
  closing: ['Closing line', 120],
  about: ['About the event', 1200],
  quote: ['A verse or a line from you', 300],
  quoteBy: ['Quote attribution', 80],
  menu: ['Menu (one course per line: Course | dishes)', 1500],
  invitation: ['Invitation line', 300],
};
const MAX_SLOTS = 20;
/** Sections on a page (the definition's limit), and how many warnings and listed bindings a report carries. */
const MAX_SECTIONS = 40;
const MAX_LISTED = 100;
const MAX_WARNINGS = 150;

/** Layouts per section (template-engine SECTION_VARIANTS) the importer chooses among by the JSON's words; artwork and stage heroes need art of their own. */
const VARIANTS: Partial<Record<SectionKey, readonly string[]>> = {
  hero: ['classic', 'arch', 'split', 'photo', 'minimal', 'festive', 'temple', 'monogram', 'cathedral', 'seaside', 'celestial', 'lantern', 'peacock', 'gopuram', 'palace', 'toran', 'arches', 'lotus', 'mandap', 'noir', 'floral', 'balloons', 'backwaters', 'sarovar', 'vrindavan'],
  couple: ['default', 'stacked', 'portraits', 'duet', 'monogram', 'flip', 'profile'],
  family: ['default', 'blessings'],
  story: ['default', 'letter', 'curtain', 'polaroid'],
  eventTimeline: ['cards', 'timeline', 'frames', 'tiles', 'tickets', 'diya'],
  gallery: ['default', 'frames', 'stack', 'mosaic', 'polaroid', 'depth'],
  countdown: ['default', 'flip', 'rings', 'calendar'],
  venue: ['default', 'illustrated', 'postcard'],
  rsvp: ['default', 'card'],
  footer: ['default', 'seal', 'skyline', 'blessing'],
};
/** Heroes that show the cover photo. */
const PHOTO_HEROES = new Set(['photo', 'split', 'noir']);
/** Drawn heroes by the words of a hero's background or style. */
const HERO_WORDS: Array<[RegExp, string]> = [
  [/palace|fort|haveli|mahal/, 'palace'],
  [/gopuram/, 'gopuram'],
  [/temple|kolam/, 'temple'],
  [/mandap/, 'mandap'],
  [/toran/, 'toran'],
  [/mihrab|mughal|arches/, 'arches'],
  [/jharokha|\barch\b/, 'arch'],
  [/lotus/, 'lotus'],
  [/backwater|kerala|houseboat/, 'backwaters'],
  [/sarovar|lake/, 'sarovar'],
  [/vrindavan|krishna/, 'vrindavan'],
  [/cathedral|church|chapel/, 'cathedral'],
  [/\bsea\b|beach|ocean|coast/, 'seaside'],
  [/celestial|moon|starry|night-sky/, 'celestial'],
  [/lantern/, 'lantern'],
  [/peacock/, 'peacock'],
  [/monogram|crest/, 'monogram'],
  [/noir/, 'noir'],
  [/balloon/, 'balloons'],
  [/confetti|festive|party/, 'festive'],
  [/floral|flower|garden|botanical/, 'floral'],
  [/minimal|editorial|modern/, 'minimal'],
];
const LOOK_HERO: Record<LookName, string> = { classic: 'classic', heritage: 'toran', noir: 'noir', royal: 'arch', garden: 'floral', celebration: 'festive', modern: 'minimal', heirloom: 'arch', deckle: 'floral' };

const LOOK_WORDS: Array<[RegExp, LookName]> = [
  [/royal|palace|regal|heirloom|maharaj|rajwada|rajasthan|mughal|nawab|durbar/, 'royal'],
  [/noir|midnight|black-gold/, 'noir'],
  [/heritage|traditional|desi|ethnic/, 'heritage'],
  [/garden|floral|botanical|pastel|blossom/, 'garden'],
  [/party|celebration|confetti|playful|kids|fun\b/, 'celebration'],
  [/modern|minimal|editorial|contemporary/, 'modern'],
];
const ORNAMENT_WORDS: Array<[RegExp, OrnamentNameValue]> = [
  [/mandala/, 'mandala'],
  [/paisley/, 'paisley'],
  [/lotus/, 'lotus'],
  [/peacock/, 'peacock'],
  [/temple|south-indian|gopuram/, 'temple'],
  [/kasavu|kerala/, 'kasavu'],
  [/jaali|lattice|mughal|nikah/, 'jaali'],
  [/marigold|genda/, 'marigold'],
  [/phulkari|punjabi|bagh/, 'bagh'],
  [/rangoli|diya|diwali/, 'rangoli'],
  [/art-deco|\bdeco\b|gatsby/, 'deco'],
  [/cloud|nursery/, 'clouds'],
  [/chapel|church/, 'chapel'],
  [/laurel/, 'laurel'],
  [/confetti/, 'confetti'],
  [/floral|flower|botanical|rose/, 'floral'],
  [/geometric/, 'geometric'],
];
const LOOK_ORNAMENT: Record<LookName, OrnamentNameValue> = { classic: 'none', heritage: 'marigold', noir: 'deco', royal: 'mandala', garden: 'floral', celebration: 'confetti', modern: 'none', heirloom: 'mandala', deckle: 'floral' };
const EFFECT_WORDS: Array<[RegExp, EffectName]> = [
  [/petal/, 'petals'],
  [/marigold/, 'marigold'],
  [/gold-?dust|sparkle|glitter|shimmer/, 'goldDust'],
  [/firefl/, 'fireflies'],
  [/confetti/, 'confetti'],
  [/lantern/, 'lanterns'],
  [/snow/, 'snow'],
];
const INTRO_WORDS: Array<[RegExp, IntroName]> = [
  [/envelope/, 'envelope'],
  [/curtain/, 'curtain'],
  [/door/, 'doors'],
  [/gate/, 'gates'],
  [/seal|wax/, 'seal'],
  [/lantern/, 'lanterns'],
  [/petal/, 'petals'],
  [/celestial|stars/, 'celestial'],
  [/scratch/, 'scratch'],
  [/zip/, 'zipper'],
  [/ribbon/, 'ribbon'],
];

const EYEBROWS: Record<string, string> = { WEDDING: 'template.weddingOf', ENGAGEMENT: 'template.engagementOf', BIRTHDAY: 'template.birthdayOf' };
/** The names line for couples, else the honoree, else the event (templates/src/builder.ts TITLE). */
const NAMES_FALLBACK: Value = { binding: 'honoree.name', fallback: { binding: 'event.title' } };

/** Puts `next` behind `head` as its last fallback (shown when head's bindings are empty). False when head always shows (a literal). */
function chain(head: Value, next: Value): boolean {
  let tail: Value = head;
  while ('binding' in tail || 'template' in tail) {
    if (!tail.fallback) {
      tail.fallback = next;
      return true;
    }
    tail = tail.fallback;
  }
  return false;
}

/** A file or an address where a photo should be: Bulava never loads those (licensed assets and host photos only). */
const IMAGE_FILE = /^(https?:|data:|blob:|\/\/|asset:)|\.(png|jpe?g|webp|gif|svg|avif|heic)(\?.*)?$/i;

// ─────────────────────────── The import ───────────────────────────

/** One value the JSON gives a section (bindings.<key> or the section's own field), read as parts. */
interface Entry {
  key: string;
  flat: string;
  at: string;
  /** Null: not words or bindings (an object, a list of objects). */
  parts: Part[] | null;
  /** The words of a literal value (an asset's name, a style word). */
  words: string;
  used: boolean;
}

interface BuiltSection {
  id: string;
  section: Exclude<Kind, 'invitation'>;
  variant: string;
  props: Record<string, Value>;
}

/** Turns external website JSON into a Bulava website template (see the module comment). Throws a ZodError when it is not website JSON. */
export function importWebsiteJson(input: unknown, options: WebsiteImportOptions = {}): WebsiteImportResult {
  const raw = rec(input);
  const pages = !Array.isArray(raw.sections) && Array.isArray(raw.pages) ? (raw.pages as unknown[]) : null;
  const site = ExternalWebsiteSchema.parse(pages ? { ...raw, sections: pages.flatMap((p) => (Array.isArray(rec(p).sections) ? (rec(p).sections as unknown[]) : [])) } : input) as ExternalWebsite & Record<string, unknown>;
  const warnings: string[] = [];
  const repairs: WebsiteImportRepair[] = [];
  const unknownBindings: WebsiteImportBinding[] = [];
  const standIns: CardImportStandIn[] = [];
  if (pages && pages.length > 1) warnings.push(`The JSON has ${pages.length} pages: Bulava shows their sections on one page, in order.`);

  const design = rec(site.design);
  const themeObj = rec(site.theme);
  const layout = rec(design.layout);

  // ── Names ──
  const name = (options.name ?? str(site.name) ?? str(site.title) ?? 'Imported website').slice(0, 80);
  const key = slugKey(options.key ?? str(site.id) ?? name);
  const category = titleCase(options.category ?? str(site.category) ?? 'Wedding').slice(0, 60);
  const listed = Array.isArray(site.eventTypes) ? [...new Set((site.eventTypes as unknown[]).map(str).filter((e): e is string => !!e && /^[A-Z_]{2,40}$/.test(e)))].slice(0, 8) : [];
  const eventTypes = options.eventTypes?.length ? options.eventTypes : listed.length ? listed : [eventTypeFor(`${str(site.category) ?? ''} ${name}`)];

  // ── Palette: the JSON's colours by role; the roles it leaves out are made from the others ──
  const palette = { ...rec(site.colors), ...rec(themeObj.colors), ...rec(design.colors) };
  const given: Partial<ThemeColors> = {};
  for (const [role, names] of Object.entries(COLOR_NAMES) as Array<[keyof ThemeColors, string[]]>) {
    for (const n of names) {
      const entry = Object.entries(palette).find(([k]) => flat(k) === n);
      if (!entry) continue;
      const hex = normalizeHex(entry[1]);
      if (hex) {
        given[role] = hex;
        break;
      }
      warnings.push(`The colour ${entry[0]} ("${clip(String(entry[1]), 30)}") is not a #rrggbb colour: Bulava makes the ${role} colour from the others.`);
    }
  }
  // The metal (a colour named for one, else an accent of a metal tone) draws the ornaments, frames and
  // dividers: it becomes the secondary, and the JSON's own secondary (or a non-metal accent) the accent.
  const primary = given.primary ?? given.secondary ?? given.accent ?? '#7f1d1d';
  let metal: { name: string; hex: string } | undefined;
  for (const [k, v] of Object.entries(palette)) {
    if (!METAL_NAME.test(flat(k))) continue;
    const hex = normalizeHex(v);
    if (hex) {
      metal = { name: k, hex };
      break;
    }
    warnings.push(`The colour ${k} ("${clip(String(v), 30)}") is not a #rrggbb colour: Bulava makes the secondary colour from the others.`);
  }
  if (!metal && given.accent && isMetalTone(given.accent)) metal = { name: 'accent', hex: given.accent };
  if (metal) {
    const own = given.secondary ?? (given.accent && given.accent !== metal.hex ? given.accent : undefined);
    given.secondary = metal.hex;
    if (own) given.accent = own;
    else delete given.accent;
    warnings.push(
      own
        ? `The metal colour ${metal.name} (${metal.hex}) draws the ornaments, frames and dividers (Bulava’s secondary colour); ${own} is the accent.`
        : `The metal colour ${metal.name} (${metal.hex}) draws the ornaments, frames and dividers (Bulava’s secondary colour).`,
    );
  }
  const background = given.background ?? given.surface ?? '#fffaf0';
  const dark = luminance(background) < 0.3;
  const text = given.text ?? (dark ? '#f8f1e4' : '#2b1b17');
  const colors: ThemeColors = {
    primary,
    secondary: given.secondary ?? given.accent ?? primary,
    accent: given.accent ?? mix(given.secondary ?? primary, '#ffffff', 0.55),
    background,
    surface: given.surface ?? mix(background, '#ffffff', dark ? 0.08 : 0.5),
    text,
    muted: given.muted ?? mix(text, background, 0.45),
  };
  const made = (Object.keys(COLOR_NAMES) as Array<keyof ThemeColors>).filter((role) => !given[role]);
  const roles = made.length > 1 ? `${made.slice(0, -1).join(', ')} or ${made[made.length - 1]}` : made[0];
  if (made.length && made.length < 7) warnings.push(`The JSON gives no ${roles} colour: Bulava made ${made.length > 1 ? 'them' : 'it'} from the palette.`);
  if (made.length === 7) warnings.push('The JSON gives no colours: the palette is Bulava’s own.');

  // ── Style words: the look, the suite every section wears, motion and the opening ──
  const styleWords = [design.theme, themeObj.name, typeof site.theme === 'string' ? site.theme : undefined, design.style, design.mood, layout.borderStyle, layout.style, layout.ornament, site.style, name, site.description]
    .map((w) => (typeof w === 'string' ? kebab(w) : ''))
    .join(' ');
  const look: LookName = LOOK_WORDS.find(([re]) => re.test(styleWords))?.[1] ?? 'classic';
  const ornamentWord = [design.ornament, layout.ornament, layout.borderStyle, design.theme].map((w) => (typeof w === 'string' ? kebab(w) : '')).join(' ');
  const ornament: OrnamentNameValue = ORNAMENT_WORDS.find(([re]) => re.test(ornamentWord))?.[1] ?? LOOK_ORNAMENT[look];
  const motionWords = [layout.motion, layout.effect, design.effect, design.motion, rec(site.options).effect].map((w) => (typeof w === 'string' ? kebab(w) : '')).join(' ');
  const effect: EffectName = EFFECT_WORDS.find(([re]) => re.test(motionWords))?.[1] ?? 'none';
  const introWords = [site.opening, site.intro, design.opening, design.intro, layout.opening, layout.intro, rec(site.options).opening, rec(site.options).intro].map((w) => (typeof w === 'string' ? kebab(w) : '')).join(' ');
  const intro: IntroName = INTRO_WORDS.find(([re]) => re.test(introWords))?.[1] ?? 'none';
  const patternWord = [design.pattern, layout.pattern].map((w) => (typeof w === 'string' ? flat(w) : '')).find((w) => w && (PATTERNS as readonly string[]).includes(w));
  const pattern = (patternWord ?? 'none') as (typeof PATTERNS)[number];
  const radiusRaw = [layout.radius, layout.borderRadius, layout.cornerRadius, design.radius].map((v) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN)).find((v) => Number.isFinite(v));
  const radius = radiusRaw === undefined ? 16 : Math.round(Math.min(48, Math.max(0, radiusRaw)));

  // ── Fonts: heading, body and the script face, the nearest of Bulava's families when the JSON's is not in the library ──
  const typography = { ...rec(site.fonts), ...rec(site.typography), ...rec(themeObj.fonts), ...rec(themeObj.typography), ...rec(design.fonts), ...rec(design.typography) };
  const typeFor = (names: string[]) => {
    for (const n of names) {
      const entry = Object.entries(typography).find(([k]) => flat(k) === n);
      const family = entry ? familyName(entry[1]) : undefined;
      if (family) return family;
    }
    return undefined;
  };
  const requested = {
    heading: typeFor(['heading', 'headings', 'headingfont', 'fontheading', 'title', 'display', 'headline', 'h1']),
    body: typeFor(['body', 'bodyfont', 'fontbody', 'text', 'paragraph', 'base', 'copy']),
    script: typeFor(['accent', 'script', 'accentfont', 'fontaccent', 'scriptfont', 'fontscript', 'decorative', 'calligraphy', 'names', 'handwriting']),
  };
  const fonts: WebsiteImportFont[] = [];
  const pickFont = (role: WebsiteImportFont['role'], want: string | undefined, fallback: FontFamily): FontFamily => {
    const family = want ? (nearestFamily(want) ?? fallback) : fallback;
    const substituted = !!want && FAMILY_BY_NAME.get(flat(want)) !== family;
    fonts.push({ role, requested: want ?? null, family, substituted });
    if (substituted) warnings.push(`The font "${want}" is not in Bulava’s library: "${family}" is used for the ${role === 'script' ? 'script lines' : role === 'heading' ? 'headings' : 'body text'} (the nearest).`);
    return family;
  };
  let heading = pickFont('heading', requested.heading, 'Playfair Display');
  let body = pickFont('body', requested.body, 'Noto Sans');
  let script = requested.script ? pickFont('script', requested.script, 'Great Vibes') : undefined;
  // A script face reads as names, not paragraphs: it becomes the script role and the heading and body take book faces.
  if (SCRIPT_FACES.has(heading)) {
    script ??= heading;
    warnings.push(`"${heading}" is a script face: it writes the names, and the headings use "Playfair Display".`);
    heading = 'Playfair Display';
    fonts.find((f) => f.role === 'heading')!.family = heading;
  }
  if (SCRIPT_FACES.has(body)) {
    warnings.push(`"${body}" is a script face and too ornate for paragraphs: the body text uses "Cormorant Garamond".`);
    body = 'Cormorant Garamond';
    fonts.find((f) => f.role === 'body')!.family = body;
  }
  const fontRef = (family: FontFamily, deva: FontFamily): { family: FontFamily; scripts: string[]; fallbacks: Record<string, FontFamily> } =>
    DEVA_FACES.has(family) ? { family, scripts: ['Latn', 'Deva'], fallbacks: {} } : { family, scripts: ['Latn'], fallbacks: { Deva: deva } };
  const serifDeva = (f: FontFamily): FontFamily => (SERIF_FACES.has(f) ? 'Noto Serif Devanagari' : 'Noto Sans Devanagari');

  // ── Bindings: parse, repair and report ──
  const slots = new Map<string, [string, number]>();
  const declare = (slot: string, at: string): boolean => {
    if (slots.has(slot)) return true;
    if (slots.size >= MAX_SLOTS) {
      warnings.push(`${at}: a template has at most ${MAX_SLOTS} text fields: {{custom.${slot}}} was left out.`);
      return false;
    }
    slots.set(slot, ownEntry(SLOT_LABELS, slot) ?? [titleCase(slot).slice(0, 60), 600]);
    return true;
  };
  const seen = new Set<string>();
  const repair = (at: string, where: string, from: string, to: string, why: string) => {
    if (seen.has(`r\u0000${at}\u0000${from}`)) return;
    seen.add(`r\u0000${at}\u0000${from}`);
    repairs.push({ at, from: clip(from, 120), to });
    warnings.push(`${where}: "${clip(from, 120)}" ${why}: read as ${to}.`);
  };
  const unknown = (at: string, where: string, binding: string) => {
    if (seen.has(`u\u0000${at}\u0000${binding}`)) return;
    seen.add(`u\u0000${at}\u0000${binding}`);
    unknownBindings.push({ at, binding: clip(binding, 120) });
    warnings.push(`${where}: {{${clip(binding, 120)}}} is not one of Bulava’s bindings: it was left out.`);
  };

  /** A JSON string as words and bindings, every binding repaired to Bulava's name or reported. */
  const parse = (value: string, at: string, where: string): Part[] => {
    const s = value.slice(0, 2000);
    const bare = s.trim();
    // A whole value that is a bare binding path ("venue.mapUrl").
    if (!/[{}\s]/.test(bare) && /^[A-Za-z_]\w*(\.\w+|\[\d+\])+$/.test(bare)) {
      const known = knownBinding(bare);
      if (known) {
        repair(at, where, bare, `{{${known.path}}}`, 'has no braces');
        return [{ path: known.path, ...(known.slot ? { slot: known.slot } : {}) }];
      }
    }
    const parts: Part[] = [];
    let last = 0;
    for (const m of s.matchAll(TOKEN)) {
      const open = m[1]?.length ?? 0;
      const close = (m[1] !== undefined ? m[4] : m[7])?.length ?? 0;
      const rawPath = (m[2] ?? m[5] ?? '').replace(/\s+/g, '');
      const rawFormat = m[3] ?? m[6];
      if (m.index > last) parts.push({ text: s.slice(last, m.index) });
      last = m.index + m[0].length;
      const token = m[0].trim();
      const known = knownBinding(rawPath);
      if (!known) {
        unknown(at, where, rawPath);
        continue;
      }
      const format = rawFormat ? ownEntry(FORMAT_ALIASES, flat(rawFormat)) : undefined;
      const fixed = `{{${known.path}${format ? `|${format}` : ''}}}`;
      const why =
        open === 2 && close < 2
          ? close === 1
            ? 'was missing a closing brace'
            : 'was missing its closing braces'
          : open < 2 && close === 2
            ? open === 1
              ? 'was missing an opening brace'
              : 'was missing its opening braces'
            : open === 1 && close === 1
              ? 'had single braces'
              : open !== 2 || close !== 2
                ? 'had extra braces'
                : known.path !== rawPath
                  ? `is not Bulava’s name for ${known.path}`
                  : rawFormat && format !== rawFormat
                    ? format
                      ? `has a format Bulava calls ${format}`
                      : 'has a format Bulava does not have'
                    : null;
      if (why) repair(at, where, token, fixed, why);
      parts.push({ path: known.path, ...(format ? { format } : {}), ...(known.slot ? { slot: known.slot } : {}) });
    }
    if (last < s.length) parts.push({ text: s.slice(last) });
    return parts;
  };

  /** A section's values: its bindings (or content, props, data) and its own fields. */
  const entriesOf = (s: Record<string, unknown>, base: string, where: string): Entry[] => {
    const out: Entry[] = [];
    const add = (k: string, v: unknown, at: string) => {
      if (typeof v === 'boolean') return;
      const o = rec(v);
      const value = Array.isArray(v) ? v.map(str).filter(Boolean).join('\n') : (str(v) ?? str(o.binding) ?? str(o.value) ?? str(o.text) ?? str(o.template) ?? str(o.src) ?? str(o.url));
      out.push({ key: k, flat: flat(k), at, parts: value ? parse(value, at, where) : null, words: value && !/[{}]/.test(value) ? value : '', used: false });
    };
    for (const group of ['bindings', 'content', 'props', 'data']) for (const [k, v] of Object.entries(rec(s[group]))) add(k, v, `${base}.${group}.${k}`);
    for (const k of ['title', 'subtitle', 'heading', 'text', 'description', 'message', 'tagline', 'quote', 'story', 'image', 'photo', 'background', 'hashtag', 'source', 'items']) {
      if (s[k] !== undefined && !out.some((e) => e.flat === flat(k))) add(k, s[k], `${base}.${k}`);
    }
    return out;
  };

  // ── Assets: the photo places ──
  const assetsRaw = site.assets;
  const assetEntries: Array<[string, unknown]> = Array.isArray(assetsRaw)
    ? assetsRaw.map((a, i) => [str(rec(a).id) ?? str(rec(a).key) ?? str(rec(a).name) ?? str(rec(a).role) ?? String(i), rec(a).src ?? rec(a).url ?? rec(a).value ?? rec(a).binding ?? a])
    : Object.entries(rec(assetsRaw));
  const assetPhotos: Array<{ asset: string; binding: string; at: string }> = [];
  /** An asset that names the same photo twice lists it once. */
  const listedPhotos = new Set<string>();
  /** An asset's own photo binding, by its key: "cover" → photo.cover. */
  const assetBinding = new Map<string, string>();
  for (const [asset, value] of assetEntries) {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((v, i) => {
      const at = `assets.${asset}${Array.isArray(value) ? `.${i}` : ''}`;
      const s = str(v) ?? str(rec(v).src) ?? str(rec(v).url) ?? str(rec(v).binding);
      if (!s) return;
      if (!/[{}]/.test(s) && IMAGE_FILE.test(s)) {
        standIns.push({ element: at, source: clip(s), drawnAs: null });
        warnings.push(`${at} is an image file (${clip(s, 40)}), not a host photo or a licensed asset: it was left out. Bind it to a host photo ({{photo.cover}} …) or add the licensed image in the Studio.`);
        return;
      }
      const refs = parse(s, at, at).filter((p): p is Extract<Part, { path: string }> => 'path' in p);
      for (const ref of refs) {
        const type = bindingType(ref.path);
        if (type === 'image' || type === 'list') {
          if (listedPhotos.has(`${asset}:${ref.path}`)) continue;
          listedPhotos.add(`${asset}:${ref.path}`);
          assetPhotos.push({ asset, binding: ref.path, at });
          if (type === 'image' && !assetBinding.has(flat(asset))) assetBinding.set(flat(asset), ref.path);
        } else {
          warnings.push(`${at}: {{${ref.path}}} is not a photo: it was left out of the photo places.`);
        }
      }
    });
  }
  /** "palace-cover", "cover" or "{{photo.cover}}": the photo an image value names (one of the assets, by its key or one of its words). */
  const photoNamed = (words: string): string | undefined => assetBinding.get(flat(words)) ?? kebab(words).split('-').map((w) => assetBinding.get(w)).find(Boolean);

  // ── Hidden sections (visible: false, or options.showX: false) ──
  const hiddenKinds = new Set<Kind>();
  for (const [k, v] of Object.entries(rec(site.options))) {
    const m = /^show(.+?)(?:section)?$/i.exec(k);
    const kind = m && (v === false || v === 'false') ? kindOf(m[1]!) : null;
    if (kind && kind !== 'hero') hiddenKinds.add(kind);
  }

  // ── Sections ──
  const report: WebsiteImportSection[] = [];
  const built: BuiltSection[] = [];
  const ids = new Set<string>();
  const sectionId = (raw: string) => {
    let base = kebab(raw).slice(0, 56) || 'section';
    if (!/^[a-z0-9]/.test(base)) base = `s-${base}`;
    let id = base;
    for (let k = 2; ids.has(id); k++) id = `${base}-${k}`;
    ids.add(id);
    return id;
  };
  let maxPhoto = -1;
  const photoIndex = (path: string) => {
    const m = /^photos\[(\d+)\]$/.exec(path);
    if (m) maxPhoto = Math.max(maxPhoto, Number(m[1]));
  };
  for (const p of assetPhotos) photoIndex(p.binding);

  site.sections.forEach((sec, i) => {
    const s = rec(sec);
    const type = sectionType(s);
    const from = str(s.id) ?? (kebab(type) || `section-${i + 1}`);
    const before = built.length;
    const where = flat(from) === flat(type) ? `"${from}"` : `"${from}" (${type})`;
    const base = `sections.${i}`;
    const kind = kindOf(type) ?? kindOf(from);
    const row = (over: Partial<WebsiteImportSection>): WebsiteImportSection => ({ from, type, id: null, section: null, variant: null, skipped: null, ...over });
    const hidden = s.visible === false || s.visible === 'false' || s.hidden === true || s.enabled === false || (kind !== null && hiddenKinds.has(kind));
    if (hidden && kind !== 'hero') {
      report.push(row({ skipped: 'hidden' }));
      warnings.push(`${where} is hidden in the JSON: it was left out.`);
      return;
    }
    if (hidden) warnings.push(`${where} is hidden in the JSON, but the opening section always shows: it was kept.`);
    if (!kind) {
      report.push(row({ skipped: 'unknown' }));
      warnings.push(`${where}: Bulava has no section of this kind: it was left out.`);
      return;
    }
    if ((kind === 'hero' || kind === 'rsvp') && built.some((b) => b.section === kind)) {
      report.push(row({ skipped: 'duplicate' }));
      warnings.push(`${where}: the page already has ${kind === 'hero' ? 'an opening section' : 'an RSVP section'}: this one was left out.`);
      return;
    }
    const entries = entriesOf(s, base, where);
    const words = [kebab(type), ...['variant', 'layout', 'style', 'background'].map((k) => (typeof s[k] === 'string' ? kebab(s[k] as string) : ''))].join(' ');
    /** An image file or address (never loaded): listed as an image that needs a host photo or a licensed asset. */
    const imageFile = (e: Entry) => {
      standIns.push({ element: e.at, source: clip(e.words.trim()), drawnAs: null });
      warnings.push(`${where}: ${e.key} is an image file (${clip(e.words.trim(), 40)}), not a host photo or a licensed asset: it was left out. Bind it to a host photo ({{photo.cover}} …) or add the licensed image in the Studio.`);
      e.used = true;
    };

    /** A value for a prop from an entry, its text slots declared (null: the entry cannot fill this prop). */
    const valueOf = (e: Entry, type: PropType): Value | null => {
      if (!e.parts) return null;
      const refs = e.parts.filter((p): p is Extract<Part, { path: string }> => 'path' in p);
      const words = e.parts
        .filter((p): p is { text: string } => 'text' in p)
        .map((p) => p.text)
        .join('');
      if (type === 'image') {
        const ref = refs.length === 1 && !words.trim() ? refs[0]! : undefined;
        if (ref && bindingType(ref.path) === 'image') {
          photoIndex(ref.path);
          return { binding: ref.path };
        }
        if (!refs.length && e.words) {
          const photo = photoNamed(e.words);
          if (photo) {
            photoIndex(photo);
            return { binding: photo };
          }
          if (IMAGE_FILE.test(e.words.trim())) imageFile(e);
        }
        return null;
      }
      if (refs.some((r) => bindingType(r.path) === 'list' || bindingType(r.path) === 'image')) return null;
      const usable = refs.filter((r) => !r.slot || declare(r.slot, where));
      const kept = e.parts.filter((p) => !('path' in p) || usable.includes(p));
      const timeOf = (r: Extract<Part, { path: string }>): ValueFormat | undefined => r.format ?? (bindingType(r.path) === 'datetime' ? (/\.time$/.test(r.path) ? 'time' : 'date') : undefined);
      if (usable.length === 1 && !words.trim()) {
        const r = usable[0]!;
        const format = timeOf(r);
        return { binding: r.path, ...(format ? { format } : {}) };
      }
      if (usable.length) {
        // Runs of spaces where a binding was left out close up.
        const template = kept
          .map((p) => ('path' in p ? `{{${p.path}${timeOf(p) ? `|${timeOf(p)}` : ''}}}` : p.text))
          .join('')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
        return { template };
      }
      const literal = words.replace(/[ \t]{2,}/g, ' ').trim();
      return literal ? { literal: literal.slice(0, 2000) } : null;
    };

    /** The section's props from its entries, by the PROPS table (a second value for a prop becomes the first's fallback). */
    const fill = (section: Exclude<Kind, 'invitation'>, only?: (e: Entry) => boolean): Record<string, Value> => {
      const props: Record<string, Value> = {};
      for (const [prop, type, keys] of PROPS[section]) {
        for (const k of keys) {
          for (const e of entries.filter((x) => !x.used && x.flat === k && (!only || only(x)))) {
            const value = valueOf(e, type);
            if (!value) continue;
            const current = props[prop];
            if (!current) {
              props[prop] = value;
              e.used = true;
            } else if (chain(current, value)) {
              e.used = true;
            }
          }
        }
      }
      return props;
    };

    const variantOf = (section: Exclude<Kind, 'invitation'>, props: Record<string, Value>): string => {
      const list = VARIANTS[section];
      if (!list) return 'default';
      const named = list.find((v) => v !== 'default' && new RegExp(`(^|[^a-z])${v}([^a-z]|$)`).test(words));
      if (named) return named;
      if (section === 'family') return props.partnerOneParents || props.partnerTwoParents ? 'blessings' : 'default';
      if ((look === 'royal' || look === 'heritage') && section === 'footer') return 'seal';
      if ((look === 'royal' || look === 'heritage') && section === 'rsvp') return 'card';
      return list[0]!;
    };

    const emit = (section: Exclude<Kind, 'invitation'>, idRaw: string, props: Record<string, Value>, variant?: string) => {
      for (const [prop, slot] of OWN_WORDS[section] ?? []) if (!props[prop] && declare(slot, where)) props[prop] = { binding: `custom.${slot}` };
      const id = sectionId(idRaw);
      const v = variant ?? variantOf(section, props);
      built.push({ id, section, variant: v, props });
      report.push(row({ id, section, variant: v }));
    };

    if (kind === 'hero') {
      const props = fill('hero');
      const photo = props.image && 'binding' in props.image ? props.image.binding : undefined;
      const explicit = ['variant', 'layout', 'style'].map((k) => (typeof s[k] === 'string' ? flat(s[k] as string) : '')).find((w) => w && VARIANTS.hero!.includes(w));
      const scene = HERO_WORDS.find(([re]) => re.test(words))?.[1];
      const variant = explicit ?? (photo ? (/full|bleed|overlay|fullscreen|parallax/.test(words) ? 'photo' : 'split') : (scene ?? LOOK_HERO[look]));
      if (photo && !explicit && scene && !PHOTO_HEROES.has(scene)) {
        warnings.push(`${where}: its background names the cover photo ({{${photo}}}), so the hero shows it beside the names (Bulava’s split hero); Bulava’s drawn ${scene} hero is another choice in the Studio.`);
      }
      // The background's words chose the hero: they need no place of their own.
      for (const e of entries) if (!e.used && e.flat === 'background' && e.words && !IMAGE_FILE.test(e.words)) e.used = true;
      // The names line for couples, else the honoree or the event; the date as a date.
      const title: Value = props.title ?? { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: NAMES_FALLBACK };
      props.title = ('template' in title || 'binding' in title) && !title.fallback && bindingsIn(title).every((b) => b.startsWith('couple.')) ? { ...title, fallback: NAMES_FALLBACK } : title;
      props.date ??= { binding: 'event.startDate', format: 'date' };
      props.eyebrow ??= { t: ownEntry(EYEBROWS, eventTypes[0] ?? '') ?? 'template.celebrateWith' };
      if (props.image && 'binding' in props.image && props.image.binding === 'photo.cover' && !props.image.fallback) props.image = { binding: 'photo.cover', fallback: { binding: 'photos[0]' } };
      emit('hero', from, props, variant);
    } else if (kind === 'invitation') {
      // An invitation's words become a story section (its title as the heading), its verse a quote section.
      const story = fill('story', (e) => !QUOTE_KEYS.has(e.flat));
      const quote = fill('quote', (e) => QUOTE_KEYS.has(e.flat));
      if (story.text || story.heading || !quote.text) {
        if (!story.text && declare('invitation', where)) story.text = { binding: 'custom.invitation' };
        emit('story', from, story, 'default');
      }
      if (quote.text) emit('quote', story.text || story.heading ? `${from}-quote` : from, quote);
    } else if (kind === 'travel' || kind === 'accommodation') {
      // Travel and a stay are two sections in Bulava: each takes its own words.
      const hasStay = entries.some((e) => STAY_KEYS.has(e.flat));
      const hasTravel = entries.some((e) => TRAVEL_KEYS.has(e.flat));
      const both = hasStay && hasTravel;
      const stayFirst = both && entries.findIndex((e) => STAY_KEYS.has(e.flat)) < entries.findIndex((e) => TRAVEL_KEYS.has(e.flat));
      const own = (k: 'travel' | 'accommodation') => fill(k, (e) => !(k === 'travel' ? STAY_KEYS : TRAVEL_KEYS).has(e.flat));
      const order: Array<'travel' | 'accommodation'> = both ? (stayFirst ? ['accommodation', 'travel'] : ['travel', 'accommodation']) : [hasStay ? 'accommodation' : hasTravel ? 'travel' : kind];
      for (const k of order) emit(k, order.length > 1 && k !== kind ? `${from}-${k === 'accommodation' ? 'stay' : 'travel'}` : from, own(k));
    } else {
      const props = fill(kind);
      if (kind === 'story' && props.image && 'binding' in props.image && props.image.binding === 'photo.story' && !props.image.fallback) props.image = { binding: 'photo.story', fallback: { binding: 'photos[1]' } };
      emit(kind, from, props);
    }

    // What the JSON gives that has no place: shown by the section itself, or reported.
    const shownBy = built.slice(before).map((b) => SHOWS[b.section]);
    const sectionLabel = kind === 'invitation' ? 'story and quote sections' : LABEL[kind];
    for (const e of entries) {
      if (e.used || !e.parts) continue;
      const refs = e.parts.filter((p): p is Extract<Part, { path: string }> => 'path' in p);
      for (const r of refs) photoIndex(r.path);
      if (refs.length && refs.every((r) => shownBy.some((re) => re?.test(r.path)))) continue;
      if (!refs.length && IMAGE_FILE.test(e.words.trim())) {
        imageFile(e);
        continue;
      }
      // A section's own background words chose its layout; its source is the list it shows.
      if (!refs.length && (e.flat === 'source' || e.flat === 'background' || !e.words.trim())) continue;
      const what = refs.length ? refs.map((r) => `{{${r.path}}}`).join(' ') : `"${clip(e.words.trim(), 40)}"`;
      warnings.push(`${where}: ${e.key} (${what}) has no place in Bulava’s ${sectionLabel}: it was left out.`);
    }
    const actions = (Array.isArray(s.actions) ? s.actions : []).map((a) => str(a) ?? str(rec(a).type) ?? str(rec(a).action)).filter((a): a is string => !!a);
    const missing = actions.filter((a) => !OWN_ACTIONS.test(a.toLowerCase()));
    if (missing.length) warnings.push(`${where}: Bulava’s ${sectionLabel} has no button for ${missing.join(', ')}: ${missing.length > 1 ? 'they were' : 'it was'} left out.`);
  });

  // The page opens on its hero: the JSON's, moved to the top, or Bulava's own.
  const heroAt = built.findIndex((b) => b.section === 'hero');
  if (heroAt > 0) {
    built.unshift(...built.splice(heroAt, 1));
    warnings.push('The opening section was not first in the JSON: it opens the page now.');
  } else if (heroAt < 0) {
    const id = sectionId('hero');
    built.unshift({
      id,
      section: 'hero',
      variant: LOOK_HERO[look],
      props: { eyebrow: { t: ownEntry(EYEBROWS, eventTypes[0] ?? '') ?? 'template.celebrateWith' }, title: { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: NAMES_FALLBACK }, date: { binding: 'event.startDate', format: 'date' } },
    });
    report.unshift({ from: '—', type: 'hero', id, section: 'hero', variant: LOOK_HERO[look], skipped: null });
    warnings.push('The JSON has no opening section: Bulava’s own opens the page (the names and the date).');
  }
  // A page holds at most MAX_SECTIONS sections (the definition's limit): the rest are left out, in the JSON's order.
  if (built.length > MAX_SECTIONS) {
    const dropped = built.splice(MAX_SECTIONS);
    for (const b of dropped) {
      const r = report.find((x) => x.id === b.id);
      if (r) Object.assign(r, { id: null, section: null, variant: null, skipped: 'limit' as const });
    }
    warnings.push(`A page holds at most ${MAX_SECTIONS} sections: the last ${dropped.length} were left out.`);
  }

  // ── Photo places: the spots a section shows, and what became of the assets' ──
  const shown = new Set<string>();
  for (const b of built) {
    const showsImage = (b.section === 'hero' && PHOTO_HEROES.has(b.variant)) || b.section === 'story';
    if (showsImage) for (const path of bindingsIn(b.props.image)) shown.add(path);
    if (b.section === 'couple') shown.add('photo.partnerOne').add('photo.partnerTwo');
    if (b.section === 'footer') shown.add('photo.closing');
    if (b.section === 'gallery') shown.add('gallery.images').add('photos');
  }
  const photoSlots = PHOTO_SLOTS.filter((slot) => shown.has(`photo.${slot}`));
  const usesPhotos = shown.has('photos') || [...shown].some((p) => p.startsWith('photos['));
  const photos: WebsiteImportPhoto[] = assetPhotos.map(({ asset, binding }) => {
    const slot = binding.startsWith('photo.') ? binding.slice(6) : binding === 'gallery.images' ? 'gallery' : 'photos';
    const isShown = binding.startsWith('photo.') ? shown.has(binding) : binding === 'gallery.images' ? shown.has('gallery.images') : usesPhotos;
    return { asset, binding, slot, shown: isShown };
  });
  const WHERE_SHOWN: Record<string, string> = {
    cover: 'in a photo or split hero',
    partnerOne: 'in a couple section',
    partnerTwo: 'in a couple section',
    story: 'beside the story',
    closing: 'in the closing section',
    gallery: 'in a gallery section',
    photos: 'in the gallery, the hero or the story',
  };
  for (const p of photos) {
    if (!p.shown) warnings.push(`The JSON’s ${p.asset} photo ({{${p.binding}}}) has no place on this page: Bulava shows it ${WHERE_SHOWN[p.slot] ?? 'in a section that shows photos'}.`);
  }

  const description = str(site.description);
  const definition: TemplateDefinitionInput = {
    schemaVersion: 1,
    templateKey: key,
    type: 'WEBSITE',
    name,
    ...(description ? { description: description.slice(0, 500) } : {}),
    eventTypes,
    languages: ['en', 'hi', 'hi-Latn'],
    theme: { colors, radius, ornament, pattern, heroTone: dark ? 'dark' : 'light', look, effect },
    fonts: {
      heading: fontRef(heading, serifDeva(heading)),
      body: fontRef(body, serifDeva(body)),
      ...(script ? { script: fontRef(script, 'Tiro Devanagari Hindi') } : {}),
    },
    capabilities: {
      editable: { colors: true, fonts: true, music: false, background: false, layout: true, photos: true, text: true, animation: true },
      textSlots: [...slots].map(([k, [label, maxLength]]) => ({ key: k, label, maxLength })),
      maxPhotos: Math.min(50, Math.max(6, maxPhoto + 1)),
      photoSlots,
    },
    website: {
      intro,
      pages: [{ id: 'home', sections: built.map((b) => ({ id: b.id, section: b.section, variant: b.variant, props: b.props })) }],
    },
  };

  // A report a person reads: each list and the warnings stop at a length, and say how many more there were.
  const unique = [...new Set(warnings)];
  const moreOf = (n: number, what: string) => (n > MAX_LISTED ? [`${n - MAX_LISTED} more ${what} are not listed.`] : []);
  const notes = [...unique.slice(0, MAX_WARNINGS), ...(unique.length > MAX_WARNINGS ? [`${unique.length - MAX_WARNINGS} more warnings are not listed.`] : []), ...moreOf(repairs.length, 'repaired bindings'), ...moreOf(unknownBindings.length, 'unknown bindings'), ...moreOf(standIns.length, 'image files')];
  return { key, name, category, eventTypes, definition, sections: report, fonts, repairs: repairs.slice(0, MAX_LISTED), photos: photos.slice(0, MAX_LISTED), unknownBindings: unknownBindings.slice(0, MAX_LISTED), standIns: standIns.slice(0, MAX_LISTED), warnings: notes };
}

// ─────────────────────────── Either kind ───────────────────────────

export type DesignJsonKind = 'card' | 'website';

/** Card JSON has a canvas and a list of elements; website JSON a list of sections (on a page or at the top). Null: neither. */
export function designJsonKind(input: unknown): DesignJsonKind | null {
  const o = rec(input);
  if (Array.isArray(o.elements) || (o.canvas !== undefined && !Array.isArray(o.sections))) return 'card';
  if (Array.isArray(o.sections) || (Array.isArray(o.pages) && o.pages.some((p) => Array.isArray(rec(p).sections)))) return 'website';
  return null;
}

/** Design JSON that is neither shape, or not the shape it looks like: `issues` say what is missing. */
export class DesignImportError extends Error {
  constructor(
    message: string,
    readonly issues: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'DesignImportError';
  }
}

export type DesignImportResult = ({ kind: 'card' } & CardImportResult) | ({ kind: 'website' } & WebsiteImportResult);

const zodIssues = (error: z.ZodError) => error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message }));

/**
 * Card JSON (a canvas and a list of elements) or website JSON (a list of
 * sections, usually with design and assets), told apart and imported.
 * `kind` insists on one. Throws a DesignImportError naming the shapes when
 * the JSON is neither, or not the one it looks like.
 */
export function importDesignJson(input: unknown, options: CardImportOptions & { kind?: DesignJsonKind } = {}): DesignImportResult {
  const { kind: wanted, ...rest } = options;
  const kind = wanted ?? designJsonKind(input);
  try {
    if (kind === 'card') return { kind, ...importCardJson(input, rest) };
    if (kind === 'website') return { kind, ...importWebsiteJson(input, rest) };
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    throw new DesignImportError(
      kind === 'card' ? 'This is not card JSON: it needs a canvas and a list of elements.' : 'This is not website JSON: it needs a list of sections, each with a type.',
      zodIssues(error),
    );
  }
  throw new DesignImportError('This is neither card JSON nor website JSON. Card JSON has a canvas and a list of elements; website JSON has a list of sections (and usually design and assets).', [
    { path: 'canvas', message: 'Card JSON needs a canvas (width, height, background)' },
    { path: 'elements', message: 'Card JSON needs a list of elements (text, image, rect…)' },
    { path: 'sections', message: 'Website JSON needs a list of sections, each with a type (hero, venue, rsvp…)' },
  ]);
}
