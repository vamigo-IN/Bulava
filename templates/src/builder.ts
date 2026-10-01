import { fontPairing, type EffectName, type Fonts, type IntroName, type LookName, type ORNAMENTS, type PhotoSlot, type TemplateDefinitionInput, type ThemeColors, type Value } from '@bulava/template-schema';

/**
 * Helpers to author catalog templates compactly. Output is plain
 * TemplateDefinition JSON: nothing here is rendered directly; the generic
 * renderers interpret the stored JSON.
 */

export type Tier = 'FREE' | 'STANDARD' | 'PREMIUM';

export interface CatalogMeta {
  key: string;
  name: string;
  description: string;
  /** Display category, e.g. "Wedding", "Birthday". */
  category: string;
  /** Visual style keyword, e.g. "Royal", "Modern". */
  style: string;
  tier: Tier;
  badge?: 'NEW' | 'POPULAR' | 'BESTSELLER';
  featured?: boolean;
  /** Tradition / theme tags used for filters: hindu, sikh, muslim, south-indian, … */
  tags: string[];
  eventTypes: string[];
  sortOrder: number;
}

export interface CatalogEntry {
  meta: CatalogMeta;
  definition: TemplateDefinitionInput;
}

// ─────────────────────────── Fonts ───────────────────────────

export const FONTS: Record<'royal' | 'classic' | 'heritage' | 'modern' | 'editorial', Fonts> = {
  royal: {
    heading: { family: 'Cormorant Garamond', scripts: ['Latn'], fallbacks: { Deva: 'Noto Serif Devanagari' } },
    body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: { Deva: 'Noto Sans Devanagari' } },
    script: { family: 'Great Vibes', scripts: ['Latn'], fallbacks: { Deva: 'Tiro Devanagari Hindi' } },
  },
  classic: {
    heading: { family: 'Playfair Display', scripts: ['Latn'], fallbacks: { Deva: 'Noto Serif Devanagari' } },
    body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: { Deva: 'Noto Sans Devanagari' } },
    script: { family: 'Great Vibes', scripts: ['Latn'], fallbacks: { Deva: 'Tiro Devanagari Hindi' } },
  },
  heritage: {
    heading: { family: 'Tiro Devanagari Hindi', scripts: ['Deva', 'Latn'], fallbacks: {} },
    body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: { Deva: 'Noto Sans Devanagari' } },
    script: { family: 'Cormorant Garamond', scripts: ['Latn'], fallbacks: { Deva: 'Tiro Devanagari Hindi' } },
  },
  modern: {
    heading: { family: 'Poppins', scripts: ['Latn'], fallbacks: { Deva: 'Noto Sans Devanagari' } },
    body: { family: 'Poppins', scripts: ['Latn'], fallbacks: { Deva: 'Noto Sans Devanagari' } },
  },
  editorial: {
    heading: { family: 'Playfair Display', scripts: ['Latn'], fallbacks: { Deva: 'Noto Serif Devanagari' } },
    body: { family: 'Noto Serif', scripts: ['Latn'], fallbacks: { Deva: 'Noto Serif Devanagari' } },
    script: { family: 'Playfair Display', scripts: ['Latn'], fallbacks: { Deva: 'Noto Serif Devanagari' } },
  },
};
/** A builder preset, or any FONT_PAIRINGS key (regal, romantic, elegant, grand, desi…). */
export type FontPreset = keyof typeof FONTS | 'regal' | 'romantic' | 'elegant' | 'grand' | 'desi';

export function fontsFor(preset: FontPreset): Fonts {
  const fonts = (FONTS as Record<string, Fonts>)[preset] ?? fontPairing(preset)?.fonts;
  if (!fonts) throw new Error(`Unknown font preset ${preset}`);
  return fonts;
}

// ─────────────────────────── Invocations ───────────────────────────

export const INVOCATION = {
  hindu: '॥ श्री गणेशाय नमः ॥',
  marathi: '॥ श्री ॥',
  gujarati: '॥ શ્રી ગણેશાય નમઃ ॥',
  sikh: 'ੴ ਸਤਿ ਨਾਮੁ',
  muslim: 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  tamil: 'உ',
  bengali: 'শুভ বিবাহ',
  christian: '“Love is patient, love is kind.” — 1 Corinthians 13:4',
  om: 'ॐ',
  krishna: '॥ श्री कृष्ण शरणं मम ॥',
} as const;

// ─────────────────────────── Palettes ───────────────────────────

export function palette(primary: string, secondary: string, accent: string, background: string, surface: string, text: string, muted: string): ThemeColors {
  return { primary, secondary, accent, background, surface, text, muted };
}

// ─────────────────────────── Values ───────────────────────────

const b = (binding: string, extra: Partial<{ format: 'date' | 'dateWithWeekday' | 'time' | 'upper' | 'dateTime'; fallback: Value }> = {}): Value => ({ binding, ...extra });
const lit = (literal: string): Value => ({ literal });
const t = (key: string): Value => ({ t: key });

/** Names line that works for couples, honorees and plain events. */
export const TITLE: Value = {
  template: '{{couple.partnerOne}} & {{couple.partnerTwo}}',
  fallback: b('honoree.name', { fallback: b('event.title') }),
};

// ─────────────────────────── Text slots ───────────────────────────

const SLOTS = {
  tagline: { key: 'tagline', label: 'Tagline', maxLength: 80 },
  story: { key: 'story', label: 'Your story', maxLength: 1200 },
  blessings: { key: 'blessings', label: 'Blessings / family lines', maxLength: 600 },
  partnerOneParents: { key: 'partnerOneParents', label: 'First partner’s family', maxLength: 160 },
  partnerTwoParents: { key: 'partnerTwoParents', label: 'Second partner’s family', maxLength: 160 },
  accommodation: { key: 'accommodation', label: 'Stay details', maxLength: 600 },
  travel: { key: 'travel', label: 'Travel details', maxLength: 600 },
  gifts: { key: 'gifts', label: 'Gift note', maxLength: 400 },
  hashtag: { key: 'hashtag', label: 'Hashtag', maxLength: 40 },
  closing: { key: 'closing', label: 'Closing line', maxLength: 120 },
  about: { key: 'about', label: 'About the event', maxLength: 1200 },
  quote: { key: 'quote', label: 'A verse or a line from you', maxLength: 300 },
  quoteBy: { key: 'quoteBy', label: 'Quote attribution', maxLength: 80 },
  menu: { key: 'menu', label: 'Menu (one course per line: Course | dishes)', maxLength: 1500 },
} as const;
type SlotKey = keyof typeof SLOTS;

// ─────────────────────────── Section layouts ───────────────────────────

type HeroVariant =
  | 'arch'
  | 'classic'
  | 'split'
  | 'photo'
  | 'minimal'
  | 'festive'
  | 'temple'
  | 'monogram'
  | 'cathedral'
  | 'seaside'
  | 'celestial'
  | 'lantern'
  | 'peacock'
  // Illustrated 3D scenes
  | 'gopuram'
  | 'palace'
  | 'toran'
  | 'arches'
  | 'lotus'
  | 'mandap'
  | 'noir'
  | 'floral'
  | 'balloons'
  | 'backwaters'
  | 'sarovar'
  | 'vrindavan';
type TimelineVariant = 'cards' | 'timeline' | 'tiles' | 'tickets' | 'diya';

/** Layout choices for the sections that have several. */
interface Variants {
  hero: HeroVariant;
  timeline: TimelineVariant;
  couple: 'default' | 'stacked' | 'arch' | 'flip' | 'profile';
  gallery: 'default' | 'stack' | 'mosaic' | 'polaroid';
  story: 'default' | 'curtain' | 'polaroid';
  countdown: 'default' | 'flip';
}

export type Layout =
  | 'wedding'
  | 'wedding-lite'
  | 'engagement'
  | 'pre-wedding'
  | 'save-the-date'
  | 'birthday'
  | 'anniversary'
  | 'family-ceremony'
  | 'housewarming'
  | 'religious'
  | 'festival'
  | 'corporate'
  | 'school'
  | 'community'
  | 'retirement'
  | 'signature-wedding'
  | 'signature-celebration';

interface SectionSpec {
  id: string;
  section: string;
  variant?: string;
  props?: Record<string, Value>;
  visibleWhen?: { exists?: string; eventTypes?: string[] };
}

function heroProps(eyebrow: Value, invocation?: string): Record<string, Value> {
  return {
    ...(invocation ? { invocation: lit(invocation) } : {}),
    eyebrow,
    title: TITLE,
    date: b('event.startDate', { format: 'date' }),
    place: b('venue.city'),
    tagline: b('custom.tagline'),
    image: b('photo.cover', { fallback: b('photos[0]') }),
  };
}

const LAYOUTS: Record<Layout, { eyebrow: Value; slots: SlotKey[]; sections: (v: Variants, invocation?: string) => SectionSpec[] }> = {
  wedding: {
    eyebrow: t('template.weddingOf'),
    slots: ['tagline', 'story', 'blessings', 'partnerOneParents', 'partnerTwoParents', 'accommodation', 'travel', 'gifts', 'hashtag', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.weddingOf'), invocation) },
      { id: 'countdown', section: 'countdown', variant: v.countdown },
      { id: 'couple', section: 'couple', variant: v.couple, props: { partnerOneParents: b('custom.partnerOneParents'), partnerTwoParents: b('custom.partnerTwoParents') } },
      { id: 'family', section: 'family', props: { text: b('custom.blessings') } },
      { id: 'story', section: 'story', variant: v.story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'gallery', section: 'gallery', variant: v.gallery },
      { id: 'stay', section: 'accommodation', props: { text: b('custom.accommodation') } },
      { id: 'travel', section: 'travel', props: { text: b('custom.travel') } },
      { id: 'updates', section: 'announcements' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'gifts', section: 'giftRegistry', props: { text: b('custom.gifts') } },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  'wedding-lite': {
    eyebrow: t('template.weddingOf'),
    slots: ['tagline', 'blessings', 'hashtag', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.weddingOf'), invocation) },
      { id: 'family', section: 'family', props: { text: b('custom.blessings') } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'updates', section: 'announcements' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  engagement: {
    eyebrow: t('template.engagementOf'),
    slots: ['tagline', 'story', 'hashtag', 'closing'],
    sections: (v): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.engagementOf')) },
      { id: 'countdown', section: 'countdown', variant: v.countdown },
      { id: 'couple', section: 'couple', variant: v.couple },
      { id: 'story', section: 'story', variant: v.story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'gallery', section: 'gallery', variant: v.gallery },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  'pre-wedding': {
    eyebrow: t('template.celebrateWith'),
    slots: ['tagline', 'about', 'hashtag', 'closing'],
    sections: (v): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: { ...heroProps(t('template.celebrateWith')), date: b('function.startsAt', { format: 'dateTime' }) } },
      { id: 'about', section: 'story', props: { heading: b('function.name'), text: b('custom.about') } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  'save-the-date': {
    eyebrow: t('template.saveTheDate'),
    slots: ['tagline', 'hashtag', 'closing'],
    sections: (v): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: { ...heroProps(t('template.saveTheDate')), subtitle: t('template.joinUs') } },
      { id: 'countdown', section: 'countdown', variant: v.countdown },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  birthday: {
    eyebrow: t('template.birthdayOf'),
    slots: ['tagline', 'about', 'hashtag', 'closing'],
    sections: (v): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.birthdayOf')) },
      { id: 'countdown', section: 'countdown', variant: v.countdown },
      { id: 'about', section: 'story', variant: v.story, props: { text: b('custom.about'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'gallery', section: 'gallery', variant: v.gallery },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  anniversary: {
    eyebrow: t('template.celebrateWith'),
    slots: ['tagline', 'story', 'hashtag', 'closing'],
    sections: (v): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.celebrateWith')) },
      { id: 'story', section: 'story', variant: v.story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'gallery', section: 'gallery', variant: v.gallery },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  'family-ceremony': {
    eyebrow: t('template.blessings'),
    slots: ['tagline', 'about', 'blessings', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.blessings'), invocation) },
      { id: 'about', section: 'story', props: { text: b('custom.about') } },
      { id: 'family', section: 'family', props: { text: b('custom.blessings') } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'footer', section: 'footer', props: { closing: b('custom.closing') } },
    ],
  },
  housewarming: {
    eyebrow: t('template.joinUs'),
    slots: ['tagline', 'about', 'travel', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: { ...heroProps(t('template.joinUs'), invocation), title: b('event.title') } },
      { id: 'about', section: 'story', props: { text: b('custom.about') } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'travel', section: 'travel', props: { text: b('custom.travel') } },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'footer', section: 'footer', props: { closing: b('custom.closing') } },
    ],
  },
  religious: {
    eyebrow: t('template.blessings'),
    slots: ['tagline', 'about', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: { ...heroProps(t('template.blessings'), invocation), title: b('event.title') } },
      { id: 'about', section: 'story', props: { text: b('custom.about') } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'updates', section: 'announcements' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'footer', section: 'footer', props: { closing: b('custom.closing') } },
    ],
  },
  festival: {
    eyebrow: t('template.celebrateWith'),
    slots: ['tagline', 'about', 'hashtag', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: { ...heroProps(t('template.celebrateWith'), invocation), title: b('event.title') } },
      { id: 'countdown', section: 'countdown', variant: v.countdown },
      { id: 'about', section: 'story', props: { text: b('custom.about') } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  corporate: {
    eyebrow: t('invitation.youAreInvited'),
    slots: ['tagline', 'about', 'travel', 'closing'],
    sections: (v): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: { eyebrow: t('invitation.youAreInvited'), title: b('event.title'), subtitle: b('custom.tagline'), date: b('event.startDate', { format: 'dateTime' }), place: b('venue.city') } },
      { id: 'about', section: 'story', props: { heading: t('template.about.title'), text: b('custom.about') } },
      { id: 'agenda', section: 'eventTimeline', variant: v.timeline, props: { heading: t('template.agenda.title') } },
      { id: 'venue', section: 'venue' },
      { id: 'travel', section: 'travel', props: { text: b('custom.travel') } },
      { id: 'updates', section: 'announcements' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'footer', section: 'footer', props: { closing: b('custom.closing') } },
    ],
  },
  school: {
    eyebrow: t('invitation.youAreInvited'),
    slots: ['tagline', 'about', 'closing'],
    sections: (v): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: { eyebrow: t('invitation.youAreInvited'), title: b('event.title'), subtitle: b('custom.tagline'), date: b('event.startDate', { format: 'date' }), place: b('venue.name') } },
      { id: 'about', section: 'story', props: { text: b('custom.about') } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'gallery', section: 'gallery', variant: v.gallery },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'footer', section: 'footer', props: { closing: b('custom.closing') } },
    ],
  },
  community: {
    eyebrow: t('template.celebrateWith'),
    slots: ['tagline', 'about', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: { ...heroProps(t('template.celebrateWith'), invocation), title: b('event.title') } },
      { id: 'countdown', section: 'countdown', variant: v.countdown },
      { id: 'about', section: 'story', props: { text: b('custom.about') } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'updates', section: 'announcements' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'footer', section: 'footer', props: { closing: b('custom.closing') } },
    ],
  },
  /** The Signature collection: a full cinematic journey with a verse and the menu. */
  'signature-wedding': {
    eyebrow: t('template.weddingOf'),
    slots: ['tagline', 'quote', 'quoteBy', 'story', 'blessings', 'partnerOneParents', 'partnerTwoParents', 'menu', 'accommodation', 'travel', 'gifts', 'hashtag', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.weddingOf'), invocation) },
      { id: 'quote', section: 'quote', props: { text: b('custom.quote'), by: b('custom.quoteBy') } },
      { id: 'countdown', section: 'countdown', variant: v.countdown },
      { id: 'couple', section: 'couple', variant: v.couple, props: { partnerOneParents: b('custom.partnerOneParents'), partnerTwoParents: b('custom.partnerTwoParents') } },
      { id: 'family', section: 'family', props: { text: b('custom.blessings') } },
      { id: 'story', section: 'story', variant: v.story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'menu', section: 'menu', props: { text: b('custom.menu') } },
      { id: 'venue', section: 'venue' },
      { id: 'gallery', section: 'gallery', variant: v.gallery },
      { id: 'stay', section: 'accommodation', props: { text: b('custom.accommodation') } },
      { id: 'travel', section: 'travel', props: { text: b('custom.travel') } },
      { id: 'updates', section: 'announcements' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'gifts', section: 'giftRegistry', props: { text: b('custom.gifts') } },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  /** Signature journey for birthdays, festivals, pujas and other celebrations. */
  'signature-celebration': {
    eyebrow: t('template.celebrateWith'),
    slots: ['tagline', 'quote', 'quoteBy', 'about', 'menu', 'travel', 'hashtag', 'closing'],
    sections: (v, invocation): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.celebrateWith'), invocation) },
      { id: 'quote', section: 'quote', props: { text: b('custom.quote'), by: b('custom.quoteBy') } },
      { id: 'countdown', section: 'countdown', variant: v.countdown },
      { id: 'about', section: 'story', variant: v.story, props: { text: b('custom.about'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'menu', section: 'menu', props: { text: b('custom.menu') } },
      { id: 'venue', section: 'venue' },
      { id: 'gallery', section: 'gallery', variant: v.gallery },
      { id: 'travel', section: 'travel', props: { text: b('custom.travel') } },
      { id: 'updates', section: 'announcements' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'photos', section: 'photoShare' },
      { id: 'footer', section: 'footer', props: { hashtag: b('custom.hashtag'), closing: b('custom.closing') } },
    ],
  },
  retirement: {
    eyebrow: t('template.celebrateWith'),
    slots: ['tagline', 'story', 'closing'],
    sections: (v): SectionSpec[] => [
      { id: 'hero', section: 'hero', variant: v.hero, props: heroProps(t('template.celebrateWith')) },
      { id: 'story', section: 'story', variant: v.story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
      { id: 'schedule', section: 'eventTimeline', variant: v.timeline },
      { id: 'venue', section: 'venue' },
      { id: 'rsvp', section: 'rsvp' },
      { id: 'footer', section: 'footer', props: { closing: b('custom.closing') } },
    ],
  },
};

export interface WebsiteSpec extends Omit<CatalogMeta, 'sortOrder'> {
  layout: Layout;
  colors: ThemeColors;
  presets?: Array<{ name: string; colors: ThemeColors }>;
  fonts: FontPreset;
  ornament: (typeof ORNAMENTS)[number];
  pattern: 'none' | 'dots' | 'jaali' | 'waves';
  hero: HeroVariant;
  timeline: TimelineVariant;
  couple?: Variants['couple'];
  gallery?: Variants['gallery'];
  story?: Variants['story'];
  countdown?: Variants['countdown'];
  /** Design language for every section (default classic). */
  look?: LookName;
  /** Default ambient effect (customers can change it). */
  effect?: EffectName;
  intro?: IntroName;
  /** Guests hear a licensed track chosen by the host (Signature collection). */
  music?: boolean;
  heroTone?: 'light' | 'dark';
  invocation?: string;
  radius?: number;
  languages?: string[];
  maxPhotos?: number;
}

/** Heroes that show the cover photo (the noir medallion holds it). */
const COVER_HEROES = new Set<HeroVariant>(['photo', 'split', 'noir']);

/** Named photo places a template actually shows, so the design panel never offers a place that stays empty. */
function photoSlotsFor(layout: Layout, hero: HeroVariant): PhotoSlot[] {
  const slots: PhotoSlot[] = [];
  if (COVER_HEROES.has(hero)) slots.push('cover');
  // Only layouts with a couple section show partner photos.
  const sections = LAYOUTS[layout].sections({ hero, timeline: 'cards', couple: 'default', gallery: 'default', story: 'default', countdown: 'default' });
  if (sections.some((sec) => sec.section === 'couple')) slots.push('partnerOne', 'partnerTwo');
  if (sections.some((sec) => sec.section === 'story' && sec.props && 'image' in sec.props)) slots.push('story');
  slots.push('closing');
  return slots;
}

export function website(spec: WebsiteSpec, sortOrder: number): CatalogEntry {
  const layout = LAYOUTS[spec.layout];
  return {
    meta: {
      key: spec.key,
      name: spec.name,
      description: spec.description,
      category: spec.category,
      style: spec.style,
      tier: spec.tier,
      badge: spec.badge,
      featured: spec.featured,
      tags: spec.tags,
      eventTypes: spec.eventTypes,
      sortOrder,
    },
    definition: {
      schemaVersion: 1,
      templateKey: spec.key,
      type: 'WEBSITE',
      name: spec.name,
      description: spec.description,
      eventTypes: spec.eventTypes,
      languages: spec.languages ?? ['en', 'hi', 'hi-Latn'],
      theme: {
        colors: spec.colors,
        radius: spec.radius ?? 18,
        ornament: spec.ornament,
        pattern: spec.pattern,
        heroTone: spec.heroTone ?? 'light',
        look: spec.look ?? 'classic',
        effect: spec.effect ?? 'none',
      },
      fonts: fontsFor(spec.fonts),
      capabilities: {
        // Customers may restyle freely: colours, type, motion, which sections show and their own photos.
        editable: { colors: true, fonts: true, music: spec.music ?? false, background: false, layout: true, photos: true, text: true, animation: true },
        colorPresets: spec.presets ?? [],
        textSlots: layout.slots.map((s) => SLOTS[s]),
        maxPhotos: spec.maxPhotos ?? 6,
        photoSlots: photoSlotsFor(spec.layout, spec.hero),
      },
      ...(spec.music ? { music: { allowCustomerChoice: true } } : {}),
      website: {
        intro: spec.intro ?? 'none',
        pages: [
          {
            id: 'home',
            sections: layout.sections(
              { hero: spec.hero, timeline: spec.timeline, couple: spec.couple ?? 'default', gallery: spec.gallery ?? 'default', story: spec.story ?? 'default', countdown: spec.countdown ?? 'default' },
              spec.invocation,
            ) as never,
          },
        ],
      },
    },
  };
}
