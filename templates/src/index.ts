import { stageWebsite, type CatalogEntry } from './builder';
import { canvasTemplates, retiredCanvasDesigns } from './canvas';
import { canvasFilms } from './canvas-films';
import { withFaith } from './faith';
import { royalHeirloom } from './heirloom';
import { STAGE_TEMPLATE_SPECS } from './stages';
import { stageFilm, VIDEO_TEMPLATES } from './video';
import { RETIRED_TEMPLATE_KEYS, WEBSITE_TEMPLATES } from './website';

export type { CatalogEntry, CatalogMeta, Tier } from './builder';
export { CANVAS_FILM_SOURCES, canvasFilmKey } from './canvas-films';
export { EMBLEM_CATEGORIES, faithOf } from './faith';

/** Every template with its faith applied (faith.ts): the tag, the theme's faith, the wording and the emblem. */
const WEBSITES = WEBSITE_TEMPLATES.map(withFaith);
/** Hand-made Signature websites of engine sections (heirloom.ts), at fixed sort orders that shift no other template. */
const HEIRLOOM = [withFaith(royalHeirloom(-120))];
const CANVAS_TEMPLATES = canvasTemplates(WEBSITE_TEMPLATES.length).map(withFaith);
/** Films are made from canvas designs, including ones retired from the websites as lookalikes (their films stay). */
const FILM_SOURCES = [...CANVAS_TEMPLATES, ...retiredCanvasDesigns().map(withFaith)];

/** The Signature 3D collection (ADR-078, final.md §5.2): websites at sort orders -100…-82 and films at -60…-42, ahead of the older catalog. */
const STAGE_WEBSITES = STAGE_TEMPLATE_SPECS.map((spec, i) => withFaith(stageWebsite(spec.website, -100 + i)));
const STAGE_FILMS = STAGE_TEMPLATE_SPECS.map((spec, i) => withFaith(stageFilm(spec, -60 + i)));

/** All catalog templates (website, Signature 3D website, canvas-designed website, video and digital cards, Signature 3D films, and films drawn from canvas invitations). */
export const TEMPLATE_CATALOG: CatalogEntry[] = [...WEBSITES, ...HEIRLOOM, ...STAGE_WEBSITES, ...CANVAS_TEMPLATES, ...VIDEO_TEMPLATES.map(withFaith), ...STAGE_FILMS, ...canvasFilms(FILM_SOURCES, 100 + VIDEO_TEMPLATES.length)];

/** Keys removed from the catalog (lookalikes); the seed switches them off. */
export { RETIRED_TEMPLATE_KEYS };
