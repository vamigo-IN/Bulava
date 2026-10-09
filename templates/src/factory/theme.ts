import type { EffectName, IntroName, LookName } from '@bulava/template-schema';
import { palette, type FontPreset } from '../builder';
import type { CanvasSpec } from '../canvas-kit';
import { COMPOSITION_BLURB, COMPOSITIONS, type CompositionKey } from './compositions';
import { OCCASIONS, type Kit, type OccasionKey } from './kit';

export type Pal = ReturnType<typeof palette>;
export type Tier = 'FREE' | 'STANDARD' | 'PREMIUM';

/** One template a theme makes: a composition, the second word of its name, and any change to the kit. */
export interface Layout {
  layout: CompositionKey;
  word: string;
  kit?: Partial<Kit>;
  tier?: Tier;
  featured?: boolean;
}

/**
 * A theme: a look a graphic designer would name (Rajwada, Mor, Kovil…), with
 * its palette and presets, fonts, art kit and the layouts it suits. Each
 * layout becomes one template named "<word> <layout word>".
 */
export interface Theme {
  key: string;
  word: string;
  /** Opens every description: "Royal Rajasthani maroon and gold". */
  phrase: string;
  occasion: OccasionKey;
  /** The occasion's event types in another order: the first is the one previews show (MUNDAN for a mundan theme). */
  eventTypes?: string[];
  style: string;
  tags: string[];
  /** The default colours, named for the preset list. */
  colors: [string, Pal];
  presets: Array<[string, Pal]>;
  fonts: FontPreset;
  look: LookName;
  effect: EffectName;
  intro?: IntroName;
  kit: Kit;
  layouts: Layout[];
}

const TIER_OF: Record<CompositionKey, Tier> = {
  jharokha: 'PREMIUM',
  portrait: 'PREMIUM',
  mandap: 'PREMIUM',
  temple: 'PREMIUM',
  night: 'PREMIUM',
  couple: 'STANDARD',
  arch: 'STANDARD',
  floral: 'STANDARD',
  split: 'STANDARD',
  home: 'STANDARD',
  dream: 'STANDARD',
  minimal: 'FREE',
  photo: 'FREE',
  party: 'FREE',
};

/** A layout entry: the composition, the second word of the name, changes to the kit, the tier, featured. */
export const L = (layout: CompositionKey, word: string, kit?: Partial<Kit>, tier?: Tier, featured?: boolean): Layout => ({
  layout,
  word,
  ...(kit ? { kit } : {}),
  ...(tier ? { tier } : {}),
  ...(featured ? { featured } : {}),
});

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The templates a theme makes. */
export function themeSpecs(theme: Theme): CanvasSpec[] {
  const occ = OCCASIONS[theme.occasion];
  return theme.layouts.map((l) => {
    const kit: Kit = { ...theme.kit, ...l.kit, ...(occ.longTitle ? { titleScale: 0.7 } : {}) };
    const built = COMPOSITIONS[l.layout].build(kit, occ);
    const name = `${theme.word} ${l.word}`;
    const blurb = COMPOSITION_BLURB[l.layout](kit);
    return {
      key: `${slug(name)}-invite`,
      name,
      description: `${theme.phrase}: ${blurb}.`,
      category: occ.category,
      style: theme.style,
      tier: l.tier ?? TIER_OF[l.layout],
      ...(l.featured ? { featured: true } : {}),
      tags: [...new Set([...theme.tags, 'illustrated', l.layout])],
      eventTypes: theme.eventTypes ?? occ.eventTypes,
      colors: theme.colors[1],
      presets: [theme.colors, ...theme.presets].map(([n, c]) => ({ name: n, colors: c })),
      fonts: theme.fonts,
      look: theme.look,
      effect: theme.effect,
      ...(theme.intro ? { intro: theme.intro } : {}),
      slots: occ.slots,
      photoSlots: occ.photoSlots,
      hero: built.hero,
      card: built.card,
      middle: occ.middle,
    };
  });
}

export { palette };
