import { z } from 'zod';

/**
 * The templates the home page shows, section by section (and the first cards of
 * the card gallery), chosen by staff in the console's Home page screen
 * (showcase.manage). A section with no picks chooses its own templates, as it
 * always has. Picks that are no longer published, or no longer fit their
 * section, are skipped on the site and flagged in the console.
 */
export const SHOWCASE_SECTIONS = ['hero', 'heroBack', 'scenes', 'collection', 'spotlight', 'videos', 'cards'] as const;
export type ShowcaseSection = (typeof SHOWCASE_SECTIONS)[number];

/** What a template must be to appear in a section: an invitation website, a film, or a card (a canvas opening). */
export type ShowcaseFit = 'website' | 'video' | 'card';

export const SHOWCASE_RULES: Record<ShowcaseSection, { max: number; fit: ShowcaseFit }> = {
  /** The phone playing live in the hero. */
  hero: { max: 1, fit: 'website' },
  /** The two phones behind it. */
  heroBack: { max: 2, fit: 'website' },
  /** The illustrated scenes carousel. */
  scenes: { max: 12, fit: 'website' },
  /** The collection grid: picks come first, the rest of the catalog follows (the grid filters). */
  collection: { max: 24, fit: 'website' },
  /** The large feature below the collection. */
  spotlight: { max: 1, fit: 'website' },
  /** The video invitations. */
  videos: { max: 3, fit: 'video' },
  /** The digital card gallery's "Featured" order: picks first. */
  cards: { max: 24, fit: 'card' },
};

/** Whether a published template (its outputs and the opening section's kind) fits a section. */
export function fitsShowcase(section: ShowcaseSection, template: { outputs: readonly string[]; heroSection?: string | null }): boolean {
  const fit = SHOWCASE_RULES[section].fit;
  if (fit === 'video') return template.outputs.includes('VIDEO');
  if (fit === 'card') return template.heroSection === 'canvas';
  return template.outputs.includes('WEBSITE');
}

const TemplateKey = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Not a template key');

export const ShowcaseSectionParamSchema = z.enum(SHOWCASE_SECTIONS);

/** A section's picks, in order. An empty list hands the section back to the automatic choice. */
export const ShowcaseInputSchema = z.object({
  templateKeys: z
    .array(TemplateKey)
    .max(24)
    .refine((keys) => new Set(keys).size === keys.length, 'Each template can be chosen once per section'),
});
export type ShowcaseInput = z.infer<typeof ShowcaseInputSchema>;

/** What the site reads: the published picks of each section that has any. */
export type PublicShowcase = Partial<Record<ShowcaseSection, string[]>>;
