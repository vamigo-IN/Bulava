import type { ThemeDress } from '@bulava/template-schema';
import { b, type CanvasSpec } from '../canvas-kit';
import type { Kit, Occasion } from './kit';

/**
 * How each composition lays out the sections below its hero (docs/templates.md#section-suites).
 * The theme's suite dresses them in its art; the composition chooses their
 * layouts, so a theme's templates differ all the way down the page, and each
 * page echoes its hero: a jharokha hero keeps its windows for the couple's
 * portraits and closes on the suite's skyline, a night hero overlaps two round
 * portraits and swipes through the photos, a minimal hero stays quiet (no
 * borders or corners), a photo hero turns its portraits over like prints.
 * The suite's frame appears at most twice on a page.
 */
export interface Arrangement {
  /** The couple section's layout (couple occasions). */
  couple: string;
  /** The story (couples) or the about section (one person's occasions). */
  story: string;
  gallery: string;
  rsvp: string;
  footer: string;
  /** Pieces of the suite this composition leaves out or swaps. */
  dress?: ThemeDress;
}

const ARRANGEMENTS: Readonly<Record<string, Arrangement>> = {
  jharokha: { couple: 'portraits', story: 'letter', gallery: 'mosaic', rsvp: 'card', footer: 'skyline' },
  arch: { couple: 'portraits', story: 'default', gallery: 'polaroid', rsvp: 'card', footer: 'seal' },
  couple: { couple: 'default', story: 'letter', gallery: 'mosaic', rsvp: 'default', footer: 'blessing' },
  portrait: { couple: 'monogram', story: 'polaroid', gallery: 'stack', rsvp: 'card', footer: 'seal' },
  mandap: { couple: 'duet', story: 'curtain', gallery: 'mosaic', rsvp: 'card', footer: 'skyline' },
  split: { couple: 'monogram', story: 'polaroid', gallery: 'polaroid', rsvp: 'default', footer: 'blessing' },
  night: { couple: 'duet', story: 'letter', gallery: 'stack', rsvp: 'card', footer: 'skyline' },
  floral: { couple: 'portraits', story: 'polaroid', gallery: 'frames', rsvp: 'default', footer: 'skyline' },
  temple: { couple: 'portraits', story: 'default', gallery: 'mosaic', rsvp: 'card', footer: 'skyline' },
  home: { couple: 'stacked', story: 'letter', gallery: 'mosaic', rsvp: 'default', footer: 'seal' },
  minimal: { couple: 'profile', story: 'default', gallery: 'mosaic', rsvp: 'default', footer: 'default', dress: { edge: 'none', corner: 'none' } },
  photo: { couple: 'flip', story: 'polaroid', gallery: 'mosaic', rsvp: 'default', footer: 'blessing' },
  party: { couple: 'default', story: 'polaroid', gallery: 'polaroid', rsvp: 'default', footer: 'skyline' },
  dream: { couple: 'default', story: 'letter', gallery: 'stack', rsvp: 'default', footer: 'skyline' },
  // The faith compositions: a nikah's jaali mehrab, the Golden Temple on its sarovar, a church's lancet window.
  mehrab: { couple: 'portraits', story: 'letter', gallery: 'stack', rsvp: 'card', footer: 'skyline' },
  darbar: { couple: 'duet', story: 'default', gallery: 'mosaic', rsvp: 'card', footer: 'blessing' },
  lancet: { couple: 'portraits', story: 'polaroid', gallery: 'frames', rsvp: 'default', footer: 'blessing' },
};

/**
 * When a theme lays one composition out twice (a princess and a champ, a house and a kalash),
 * the second takes another arrangement, so the two pages still differ below the hero.
 */
const SECOND: Readonly<Record<string, Partial<Arrangement>>> = {
  party: { story: 'letter', gallery: 'mosaic', footer: 'seal', dress: { frame: 'scallop' } },
  couple: { couple: 'stacked', story: 'polaroid', footer: 'seal' },
  dream: { story: 'polaroid', gallery: 'polaroid', footer: 'seal' },
  home: { couple: 'monogram', story: 'default', gallery: 'polaroid', footer: 'blessing' },
};
const SECOND_FALLBACK: Partial<Arrangement> = { story: 'polaroid', footer: 'seal' };

/**
 * A composition's arrangement (a new composition takes the couple's until it has its own);
 * `nth` counts earlier layouts of the same composition in the theme.
 */
export function arrangementOf(composition: string, nth = 0): Arrangement {
  const own = ARRANGEMENTS[composition] ?? ARRANGEMENTS.couple!;
  if (!nth) return own;
  const second = SECOND[composition] ?? SECOND_FALLBACK;
  return { ...own, ...second, dress: { ...own.dress, ...second.dress } };
}

/** The standard sections between the function cards and the RSVP, laid out for the composition. */
export function middleFor(composition: string, occ: Occasion, nth = 0): CanvasSpec['middle'] {
  const a = arrangementOf(composition, nth);
  const gallery = { id: 'gallery', section: 'gallery', variant: a.gallery };
  if (!occ.couple) return [{ id: 'about', section: 'story', variant: a.story, props: { text: b('custom.about'), image: b('photo.story', { fallback: b('photos[1]') }) } }, gallery];
  return [
    { id: 'couple', section: 'couple', variant: a.couple, props: { partnerOneParents: b('custom.partnerOneParents'), partnerTwoParents: b('custom.partnerTwoParents') } },
    { id: 'story', section: 'story', variant: a.story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
    gallery,
  ];
}

/** Compositions drawn on dark stock whatever the kit (a night sky, a temple at dusk), and those always light (a party, a pastel sky). */
const DARK_COMPOSITIONS = new Set(['night', 'temple']);
const LIGHT_COMPOSITIONS = new Set(['party', 'dream']);

/** Does the hero sit on dark stock (so the sections below follow it onto the dark bands)? */
export function darkHero(composition: string, kit: Pick<Kit, 'dark'>): boolean {
  if (LIGHT_COMPOSITIONS.has(composition)) return false;
  return kit.dark || DARK_COMPOSITIONS.has(composition);
}
