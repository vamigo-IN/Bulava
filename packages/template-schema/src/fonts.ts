import type { Fonts } from './definition';

/**
 * Curated type pairings customers can switch between (capabilities.editable.fonts).
 * Every pairing keeps Devanagari fallbacks, so Hindi and Marathi text always
 * renders in a matching face. Families must be listed in FONT_FAMILIES and
 * loaded by the host app (see FONT_CSS_VARS in the template engine).
 */
export interface FontPairing {
  key: string;
  /** Shown in the design panel. */
  label: string;
  fonts: Fonts;
}

const deva = { serif: { Deva: 'Noto Serif Devanagari' }, sans: { Deva: 'Noto Sans Devanagari' }, script: { Deva: 'Tiro Devanagari Hindi' } } as const;

export const FONT_PAIRINGS: readonly FontPairing[] = [
  {
    key: 'royal',
    label: 'Royal',
    fonts: {
      heading: { family: 'Cormorant Garamond', scripts: ['Latn'], fallbacks: deva.serif },
      body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: deva.sans },
      script: { family: 'Great Vibes', scripts: ['Latn'], fallbacks: deva.script },
    },
  },
  {
    key: 'regal',
    label: 'Regal',
    fonts: {
      heading: { family: 'Cinzel', scripts: ['Latn'], fallbacks: deva.serif },
      body: { family: 'Montserrat', scripts: ['Latn'], fallbacks: deva.sans },
      script: { family: 'Pinyon Script', scripts: ['Latn'], fallbacks: deva.script },
    },
  },
  {
    key: 'romantic',
    label: 'Romantic',
    fonts: {
      heading: { family: 'Cormorant Garamond', scripts: ['Latn'], fallbacks: deva.serif },
      body: { family: 'Montserrat', scripts: ['Latn'], fallbacks: deva.sans },
      script: { family: 'Parisienne', scripts: ['Latn'], fallbacks: deva.script },
    },
  },
  {
    key: 'classic',
    label: 'Classic',
    fonts: {
      heading: { family: 'Playfair Display', scripts: ['Latn'], fallbacks: deva.serif },
      body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: deva.sans },
      script: { family: 'Great Vibes', scripts: ['Latn'], fallbacks: deva.script },
    },
  },
  {
    key: 'elegant',
    label: 'Elegant',
    fonts: {
      heading: { family: 'Marcellus', scripts: ['Latn'], fallbacks: deva.serif },
      body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: deva.sans },
      script: { family: 'Alex Brush', scripts: ['Latn'], fallbacks: deva.script },
    },
  },
  {
    key: 'editorial',
    label: 'Editorial',
    fonts: {
      heading: { family: 'Italiana', scripts: ['Latn'], fallbacks: deva.serif },
      body: { family: 'Montserrat', scripts: ['Latn'], fallbacks: deva.sans },
      script: { family: 'Playfair Display', scripts: ['Latn'], fallbacks: deva.serif },
    },
  },
  {
    key: 'grand',
    label: 'Grand',
    fonts: {
      heading: { family: 'Yeseva One', scripts: ['Latn'], fallbacks: { Deva: 'Rozha One' } },
      body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: deva.sans },
      script: { family: 'Great Vibes', scripts: ['Latn'], fallbacks: deva.script },
    },
  },
  {
    key: 'desi',
    label: 'Desi',
    fonts: {
      heading: { family: 'Yatra One', scripts: ['Latn', 'Deva'], fallbacks: {} },
      body: { family: 'Poppins', scripts: ['Latn', 'Deva'], fallbacks: {} },
      script: { family: 'Rozha One', scripts: ['Latn', 'Deva'], fallbacks: {} },
    },
  },
  {
    key: 'modern',
    label: 'Modern',
    fonts: {
      heading: { family: 'Poppins', scripts: ['Latn', 'Deva'], fallbacks: {} },
      body: { family: 'Poppins', scripts: ['Latn', 'Deva'], fallbacks: {} },
    },
  },
];

export function fontPairing(key: string | undefined): FontPairing | undefined {
  return key ? FONT_PAIRINGS.find((p) => p.key === key) : undefined;
}
