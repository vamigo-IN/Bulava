import type { PhotoSlot } from './definition';
import { faithFromTags, type Faith } from './faith';
import { samplePhoto, samplePhotoSet } from './sample-photos';
import { SAMPLE_VERSES, samplePeople, samplePreset } from './sample-presets';
/**
 * RenderContext: the data a template may bind to. Built by the API AFTER
 * authorization, so it only ever contains what the viewer may see.
 * guest.* is present only for personalized (invitation) renders.
 */

export interface VenueContext {
  name: string;
  address: string | null;
  city: string | null;
  mapUrl: string | null;
  /** Google Maps embed (set when the Super Admin enables maps on invitations). */
  embedUrl?: string | null;
}

export interface FunctionContext {
  id: string;
  name: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  venue: VenueContext | null;
}

export interface GalleryImage {
  url: string;
  thumbUrl: string;
  width?: number | null;
  height?: number | null;
}

export interface RenderContext {
  event: {
    title: string;
    description: string | null;
    typeKey: string;
    startDate: string | null;
    endDate: string | null;
    language: string;
    timezone: string;
  };
  couple?: {
    partnerOne: string;
    partnerTwo: string;
    brideName: string;
    groomName: string;
    /** Their parents, when the host named them (event details). */
    partnerOneFather?: string;
    partnerOneMother?: string;
    partnerTwoFather?: string;
    partnerTwoMother?: string;
    /** Each partner's parents in one line, in their tradition's order (`mothersFirst`): "Mother & Father" (Hindu, Sikh) or "Father & Mother" (Muslim, Christian). */
    partnerOneParents?: string;
    partnerTwoParents?: string;
  };
  honoree?: { name: string };
  functions: FunctionContext[];
  /** The "current" function for per-function scenes/sections (defaults to the first). */
  function?: FunctionContext;
  venue?: VenueContext;
  guest?: { name: string };
  gallery: { images: GalleryImage[] };
  photos: GalleryImage[];
  /** Photos the customer placed in named spots (customization.photoSlots). */
  photoSlots?: Partial<Record<PhotoSlot, GalleryImage>>;
  custom: Record<string, string>;
  announcements?: Array<{ title: string; body: string; publishedAt: string | null }>;
  /** Background music for website invitations (a licensed track, signed URL). */
  music?: { url: string; title: string } | null;
  /**
   * URLs for the template's artwork assets, keyed by asset id. Renderers that
   * cannot use the public asset route supply these (the video worker signs
   * them; Template Studio previews unpublished art). Otherwise the engine uses
   * /api/v1/public/template-assets/:id.
   */
  assets?: Record<string, string>;
}

/**
 * Whether a family's tradition names the mother first among a partner's
 * parents (ADR-068): Hindu and Sikh invitations do ("Smt. Sunita & Shri Rajesh
 * Sharma"), Muslim and Christian ones name the father first ("Mr. Javed &
 * Mrs. Shabana Siddiqui"). Designs of no one faith follow the Hindu order.
 */
export function mothersFirst(faith: Faith | null | undefined): boolean {
  return faith !== 'muslim' && faith !== 'christian';
}

/**
 * The couple's parents from the event details (ADR-068): each name, and each
 * partner's parents as one line in the order the design's tradition writes
 * them (`faith`: the template's `theme.faith`).
 */
export function coupleParents(details: Record<string, unknown>, faith?: Faith | null): Partial<NonNullable<RenderContext['couple']>> {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const out: Partial<NonNullable<RenderContext['couple']>> = {};
  for (const side of ['partnerOne', 'partnerTwo'] as const) {
    const father = str(details[`${side}Father`]);
    const mother = str(details[`${side}Mother`]);
    if (father) out[`${side}Father`] = father;
    if (mother) out[`${side}Mother`] = mother;
    const line = (mothersFirst(faith) ? [mother, father] : [father, mother]).filter(Boolean).join(' & ');
    if (line) out[`${side}Parents`] = line;
  }
  return out;
}

/** The templates' family text slots (custom.partnerOneParents / partnerTwoParents), filled from the parents. */
function parentSlots(parents: Partial<NonNullable<RenderContext['couple']>>): Record<string, string> {
  const out: Record<string, string> = {};
  if (parents.partnerOneParents) out.partnerOneParents = parents.partnerOneParents;
  if (parents.partnerTwoParents) out.partnerTwoParents = parents.partnerTwoParents;
  return out;
}

/** Build a RenderContext from plain event data (used by API and previews). */
export function buildRenderContext(input: {
  event: RenderContext['event'];
  details?: Record<string, unknown> | null;
  functions: FunctionContext[];
  guestName?: string | null;
  gallery?: GalleryImage[];
  photos?: GalleryImage[];
  photoSlots?: RenderContext['photoSlots'];
  custom?: Record<string, string>;
  announcements?: RenderContext['announcements'];
  music?: RenderContext['music'];
  assets?: RenderContext['assets'];
  /** The design's tradition (`theme.faith`): the order of the parents' names. */
  faith?: Faith | null;
}): RenderContext {
  const d = input.details ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const p1 = str(d.partnerOne);
  const p2 = str(d.partnerTwo);
  const honoree = str(d.name);
  const first = input.functions[0];
  const parents = coupleParents(d, input.faith);
  return {
    event: input.event,
    ...(p1 && p2 ? { couple: { partnerOne: p1, partnerTwo: p2, brideName: p1, groomName: p2, ...parents } } : {}),
    ...(honoree ? { honoree: { name: honoree } } : {}),
    functions: input.functions,
    ...(first ? { function: first } : {}),
    ...(first?.venue ? { venue: first.venue } : {}),
    ...(input.guestName ? { guest: { name: input.guestName } } : {}),
    gallery: { images: input.gallery ?? [] },
    photos: input.photos ?? [],
    ...(input.photoSlots && Object.keys(input.photoSlots).length ? { photoSlots: input.photoSlots } : {}),
    // The parents' lines fill the templates' family slots unless the host wrote their own there.
    custom: { ...(p1 && p2 ? parentSlots(parents) : {}), ...(input.custom ?? {}) },
    ...(input.announcements ? { announcements: input.announcements } : {}),
    ...(input.music ? { music: input.music } : {}),
    ...(input.assets && Object.keys(input.assets).length ? { assets: input.assets } : {}),
  };
}

type SampleOverrides = Partial<{
  language: string;
  longNames: boolean;
  noPhotos: boolean;
  typeKey: string;
  tags: readonly string[];
  seed: string;
  faith: Faith | null;
  /** Where the sample photos are served from (SAMPLE_PHOTO_BASE); renderers without the apps' files pass an origin. */
  photoBase: string;
}>;

/**
 * The sample a template previews with: its own people, chosen by its key, of
 * its tradition (the theme's faith, else its tags'). Every catalog preview,
 * editor and test uses it, so a template always shows the same names.
 */
export function templateSampleContext(definition: { templateKey: string; theme: { faith?: Faith } }, overrides: Omit<SampleOverrides, 'seed' | 'faith'> = {}): RenderContext {
  return sampleRenderContext({ ...overrides, seed: definition.templateKey, faith: definition.theme.faith ?? faithFromTags(overrides.tags) });
}

/** A long guest name per tradition, for the test matrix's long-name case. */
const LONG_GUESTS: Record<Faith, string> = {
  hindu: 'Mr. & Mrs. Ramachandran Iyer and Family',
  muslim: 'Mr. & Mrs. Mohammed Arif Qureshi and Family',
  sikh: 'S. Gurmeet Singh & Sardarni Harpreet Kaur and Family',
  christian: 'Mr. & Mrs. Anthony Joseph Rodrigues and Family',
};

/** A wedding menu in each tradition's flavour (the Signature collection's menu section). */
const SAMPLE_MENUS: Record<Faith, string> = {
  hindu: 'Welcome | Kesar thandai · Kokum sherbet\nStarters | Paneer tikka · Dahi kebab · Hara bhara kebab\nMains | Dal makhani · Shahi paneer · Veg biryani · Butter naan\nDessert | Moong dal halwa · Kulfi falooda · Paan',
  muslim: 'Welcome | Rooh Afza sherbet · Kashmiri kahwa\nStarters | Galouti kebab · Chicken tikka · Paneer tikka\nMains | Mutton biryani · Chicken korma · Mirchi ka salan · Khamiri roti\nDessert | Shahi tukda · Phirni',
  sikh: 'Welcome | Lassi · Shikanji\nStarters | Amritsari fish · Paneer tikka · Aloo tikki\nMains | Sarson da saag · Makki di roti · Dal makhani · Butter chicken\nDessert | Gajar halwa · Kulfi falooda',
  christian: 'Welcome | Fresh lime soda · Iced tea\nStarters | Prawn rissoles · Chicken cutlets · Vegetable croquettes\nMains | Appam & stew · Mutton roast · Ghee rice · Fish moilee\nDessert | Caramel custard · Bebinca',
};

/** A destination wedding's practical lines (the stay, travel and gift slots), for designs tagged `destination`. */
const DESTINATION_LINES = {
  accommodation: 'Rooms are held for you at the palace hotel from 13 to 15 December; mention our names when you book.',
  travel: 'The airport is 25 minutes away. Cars will meet every flight on the 13th.',
  gifts: 'Your blessings are the only gift we wish for.',
} as const;

/**
 * Sample context for Template Studio previews, catalog previews and automated
 * template tests. `seed` (the template key) and `faith` (else read from `tags`)
 * choose the people: each template shows its own names, of its tradition.
 */
export function sampleRenderContext(overrides: SampleOverrides = {}): RenderContext {
  const long = overrides.longNames ?? false;
  const venue: VenueContext = {
    name: long ? 'The Grand Maharaja Heritage Palace Banquet & Convention Centre' : 'Rambagh Palace',
    address: 'Bhawani Singh Road',
    city: 'Jaipur',
    mapUrl: 'https://maps.google.com/?q=Rambagh+Palace',
  };
  const typeKey = overrides.typeKey ?? 'WEDDING';
  const options = { ...(overrides.seed ? { seed: overrides.seed } : {}), ...(overrides.faith !== undefined ? { faith: overrides.faith } : {}) };
  const preset = samplePreset(typeKey, overrides.tags, options);
  const people = samplePeople(typeKey, overrides.tags, options);
  const verse = SAMPLE_VERSES[people.faith ?? 'any'];
  const at = (day: number, hourUtc: number) => new Date(Date.UTC(2026, 11, 14 + day, hourUtc, 30)).toISOString();
  const fns: FunctionContext[] = preset.functions.map((name, i) => ({
    id: `f${i + 1}`,
    name,
    description: i === 1 ? 'An evening to remember' : null,
    startsAt: at(Math.floor(i / 2), i % 2 ? 13 : 4),
    endsAt: null,
    status: 'SCHEDULED',
    venue,
  }));
  // Real photographs of the family's tradition and the occasion (sample-photos.ts).
  const shots = samplePhotoSet(typeKey, people.tradition, overrides.tags);
  const photo = (name: Parameters<typeof samplePhoto>[0]): GalleryImage => samplePhoto(name, overrides.photoBase);
  // A couple comes with both sets of parents (event details keys of the same names).
  const parents = {
    partnerOneFather: people.partnerOneParents[0],
    partnerOneMother: people.partnerOneParents[1],
    partnerTwoFather: people.partnerTwoParents[0],
    partnerTwoMother: people.partnerTwoParents[1],
  };
  const details: Record<string, unknown> = preset.couple
    ? long
      ? { partnerOne: people.longCouple[0], partnerTwo: people.longCouple[1], ...parents }
      : { partnerOne: preset.couple[0], partnerTwo: preset.couple[1], ...parents }
    : preset.honoree
      ? { name: long ? people.longPerson : preset.honoree }
      : {};
  return buildRenderContext({
    event: {
      title: long ? preset.longTitle : preset.title,
      description: preset.description,
      typeKey,
      startDate: fns[0]?.startsAt ?? null,
      endDate: fns[fns.length - 1]?.startsAt ?? null,
      language: overrides.language ?? 'en',
      timezone: 'Asia/Kolkata',
    },
    details,
    functions: fns,
    faith: people.faith,
    guestName: long ? LONG_GUESTS[people.tradition] : people.guest,
    gallery: overrides.noPhotos ? [] : shots.gallery.map(photo),
    photos: overrides.noPhotos ? [] : [photo(shots.cover), photo(shots.story)],
    photoSlots: overrides.noPhotos
      ? {}
      : { cover: photo(shots.cover), partnerOne: photo(shots.partnerOne), partnerTwo: photo(shots.partnerTwo), story: photo(shots.story), closing: photo(shots.closing), venue: photo(shots.venue) },
    custom: {
      // Destination designs show where to stay, how to travel and the gift note.
      ...(overrides.tags?.includes('destination') ? DESTINATION_LINES : {}),
      tagline: preset.tagline,
      story: 'It started with a chance meeting and a cup of chai. Years later, we are ready to begin our forever.',
      about: preset.description,
      blessings: people.blessings,
      hashtag: preset.hashtag,
      quote: verse.quote,
      quoteBy: verse.by,
      menu: SAMPLE_MENUS[people.tradition],
    },
    announcements: [{ title: 'Shuttle service', body: 'Shuttles leave the hotel lobby every 30 minutes from 6 pm.', publishedAt: '2026-12-01T10:00:00.000Z' }],
  });
}
