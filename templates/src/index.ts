import type { CatalogEntry } from './builder';
import { canvasTemplates } from './canvas';
import { canvasFilms } from './canvas-films';
import { VIDEO_TEMPLATES } from './video';
import { RETIRED_TEMPLATE_KEYS, WEBSITE_TEMPLATES } from './website';

export type { CatalogEntry, CatalogMeta, Tier } from './builder';
export { CANVAS_FILM_SOURCES, canvasFilmKey } from './canvas-films';

const CANVAS_TEMPLATES = canvasTemplates(WEBSITE_TEMPLATES.length);

/** All catalog templates (website, canvas-designed website, video and digital cards, and films drawn from canvas invitations). */
export const TEMPLATE_CATALOG: CatalogEntry[] = [...WEBSITE_TEMPLATES, ...CANVAS_TEMPLATES, ...VIDEO_TEMPLATES, ...canvasFilms(CANVAS_TEMPLATES, 100 + VIDEO_TEMPLATES.length)];

/** Keys removed from the catalog (lookalikes); the seed switches them off. */
export { RETIRED_TEMPLATE_KEYS };
