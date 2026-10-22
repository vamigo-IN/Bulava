import type { SectionDecorInput, SectionInstanceInput, ThemeColors, Value } from '@bulava/template-schema';
import { fontsFor, palette, SLOTS, TITLE, type CatalogEntry } from './builder';

/**
 * The Royal Heirloom (Signature): a royal Rajput palace wedding you walk through. The couple's photograph
 * seen from a palace balcony, then quiet cream bands with gold hairlines and italic Cormorant headings, two
 * emerald bands for rhythm (the countdown and the announcements), arch-topped function cards and story
 * photo, the families' blessings under Lord Ganesha, and a lake palace at sunset, seen from the balcony's ledge where a
 * peacock stands, to close.
 * Built from engine sections (not canvases) so long words reflow at every width; each section's band and
 * corner art are the template's (`band`, `decor`), the deep band its own emerald (`colors.deep`).
 */

const b = (binding: string, extra: Partial<{ format: 'date'; fallback: Value }> = {}): Value => ({ binding, ...extra });
const t = (key: string): Value => ({ t: key });
/** Sage leaves under the roses, and the peacock's own blue: natural colours that stay in every preset. */
const LEAF = '#7C8F6A';
const PEACOCK = '#1F5F8B';

const MAROON: ThemeColors = { ...palette('#70252B', '#B58A4A', '#E2C78F', '#FBF5E9', '#FFF9F0', '#49352C', '#88766A'), deep: '#183B30' };
const RANI: ThemeColors = { ...palette('#8A1E4C', '#B58A4A', '#E9CB91', '#FCF4EF', '#FFF9F5', '#4A2933', '#8C6F78'), deep: '#144237' };
const MIDNIGHT: ThemeColors = { ...palette('#1F2B4D', '#B08A45', '#E3C88E', '#F7F3EA', '#FFFCF4', '#2C2A33', '#6F6B76'), deep: '#131C35' };

const roses = (at: SectionDecorInput['at'], size: number, x: number, y: number, flip: SectionDecorInput['flip'] = 'none', phone = 0): SectionDecorInput => ({ art: 'roseCluster', at, size, x, y, flip, tint: LEAF, phone });
const lantern = (at: 'topLeft' | 'topRight', size: number, x: number, phone = 0): SectionDecorInput => ({ art: 'hangingLantern', at, size, x, y: -4, tint: 'accent', glow: true, sway: true, phone });

const SECTIONS: SectionInstanceInput[] = [
  {
    id: 'hero',
    section: 'hero',
    variant: 'balcony',
    props: {
      eyebrow: t('template.togetherForever'),
      title: TITLE,
      date: b('event.startDate', { format: 'date' }),
      dateEnd: b('event.endDate', { format: 'date' }),
      tagline: b('custom.tagline'),
      image: b('photo.cover', { fallback: b('photos[0]') }),
      cta: t('template.hero.invited'),
    },
  },
  {
    id: 'invitation',
    section: 'invitation',
    band: 'surface',
    props: { eyebrow: t('template.invitation.eyebrow'), lead: t('template.invitation.lead'), title: b('event.title'), text: b('event.description') },
    // The chhatri and the palace on one baseline; the peacock stands on the chhatri's plinth, its train over the
    // plinth's side; roses at both buildings' bases.
    decor: [
      roses('topLeft', 190, -18, -8),
      { art: 'chhatri', at: 'bottomLeft', size: 236, x: 96, y: -8, tint: 'surface', phone: 0.5 },
      { art: 'standingPeacock', at: 'bottomLeft', size: 120, x: 192, y: -16, tint: PEACOCK, phone: 0.5 },
      roses('bottomLeft', 150, -10, 0, 'y'),
      { art: 'palaceFacade', at: 'bottomRight', size: 286, x: 0, y: -3, tint: 'surface', phone: 0.5 },
      roses('bottomRight', 170, 150, -6, 'xy'),
      roses('bottomRight', 104, -22, -4, 'xy'),
    ],
  },
  { id: 'countdown', section: 'countdown', variant: 'ornate', band: 'deep', props: { heading: t('template.countdown.bigDay') } },
  {
    id: 'story',
    section: 'story',
    variant: 'arch',
    band: 'plain',
    props: { eyebrow: t('template.story.title'), heading: t('template.story.journey'), text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }), more: t('template.story.readMore') },
    decor: [
      { art: 'floralStrand', at: 'topLeft', size: 360, aspect: 0.3, x: 20, y: -6, tint: LEAF, sway: true },
      { art: 'floralStrand', at: 'topRight', size: 340, aspect: 0.3, x: 18, y: -6, flip: 'x', tint: LEAF, sway: true },
    ],
  },
  { id: 'schedule', section: 'eventTimeline', variant: 'arches', band: 'plain', props: { eyebrow: t('template.schedule.eyebrow'), heading: t('template.schedule.celebrate') } },
  {
    id: 'venue',
    section: 'venue',
    variant: 'photo',
    band: 'plain',
    props: { eyebrow: t('template.venue.eyebrow'), image: b('photo.venue') },
    // Roses in the top-right corner with one brass lantern hanging beside them.
    decor: [roses('topRight', 196, -24, -14, 'x'), lantern('topRight', 128, 168)],
  },
  {
    id: 'gallery',
    section: 'gallery',
    variant: 'carousel',
    band: 'plain',
    props: { eyebrow: t('template.gallery.eyebrow'), heading: t('template.gallery.captured') },
    decor: [roses('topLeft', 230, -26, -10), roses('bottomRight', 210, -20, 0, 'xy')],
  },
  { id: 'photos', section: 'photoShare', band: 'plain' },
  { id: 'essentials', section: 'essentials', band: 'surface', props: { stay: b('custom.accommodation'), travel: b('custom.travel'), gifts: b('custom.gifts'), menu: b('custom.menu') } },
  {
    id: 'updates',
    section: 'announcements',
    band: 'deep',
    props: { heading: t('template.announcements.eyebrow') },
    decor: [lantern('topLeft', 104, 30, 0.6), lantern('topLeft', 148, 76), lantern('topLeft', 118, 122), lantern('topRight', 132, 40, 0.55), lantern('topRight', 100, 88)],
  },
  {
    id: 'family',
    section: 'family',
    variant: 'houses',
    band: 'plain',
    props: { eyebrow: t('template.family.blessingsFrom'), text: b('custom.blessings'), partnerOneParents: b('custom.partnerOneParents'), partnerTwoParents: b('custom.partnerTwoParents') },
    decor: [roses('bottomLeft', 240, -24, 0, 'y'), roses('bottomRight', 184, -18, 0, 'xy')],
  },
  { id: 'quote', section: 'quote', variant: 'verse', band: 'plain', props: { text: b('custom.quote'), by: b('custom.quoteBy') } },
  { id: 'rsvp', section: 'rsvp', variant: 'invite', band: 'plain' },
  { id: 'footer', section: 'footer', variant: 'vista', props: { title: t('template.footer.seeYouSoon'), closing: b('custom.closing'), hashtag: b('custom.hashtag') } },
];

/** The Royal Heirloom's catalog entry (sorted ahead of the Signature 3D collection by `sortOrder`). */
export function royalHeirloom(sortOrder: number): CatalogEntry {
  const key = 'royal-heirloom';
  const name = 'The Royal Heirloom';
  const description =
    'Your photograph seen from a palace balcony, under carved Rajput arches, jasmine strands and brass lanterns. Then maroon, emerald and antique gold all the way down: arch-topped function cards, the countdown on emerald silk, the families’ blessings under Lord Ganesha, and a lake palace at sunset, a peacock on the balcony’s ledge, to close. With the shehnai.';
  return {
    meta: { key, name, description, category: 'Wedding', style: 'Royal', tier: 'SIGNATURE', badge: 'NEW', featured: true, tags: ['signature', 'hindu', 'rajasthani', 'royal', 'heritage', 'destination', 'palace'], eventTypes: ['WEDDING'], sortOrder },
    definition: {
      schemaVersion: 1,
      templateKey: key,
      type: 'WEBSITE',
      name,
      description,
      eventTypes: ['WEDDING'],
      languages: ['en', 'hi', 'hi-Latn'],
      theme: { colors: MAROON, radius: 16, ornament: 'mandala', dress: { frame: 'cusped', edge: 'none', corner: 'none', divider: 'fleuron' }, pattern: 'none', heroTone: 'light', look: 'heirloom', effect: 'petals' },
      fonts: fontsFor('heirloom'),
      capabilities: {
        editable: { colors: true, fonts: true, music: true, background: false, layout: true, photos: true, text: true, animation: true },
        colorPresets: [
          { name: 'Heirloom Maroon', colors: MAROON },
          { name: 'Rani & Emerald', colors: RANI },
          { name: 'Midnight Durbar', colors: MIDNIGHT },
        ],
        textSlots: (['tagline', 'quote', 'quoteBy', 'story', 'blessings', 'partnerOneParents', 'partnerTwoParents', 'menu', 'accommodation', 'travel', 'gifts', 'hashtag', 'closing'] as const).map((s) => SLOTS[s]),
        maxPhotos: 12,
        // The close is the design's own lake palace (the vista binds no photo), so no closing photo is offered.
        photoSlots: ['cover', 'story', 'venue'],
      },
      music: { allowCustomerChoice: true, defaultTrack: 'original-shehnai-darbar' },
      website: { intro: 'doors', nav: 'bar', pages: [{ id: 'home', sections: SECTIONS }] },
    },
  };
}
