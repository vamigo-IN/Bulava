import type { CatalogEntry } from './builder';
import { VIDEO_TEMPLATES } from './video';
import { RETIRED_TEMPLATE_KEYS, WEBSITE_TEMPLATES } from './website';

export type { CatalogEntry, CatalogMeta, Tier } from './builder';

/** All catalog templates (website, video and digital cards). */
export const TEMPLATE_CATALOG: CatalogEntry[] = [...WEBSITE_TEMPLATES, ...VIDEO_TEMPLATES];

/** Keys removed from the catalog (lookalikes); the seed switches them off. */
export { RETIRED_TEMPLATE_KEYS };
