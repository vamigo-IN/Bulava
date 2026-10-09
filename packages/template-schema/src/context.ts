import type { PhotoSlot } from './definition';
import { SAMPLE_IMAGE_SIZE, sampleImageDataUri } from './sample-images';
import { samplePreset } from './sample-presets';
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
  couple?: { partnerOne: string; partnerTwo: string; brideName: string; groomName: string };
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
}): RenderContext {
  const d = input.details ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const p1 = str(d.partnerOne);
  const p2 = str(d.partnerTwo);
  const honoree = str(d.name);
  const first = input.functions[0];
  return {
    event: input.event,
    ...(p1 && p2 ? { couple: { partnerOne: p1, partnerTwo: p2, brideName: p1, groomName: p2 } } : {}),
    ...(honoree ? { honoree: { name: honoree } } : {}),
    functions: input.functions,
    ...(first ? { function: first } : {}),
    ...(first?.venue ? { venue: first.venue } : {}),
    ...(input.guestName ? { guest: { name: input.guestName } } : {}),
    gallery: { images: input.gallery ?? [] },
    photos: input.photos ?? [],
    ...(input.photoSlots && Object.keys(input.photoSlots).length ? { photoSlots: input.photoSlots } : {}),
    custom: input.custom ?? {},
    ...(input.announcements ? { announcements: input.announcements } : {}),
    ...(input.music ? { music: input.music } : {}),
    ...(input.assets && Object.keys(input.assets).length ? { assets: input.assets } : {}),
  };
}

/** Sample context for Template Studio previews and automated template tests. */
export function sampleRenderContext(overrides: Partial<{ language: string; longNames: boolean; noPhotos: boolean; typeKey: string; tags: readonly string[] }> = {}): RenderContext {
  const long = overrides.longNames ?? false;
  const venue: VenueContext = {
    name: long ? 'The Grand Maharaja Heritage Palace Banquet & Convention Centre' : 'Rambagh Palace',
    address: 'Bhawani Singh Road',
    city: 'Jaipur',
    mapUrl: 'https://maps.google.com/?q=Rambagh+Palace',
  };
  const typeKey = overrides.typeKey ?? 'WEDDING';
  const preset = samplePreset(typeKey, overrides.tags);
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
  const photo = (n: number): GalleryImage => {
    const uri = sampleImageDataUri(n);
    return { url: uri, thumbUrl: uri, ...SAMPLE_IMAGE_SIZE };
  };
  const details: Record<string, unknown> = preset.couple
    ? long
      ? { partnerOne: 'Aishwarya Venkataraman', partnerTwo: 'Siddharth Chaturvedi' }
      : { partnerOne: preset.couple[0], partnerTwo: preset.couple[1] }
    : preset.honoree
      ? { name: long ? 'Venkataraman Subramaniam' : preset.honoree }
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
    guestName: long ? 'Mr. & Mrs. Ramachandran Iyer and Family' : 'Rahul',
    gallery: overrides.noPhotos ? [] : [photo(1), photo(2), photo(3), photo(4)],
    photos: overrides.noPhotos ? [] : [photo(5), photo(6)],
    photoSlots: overrides.noPhotos ? {} : { cover: photo(5), partnerOne: photo(2), partnerTwo: photo(3), story: photo(6), closing: photo(1) },
    custom: {
      tagline: preset.tagline,
      story: 'It started with a chance meeting and a cup of chai. Years later, we are ready to begin our forever.',
      about: preset.description,
      blessings: 'With the blessings of Smt. Kamla & Shri Ramesh Sharma\nand Smt. Sunita & Shri Anil Kapoor',
      hashtag: preset.hashtag,
      quote: 'Two souls with but a single thought, two hearts that beat as one.',
      quoteBy: 'Traditional',
      menu: 'Welcome | Kesar thandai · Kokum sherbet\nStarters | Paneer tikka · Dahi kebab · Hara bhara kebab\nMains | Dal makhani · Shahi paneer · Veg biryani · Butter naan\nDessert | Moong dal halwa · Kulfi falooda · Paan',
    },
    announcements: [{ title: 'Shuttle service', body: 'Shuttles leave the hotel lobby every 30 minutes from 6 pm.', publishedAt: '2026-12-01T10:00:00.000Z' }],
  });
}
