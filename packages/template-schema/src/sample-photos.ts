import type { Faith } from './faith';

/**
 * Sample photos for template previews, editors and tests (docs/templates.md#sample-photos):
 * real photographs, CC0 or public domain, re-encoded to WebP and served as
 * static files by the web app and the console (apps/web/public/samples,
 * apps/admin/public/samples), each credited in samples/CREDITS.md. Never data
 * URIs: they would ride in every bundle. A template shows the photos of its
 * faith and occasion: a couple in their tradition's wedding clothes, the
 * bride and the groom for the couple's portraits, the wedding's moments and
 * places in the gallery; a baby, a cake or the lamps of a puja for other
 * occasions. Replacing a file under the same name changes every preview.
 */

/** Where the sample photos are served from (both apps). Renderers without them (film stills) pass an origin. */
export const SAMPLE_PHOTO_BASE = '/samples';

/** Every sample photo, by file name (without .webp): its width and height in pixels. */
export const SAMPLE_PHOTOS = {
  'hindu-couple': [1200, 921],
  'hindu-bride': [667, 1000],
  'hindu-groom': [748, 1000],
  'hindu-ritual': [1000, 666],
  chooda: [1000, 476],
  'hindu-puja': [750, 1000],
  mandap: [1200, 800],
  garlands: [750, 1000],
  'muslim-couple': [1200, 800],
  'muslim-bride': [750, 1000],
  'muslim-groom': [720, 1000],
  mehendi: [960, 640],
  mosque: [1200, 898],
  lantern: [563, 1000],
  domes: [1000, 750],
  walima: [1000, 750],
  'mehendi-red': [750, 1000],
  'sikh-couple': [801, 1200],
  'sikh-bride': [614, 768],
  'sikh-groom': [1000, 803],
  'marigold-hand': [750, 1000],
  darbar: [1200, 854],
  'darbar-night': [1200, 675],
  'darbar-gold': [1000, 563],
  phulkari: [667, 1000],
  'christian-couple': [641, 960],
  'christian-bride': [667, 1000],
  'christian-groom': [960, 636],
  'christian-hands': [960, 640],
  'christian-rings': [960, 640],
  'ring-exchange': [960, 727],
  'bouquet-bride': [667, 1000],
  church: [640, 960],
  'church-nave': [960, 639],
  'baby-asleep': [960, 720],
  'baby-feet': [960, 640],
  'baby-foot': [960, 640],
  'baby-shoes': [960, 640],
  'mother-to-be': [960, 640],
  'baby-bump': [960, 640],
  'birthday-cake': [960, 640],
  'birthday-candle': [960, 640],
  balloons: [960, 640],
  gift: [960, 640],
  confetti: [560, 1000],
  diyas: [808, 1000],
  'diya-row': [1000, 753],
  'diya-mandala': [1000, 750],
  rangoli: [750, 1000],
  'flower-rangoli': [903, 1000],
  marigold: [890, 1000],
  candles: [640, 960],
  bouquet: [667, 1000],
  'fairy-lights': [1200, 539],
  'venue-gate': [750, 1000],
} as const satisfies Record<string, readonly [number, number]>;

export type SamplePhotoName = keyof typeof SAMPLE_PHOTOS;

/** The photos of one sample invitation: its named spots, its gallery (four) and its photos[n] (two). */
export interface SamplePhotoSet {
  cover: SamplePhotoName;
  /** The first partner's portrait (the bride's, for a wedding), and the second's. */
  partnerOne: SamplePhotoName;
  partnerTwo: SamplePhotoName;
  story: SamplePhotoName;
  closing: SamplePhotoName;
  gallery: readonly [SamplePhotoName, SamplePhotoName, SamplePhotoName, SamplePhotoName];
}

const set = (cover: SamplePhotoName, story: SamplePhotoName, closing: SamplePhotoName, gallery: SamplePhotoSet['gallery'], partners: [SamplePhotoName, SamplePhotoName] = [cover, story]): SamplePhotoSet => ({
  cover,
  partnerOne: partners[0],
  partnerTwo: partners[1],
  story,
  closing,
  gallery,
});

/**
 * Weddings (and the engagement, the other wedding functions and
 * anniversaries) by tradition. The Muslim and Sikh couples are shown by their
 * hands and wedding clothes until licensed nikah and Anand Karaj couple
 * photographs replace muslim-couple, muslim-bride, muslim-groom, sikh-couple,
 * sikh-bride and sikh-groom (CREDITS.md).
 */
const WEDDINGS: Record<Faith, SamplePhotoSet> = {
  hindu: set('hindu-couple', 'hindu-ritual', 'mandap', ['chooda', 'hindu-puja', 'garlands', 'diyas'], ['hindu-bride', 'hindu-groom']),
  muslim: set('muslim-couple', 'mehendi', 'mosque', ['lantern', 'domes', 'walima', 'mehendi-red'], ['muslim-bride', 'muslim-groom']),
  sikh: set('sikh-couple', 'marigold-hand', 'darbar', ['darbar-night', 'phulkari', 'darbar-gold', 'garlands'], ['sikh-bride', 'sikh-groom']),
  christian: set('christian-couple', 'christian-hands', 'church', ['christian-rings', 'ring-exchange', 'bouquet-bride', 'church-nave'], ['christian-bride', 'christian-groom']),
};

/** Prayers and family rites (a puja, a Quran Khwani, a path, a thanksgiving Mass), by tradition. */
const PRAYERS: Record<Faith, SamplePhotoSet> = {
  hindu: set('hindu-puja', 'diyas', 'diya-row', ['diya-mandala', 'rangoli', 'marigold', 'garlands']),
  muslim: set('lantern', 'mosque', 'domes', ['walima', 'mosque', 'domes', 'lantern']),
  sikh: set('darbar', 'darbar-night', 'darbar-gold', ['phulkari', 'marigold', 'garlands', 'darbar-night']),
  christian: set('church-nave', 'candles', 'church', ['candles', 'bouquet', 'church', 'church-nave']),
};

/** A new home, by tradition. */
const HOMES: Record<Faith, SamplePhotoSet> = {
  hindu: set('rangoli', 'garlands', 'diya-row', ['diyas', 'marigold', 'flower-rangoli', 'bouquet']),
  muslim: set('lantern', 'bouquet', 'fairy-lights', ['walima', 'candles', 'gift', 'bouquet']),
  sikh: set('marigold', 'garlands', 'fairy-lights', ['phulkari', 'darbar', 'bouquet', 'candles']),
  christian: set('bouquet', 'candles', 'fairy-lights', ['candles', 'bouquet', 'gift', 'balloons']),
};

const BIRTHDAY = set('birthday-cake', 'balloons', 'gift', ['birthday-candle', 'confetti', 'birthday-cake', 'balloons']);
const BABY_SHOWER = set('mother-to-be', 'baby-bump', 'baby-shoes', ['baby-feet', 'baby-foot', 'balloons', 'bouquet']);
const BABY = set('baby-asleep', 'baby-feet', 'baby-shoes', ['baby-foot', 'marigold', 'balloons', 'garlands']);
const FESTIVAL = set('diyas', 'rangoli', 'diya-row', ['diya-mandala', 'flower-rangoli', 'marigold', 'fairy-lights']);
const CHRISTMAS = set('candles', 'church-nave', 'fairy-lights', ['candles', 'church-nave', 'gift', 'fairy-lights']);
const GATHERING = set('fairy-lights', 'bouquet', 'venue-gate', ['candles', 'balloons', 'gift', 'flower-rangoli']);

/**
 * The photos for a sample invitation: by its occasion and the tradition of its
 * sample family (the template's faith, or for designs that suit every family
 * the one its key chose), with festival tags choosing that festival's.
 */
export function samplePhotoSet(typeKey: string, tradition: Faith, tags: readonly string[] = []): SamplePhotoSet {
  switch (typeKey) {
    case 'WEDDING':
    case 'ENGAGEMENT':
    case 'ANNIVERSARY':
      return WEDDINGS[tradition];
    case 'BIRTHDAY':
      return BIRTHDAY;
    case 'BABY_SHOWER':
      return BABY_SHOWER;
    case 'NAMING_CEREMONY':
    case 'MUNDAN':
      return BABY;
    case 'THREAD_CEREMONY':
    case 'RELIGIOUS':
      return PRAYERS[tradition];
    case 'HOUSEWARMING':
      return HOMES[tradition];
    case 'FESTIVAL':
    case 'COMMUNITY':
      if (tags.includes('eid')) return PRAYERS.muslim;
      if (tags.includes('christmas')) return CHRISTMAS;
      if (tags.includes('gurpurab')) return PRAYERS.sikh;
      return FESTIVAL;
    default:
      return GATHERING;
  }
}

/** A sample photo's address and size, as a render context's image: under `base` (SAMPLE_PHOTO_BASE, or an origin). */
export function samplePhoto(name: SamplePhotoName, base: string = SAMPLE_PHOTO_BASE): { url: string; thumbUrl: string; width: number; height: number } {
  const [width, height] = SAMPLE_PHOTOS[name];
  const url = `${base.replace(/\/$/, '')}/${name}.webp`;
  return { url, thumbUrl: url, width, height };
}
