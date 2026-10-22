import type { ReactNode } from 'react';
import type { Translator } from '@bulava/localization';
import type { Artwork, EffectName, Fonts, IntroName, LookName, RenderContext, SectionInstance, ThemeColors, ThemeDress } from '@bulava/template-schema';
import type { OrnamentName } from './ornaments';

/** Interactive pieces the host app injects into template slots. */
export interface RenderSlots {
  /** RSVP form for personalized invitations. */
  rsvp?: ReactNode;
  /** QR photo-upload rooms / gallery links. */
  photoShare?: ReactNode;
  /** Guest check-in QR. */
  checkIn?: ReactNode;
  /** The guest's own event-day details (stay, travel, table), shown with the check-in pass. */
  guestInfo?: ReactNode;
  /** Show the "Made with Bulava" mark (free plan). */
  watermark?: boolean;
  /** The free plan's mark across the whole invitation: this text (the site's address) tiled over every section (ADR-067). */
  veil?: string;
  /** Heading for the RSVP section when the host app puts something else there (e.g. registration). */
  rsvpHeading?: string;
}

export type RenderMode = 'live' | 'preview' | 'thumbnail';

export interface SectionProps {
  instance: SectionInstance;
  ctx: RenderContext;
  /** Resolved prop as a display string (undefined when empty). */
  value: (key: string) => string | undefined;
  t: Translator;
  language: string;
  timeZone: string;
  /** The theme's ornament: its motif, and the suite every section is dressed in (sections/suites.ts). */
  ornament: OrnamentName;
  /** Pieces of the suite the theme swaps for others (theme.dress). */
  dress?: ThemeDress;
  pattern: string;
  /** Effective theme colours (after customization), for pattern images. */
  colors: ThemeColors;
  heroTone: 'light' | 'dark';
  /** Design language (restyles backgrounds, headings, cards and dividers). */
  look: LookName;
  /** Position among the rendered sections (0 = hero); looks alternate bands by it. */
  index: number;
  slots: RenderSlots;
  mode: RenderMode;
  /** The template's painted artworks (hero variant "artwork"). */
  artworks?: Record<string, Artwork>;
  /** Effective fonts (after the host's pairing), for canvas text. */
  fonts: Fonts;
  /** Id of the page's RSVP section, which canvas RSVP buttons scroll to. */
  rsvpSectionId?: string;
  /** Draws one of the template's own sections behind a host's redrawn one (canvas section layers, ADR-065). */
  drawSection?: (sectionId: string, index: number) => ReactNode;
  /**
   * The page's effective opening and effect (effectiveMotion): a stage hero builds its
   * opening's cover pieces and draws the effect as particles at depth (ADR-078).
   */
  motion?: { intro: IntroName; effect: EffectName };
}
