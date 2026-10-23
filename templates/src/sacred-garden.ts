import type { SectionInstanceInput, ThemeColors, Value, VALUE_FORMATS } from '@bulava/template-schema';
import { fontsFor, INVOCATION, palette, SLOTS, TITLE, type CatalogEntry } from './builder';

/**
 * The Sacred Garden (Signature): a Nikah invitation that opens from a sealed envelope onto a carved garden arch, two
 * swans meeting on the lake beyond it. Then one phone-wide column of cream and torn paper all the way down (the
 * deckle look, ADR-081): the Bismillah and a verse, the guests' welcome, a candlelit countdown, the programme with a
 * peony riding its stem, the venue in ink, the dress code and gifts between rose vines, a wax seal that opens the
 * reply, and the couple's photograph rising out of the paper to close. Built from engine sections, like The Royal
 * Heirloom, so every word reflows and translates; the art is drawn in code.
 */

const b = (binding: string, extra: Partial<{ format: (typeof VALUE_FORMATS)[number]; fallback: Value }> = {}): Value => ({ binding, ...extra });
const t = (key: string): Value => ({ t: key });

/** Cream and torn paper, antique gold and a deep wine wax (the default). */
const GARDEN: ThemeColors = palette('#5A0F1B', '#A67D2B', '#D8BA72', '#F9F0E0', '#EFE3D2', '#6C513F', '#846F61');
/** Sage and old gold on a cooler ivory. */
const SAGE: ThemeColors = palette('#3E5A45', '#97793A', '#D6C38E', '#F6F2E7', '#E8E4D3', '#4D5145', '#767A68');
/** Dusky rose and rose gold on blush paper. */
const DUSK: ThemeColors = palette('#7A2E3A', '#A8745A', '#E4BFAA', '#FBF1EB', '#F1E0D6', '#664640', '#8A6B64');

const SECTIONS: SectionInstanceInput[] = [
  {
    id: 'hero',
    section: 'hero',
    variant: 'swans',
    props: {
      eyebrow: t('template.hero.weddingDay'),
      title: TITLE,
      date: b('event.startDate', { format: 'dateNumeric' }),
      invocation: { literal: INVOCATION.muslim },
      cta: t('template.hero.scrollDown'),
    },
  },
  // The verse and the welcome continue the hero's paper: the design's own lines unless the hosts write theirs.
  { id: 'verse', section: 'quote', band: 'surface', props: { text: b('custom.quote', { fallback: t('template.quote.twoSouls') }), by: b('custom.quoteBy') } },
  { id: 'welcome', section: 'invitation', band: 'surface', props: { lead: t('template.invitation.dearFamily'), text: b('custom.welcome', { fallback: t('template.invitation.welcome') }) } },
  { id: 'countdown', section: 'countdown', variant: 'shimmer', band: 'plain', props: { heading: t('template.countdown.beginsIn') } },
  { id: 'schedule', section: 'eventTimeline', variant: 'stem', band: 'surface', props: { heading: t('template.schedule.ofEvents') } },
  { id: 'venue', section: 'venue', variant: 'sketch', band: 'plain', props: { heading: t('template.venue.location') } },
  {
    id: 'essentials',
    section: 'essentials',
    band: 'surface',
    props: { dressCode: b('custom.dressCode'), gifts: b('custom.gifts'), menu: b('custom.menu'), stay: b('custom.accommodation'), travel: b('custom.travel') },
  },
  { id: 'rsvp', section: 'rsvp', variant: 'seal', band: 'plain', props: { heading: t('template.rsvp.attendance'), text: t('template.rsvp.prepare') } },
  { id: 'footer', section: 'footer', variant: 'bloom', props: { title: b('custom.closing', { fallback: t('template.footer.hopeToSee') }), image: b('photo.cover', { fallback: b('photo.closing') }) } },
];

/** The Sacred Garden's catalog entry (sorted with The Royal Heirloom, ahead of the Signature 3D collection). */
export function sacredGarden(sortOrder: number): CatalogEntry {
  const key = 'sacred-garden';
  const name = 'The Sacred Garden';
  const description =
    'A Nikah invitation that opens from an envelope sealed in wine-red wax onto a carved garden arch, two swans meeting on the misty lake beyond it. Then cream and torn paper in antique gold: the Bismillah and a verse, a candlelit countdown, the programme with a peony riding its stem, the venue drawn in ink, a wax seal that opens the reply, and your photograph rising out of the paper to close. With an original piano barcarolle.';
  return {
    meta: { key, name, description, category: 'Wedding', style: 'Romantic', tier: 'SIGNATURE', badge: 'NEW', featured: true, tags: ['signature', 'muslim', 'nikah', 'garden', 'romantic', 'floral', 'pastel'], eventTypes: ['WEDDING'], sortOrder },
    definition: {
      schemaVersion: 1,
      templateKey: key,
      type: 'WEBSITE',
      name,
      description,
      eventTypes: ['WEDDING'],
      languages: ['en', 'hi', 'hi-Latn'],
      theme: { colors: GARDEN, radius: 6, ornament: 'floral', pattern: 'none', heroTone: 'light', look: 'deckle', effect: 'none' },
      fonts: fontsFor('engraved'),
      capabilities: {
        editable: { colors: true, fonts: true, music: true, background: false, layout: true, photos: true, text: true, animation: true },
        colorPresets: [
          { name: 'Sacred Garden', colors: GARDEN },
          { name: 'Sage Garden', colors: SAGE },
          { name: 'Rose Dusk', colors: DUSK },
        ],
        textSlots: (['quote', 'quoteBy', 'welcome', 'dressCode', 'gifts', 'menu', 'accommodation', 'travel', 'closing'] as const).map((s) => SLOTS[s]),
        maxPhotos: 4,
        // The close is the couple's photograph (the cover; the arch and its swans are the design's own up top).
        photoSlots: ['cover', 'closing'],
      },
      music: { allowCustomerChoice: true, defaultTrack: 'original-sacred-garden' },
      website: { intro: 'sealedEnvelope', nav: 'none', pages: [{ id: 'home', sections: SECTIONS }] },
      // The design's own programme and lines for its previews: an evening of five, the dress code and the gifts as
      // the card words them, and no sample verse or menu over the design's own (empty slots fall back to its words).
      sample: {
        functions: [
          { name: 'Guest Arrival', time: '17:00' },
          { name: 'Nikkah Ceremony', time: '18:00' },
          { name: 'Mocktail Hour', time: '19:00' },
          { name: 'Dinner', time: '20:00' },
          { name: 'Dance', time: '21:00' },
        ],
        custom: {
          quote: '',
          quoteBy: '',
          menu: '',
          dressCode: 'We kindly ask guests to avoid deep red and maroon attire for the celebration.',
          gifts: 'Kindly, no boxed gifts please.',
        },
      },
    },
  };
}
