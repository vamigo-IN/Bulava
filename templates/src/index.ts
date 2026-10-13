import type { CatalogEntry } from './builder';
import { canvasTemplates, retiredCanvasDesigns } from './canvas';
import { canvasFilms } from './canvas-films';
import { withFaith } from './faith';
import { VIDEO_TEMPLATES } from './video';
import { RETIRED_TEMPLATE_KEYS, WEBSITE_TEMPLATES } from './website';

export type { CatalogEntry, CatalogMeta, Tier } from './builder';
export { CANVAS_FILM_SOURCES, canvasFilmKey } from './canvas-films';
export { EMBLEM_CATEGORIES, faithOf } from './faith';

/** Every template with its faith applied (faith.ts): the tag, the theme's faith, the wording and the emblem. */
const WEBSITES = WEBSITE_TEMPLATES.map(withFaith);
const CANVAS_TEMPLATES = canvasTemplates(WEBSITE_TEMPLATES.length).map(withFaith);
/** Films are made from canvas designs, including ones retired from the websites as lookalikes (their films stay). */
const FILM_SOURCES = [...CANVAS_TEMPLATES, ...retiredCanvasDesigns().map(withFaith)];

/** All catalog templates (website, canvas-designed website, video and digital cards, and films drawn from canvas invitations). */
export const TEMPLATE_CATALOG: CatalogEntry[] = [...WEBSITES, ...CANVAS_TEMPLATES, ...VIDEO_TEMPLATES.map(withFaith), ...canvasFilms(FILM_SOURCES, 100 + VIDEO_TEMPLATES.length)];

/** Keys removed from the catalog (lookalikes); the seed switches them off. */
export { RETIRED_TEMPLATE_KEYS };
