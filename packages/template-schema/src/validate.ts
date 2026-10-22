import { z } from 'zod';
import { en } from '@bulava/localization';
import { BINDINGS, bindingsIn, isKnownBinding, translationKeysIn } from './bindings';
import { artboardAssetIds, canvasAssetIds, type Artboard } from './canvas';
import {
  ADDED_SECTION_WIDTH,
  SECTION_ORDER_MAX,
  AddedSectionsSchema,
  CanvasCustomizationSchema,
  canvasSectionsOf,
  replaceable,
  withCanvasCustomization,
  type AddedSection,
  type CanvasCustomization,
} from './canvas-custom';
import {
  AddedScenesSchema,
  FILM_BOARD,
  FILM_FORMATS,
  FILM_MAX_SECONDS,
  SceneCustomizationSchema,
  sceneBoardSize,
  withFilmCustomization,
  type AddedScene,
  type SceneCustomization,
} from './film-custom';
import {
  EFFECTS,
  INTROS,
  isStageIntro,
  PHOTO_SLOTS,
  STAGE_NAMES,
  TemplateDefinitionSchema,
  type EffectName,
  type Fonts,
  type IntroName,
  type PhotoSlot,
  type SectionInstance,
  type StageNameValue,
  type TemplateDefinition,
  type ThemeColors,
  type Value,
} from './definition';
import { fontPairing } from './fonts';
import { canRedraw } from './section-boards';

export interface ValidationIssue {
  path: string;
  message: string;
}

/** The stage a hero section shows (ADR-078): its `props.stage` literal when it is a stage hero, else null. */
export function heroStage(section: Pick<SectionInstance, 'section' | 'variant' | 'props'> | undefined): StageNameValue | null {
  if (!section || section.section !== 'hero' || section.variant !== 'stage') return null;
  const ref = section.props.stage;
  const name = ref && 'literal' in ref ? String(ref.literal) : '';
  return (STAGE_NAMES as readonly string[]).includes(name) ? (name as StageNameValue) : null;
}

/** The stage of a template whose first section is a stage hero (the only templates that take stage openings), else null. */
export function templateStage(definition: Pick<TemplateDefinition, 'website'>): StageNameValue | null {
  return heroStage(definition.website?.pages[0]?.sections[0]);
}

export type DefinitionValidation =
  | { ok: true; definition: TemplateDefinition }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Structural (Zod) + semantic validation. Semantic checks:
 *  - every binding exists (custom.* must be a declared text slot)
 *  - every translation key exists in the English catalog
 *  - ids are unique within pages/scenes
 *  - painted artwork referenced by heroes and backdrops exists, and every
 *    layer's asset is listed in `assets` (so publishing checks its licence)
 */
export function validateTemplateDefinition(input: unknown): DefinitionValidation {
  const parsed = TemplateDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  const d = parsed.data;
  const issues: ValidationIssue[] = [];
  const slots = d.capabilities.textSlots.map((s) => s.key);

  const checkValue = (value: Value | undefined, path: string) => {
    for (const b of bindingsIn(value)) {
      if (!isKnownBinding(b, slots)) issues.push({ path, message: `Unknown binding "${b}"` });
    }
    for (const k of translationKeysIn(value)) {
      if (!(k in en)) issues.push({ path, message: `Unknown translation key "${k}"` });
    }
  };

  const listed = new Set(d.assets.map((a) => a.assetId));

  /** A canvas artboard's layers (in a canvas section or a film's scene). */
  const checkBoard = (board: Artboard, base: string) => {
    const layerIds = new Set<string>();
    board.layers.forEach((layer, li) => {
      const path = `${base}.layers.${li}`;
      if (layerIds.has(layer.id)) issues.push({ path: `${path}.id`, message: `Duplicate layer id "${layer.id}"` });
      layerIds.add(layer.id);
      if (layer.kind === 'text') checkValue(layer.content, `${path}.content`);
      // Checked with the customization that holds it (a host's redrawn section, ADR-065).
      if (layer.kind === 'section') issues.push({ path, message: 'Only a section the host redrew draws one of the template’s sections' });
      if (layer.kind === 'image' && layer.source.type === 'binding') {
        const b = layer.source.binding;
        // Only the photo bindings: a text slot holds words anyone editing could make an address.
        if (!isKnownBinding(b, slots)) issues.push({ path: `${path}.source.binding`, message: `Unknown binding "${b}"` });
        else if (BINDINGS[b]?.type !== 'image') issues.push({ path: `${path}.source.binding`, message: `"${b}" is not an image` });
      }
      if (layer.kind === 'widget' && layer.widget.type === 'button') {
        checkValue(layer.widget.label, `${path}.widget.label`);
        checkValue(layer.widget.url, `${path}.widget.url`);
        if (layer.widget.action === 'link' && !layer.widget.url) issues.push({ path: `${path}.widget.url`, message: 'A link button needs an address' });
      }
      if (layer.visibleWhen?.exists && !isKnownBinding(layer.visibleWhen.exists, slots)) {
        issues.push({ path: `${path}.visibleWhen.exists`, message: `Unknown binding "${layer.visibleWhen.exists}"` });
      }
      // Far outside the artboard: probably a lost layer.
      if (layer.frame.x > board.width * 1.5 || layer.frame.y > board.height * 1.5 || layer.frame.x + layer.frame.w < -board.width * 0.5 || layer.frame.y + layer.frame.h < -board.height * 0.5) {
        issues.push({ path: `${path}.frame`, message: 'Layer is far outside the artboard' });
      }
    });
  };

  d.website?.pages.forEach((page, pi) => {
    const ids = new Set<string>();
    page.sections.forEach((s, si) => {
      const base = `website.pages.${pi}.sections.${si}`;
      if (ids.has(s.id)) issues.push({ path: `${base}.id`, message: `Duplicate section id "${s.id}"` });
      ids.add(s.id);
      for (const [key, v] of Object.entries(s.props)) checkValue(v, `${base}.props.${key}`);
      if (s.section === 'hero' && s.variant === 'artwork') {
        const ref = s.props.artwork;
        const key = ref && 'literal' in ref ? String(ref.literal) : undefined;
        if (!key || !d.artworks?.[key]) issues.push({ path: `${base}.props.artwork`, message: 'Choose one of this template’s artworks: { "literal": "<key>" }' });
      }
      if (s.section === 'hero' && s.variant === 'stage' && !heroStage(s)) {
        issues.push({ path: `${base}.props.stage`, message: 'Choose one of the stages: { "literal": "<name>" }' });
      }
      if (s.visibleWhen?.exists && !isKnownBinding(s.visibleWhen.exists, slots)) {
        issues.push({ path: `${base}.visibleWhen.exists`, message: `Unknown binding "${s.visibleWhen.exists}"` });
      }
      if (s.section === 'canvas' && s.canvas) {
        const boards: Array<[string, Artboard | undefined]> = [
          ['mobile', s.canvas.mobile],
          ['desktop', s.canvas.desktop],
        ];
        for (const [name, board] of boards) {
          if (board) checkBoard(board, `${base}.canvas.${name}`);
        }
        for (const assetId of canvasAssetIds(s.canvas)) {
          if (!listed.has(assetId)) issues.push({ path: `${base}.canvas`, message: `List asset ${assetId} in assets so its licence is checked` });
        }
      }
    });
  });

  // Stage openings move through a stage hero (ADR-078): the page has to open on one.
  if (d.website && isStageIntro(d.website.intro) && !templateStage(d)) {
    issues.push({ path: 'website.intro', message: 'This opening needs a 3D stage: make the first section a stage hero' });
  }

  const sceneIds = new Set<string>();
  d.scenes?.forEach((scene, si) => {
    if (isStageIntro(scene.reveal) && !scene.backdrop?.stage) issues.push({ path: `scenes.${si}.reveal`, message: 'This opening needs a 3D stage backdrop' });
    if (scene.backdrop?.shot && !scene.backdrop.stage) issues.push({ path: `scenes.${si}.backdrop.shot`, message: 'Only a stage backdrop takes a shot' });
    if (sceneIds.has(scene.id)) issues.push({ path: `scenes.${si}.id`, message: `Duplicate scene id "${scene.id}"` });
    sceneIds.add(scene.id);
    if (scene.backdrop?.artwork && !d.artworks?.[scene.backdrop.artwork]) {
      issues.push({ path: `scenes.${si}.backdrop.artwork`, message: `Unknown artwork "${scene.backdrop.artwork}"` });
    }
    const elIds = new Set<string>();
    scene.elements.forEach((el, ei) => {
      const base = `scenes.${si}.elements.${ei}`;
      if (elIds.has(el.id)) issues.push({ path: `${base}.id`, message: `Duplicate element id "${el.id}"` });
      elIds.add(el.id);
      checkValue(el.content, `${base}.content`);
      if (d.canvas && (el.frame.x + el.frame.w > d.canvas.width * 1.5 || el.frame.y + el.frame.h > d.canvas.height * 1.5)) {
        issues.push({ path: `${base}.frame`, message: 'Element is far outside the canvas' });
      }
    });
    if (scene.canvas) {
      checkBoard(scene.canvas.board, `scenes.${si}.canvas.board`);
      for (const assetId of artboardAssetIds(scene.canvas.board)) {
        if (!listed.has(assetId)) issues.push({ path: `scenes.${si}.canvas`, message: `List asset ${assetId} in assets so its licence is checked` });
      }
    }
  });

  for (const [key, artwork] of Object.entries(d.artworks ?? {})) {
    artwork.layers.forEach((layer, li) => {
      if (!listed.has(layer.assetId)) issues.push({ path: `artworks.${key}.layers.${li}.assetId`, message: 'List this asset in assets so its licence is checked' });
    });
  }

  return issues.length ? { ok: false, issues } : { ok: true, definition: d };
}

/** Every asset the template's painted artwork uses (for licence checks, signing and preloading). */
export function artworkAssetIds(definition: Pick<TemplateDefinition, 'artworks'>): string[] {
  return [...new Set(Object.values(definition.artworks ?? {}).flatMap((a) => a.layers.map((l) => l.assetId)))];
}

/** Every image asset the template shows: painted artwork layers and canvas images, on pages and in films (for signing in previews). */
export function templateAssetIds(definition: Pick<TemplateDefinition, 'artworks' | 'website'> & Partial<Pick<TemplateDefinition, 'scenes'>>): string[] {
  const canvas = (definition.website?.pages ?? []).flatMap((p) => p.sections.flatMap((s) => (s.section === 'canvas' && s.canvas ? canvasAssetIds(s.canvas) : [])));
  const films = (definition.scenes ?? []).flatMap((s) => (s.canvas ? artboardAssetIds(s.canvas.board) : []));
  return [...new Set([...artworkAssetIds(definition), ...canvas, ...films])];
}

/** Total video duration in seconds for a context with `functionCount` functions. */
export function videoDurationSec(definition: TemplateDefinition, functionCount: number): number {
  return (definition.scenes ?? []).reduce(
    (sum, s) => sum + s.durationSec * (s.repeatPerFunction ? Math.max(1, functionCount) : 1),
    0,
  );
}

// ─────────────────────────── Customization ───────────────────────────

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const CustomizationSchema = z.object({
  colors: z
    .object({
      primary: hex,
      secondary: hex,
      accent: hex,
      background: hex,
      surface: hex,
      text: hex,
      muted: hex,
    })
    .partial()
    .optional(),
  /** Name of one of capabilities.colorPresets. */
  colorPreset: z.string().max(40).optional(),
  musicId: z.uuid().nullable().optional(),
  custom: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/), z.string().max(2000)).optional(),
  /** Media item ids (from the event's media) to use as template photos. */
  photoIds: z.array(z.uuid()).max(50).optional(),
  /** Photos placed in named spots (cover, each partner, story, closing): media item ids. */
  photoSlots: z.partialRecord(z.enum(PHOTO_SLOTS), z.uuid()).optional(),
  /** One of FONT_PAIRINGS (when fonts are editable). */
  fontPairing: z.string().max(40).optional(),
  /** Opening animation (when animation is editable). */
  intro: z.enum(INTROS).optional(),
  /** Ambient effect (when animation is editable). */
  effect: z.enum(EFFECTS).optional(),
  /** Section ids the customer hid (when layout is editable). The hero always shows. */
  hiddenSections: z.array(z.string().max(64)).max(40).optional(),
  /** Canvas sections the customer redrew in the canvas editor, by section id (when layout is editable; ADR-057). */
  canvas: CanvasCustomizationSchema.optional(),
  /** Canvas sections the customer added to the page (when layout is editable; ADR-059). */
  addedSections: AddedSectionsSchema.optional(),
  /** The page's sections in the customer's order: the template's section ids and their own (a redrawn one by its original's id); the opening stays first and the footer last (when layout is editable; ADR-065). */
  sectionOrder: z.array(z.string().max(64)).max(SECTION_ORDER_MAX).optional(),
  /** A film's scenes the customer redrew in the film's canvas editor, by scene id (when layout is editable; ADR-059). */
  scenes: SceneCustomizationSchema.optional(),
  /** Scenes the customer added to their film (when layout is editable; ADR-061). */
  addedScenes: AddedScenesSchema.optional(),
  /** The film's size: 9:16 as designed, square or wide (films only; ADR-061). */
  filmFormat: z.enum(FILM_FORMATS).optional(),
});
export type Customization = z.infer<typeof CustomizationSchema>;

const bindingOnly = (value: Value): boolean => 'binding' in value && (!value.fallback || bindingOnly(value.fallback));

/**
 * What a customer's redrawn canvas sections may hold (ADR-057): the template's
 * own sections at their sizes, link buttons that keep the template's address
 * or point at the event's own details (never another site), and otherwise what
 * any template may hold (known bindings and words, the template's licensed assets).
 */
/** The addresses the template's own link buttons use: a host may keep them. */
function ownLinksOf(boards: Array<Artboard | undefined>): Set<string> {
  const links = new Set<string>();
  for (const board of boards) for (const layer of board?.layers ?? []) if (layer.kind === 'widget' && layer.widget.type === 'button' && layer.widget.url) links.add(JSON.stringify(layer.widget.url));
  return links;
}

/** Link buttons on a host's board: the event's own details (a binding), or an address the template itself uses. */
function linkIssues(board: Artboard, path: string, ownLinks: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  board.layers.forEach((layer, li) => {
    const url = layer.kind === 'widget' && layer.widget.type === 'button' ? layer.widget.url : undefined;
    if (url && !bindingOnly(url) && !ownLinks.has(JSON.stringify(url))) issues.push({ path: `${path}.layers.${li}.widget.url`, message: 'A button can link only to this event’s own details' });
  });
  return issues;
}

function canvasCustomizationIssues(definition: TemplateDefinition, canvas: CanvasCustomization, added: readonly AddedSection[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sections = new Map(canvasSectionsOf(definition).map((s) => [s.id, s.canvas]));
  const ownLinks = ownLinksOf([...sections.values()].flatMap((own) => [own.mobile, own.desktop]));
  // Sections the host added: unique, after a section of the template (or at the end), phone-wide;
  // a redrawn one stands in for one of the template's own sections, never twice for the same one.
  const pageSections = new Map((definition.website?.pages[0]?.sections ?? []).map((sec) => [sec.id, sec]));
  const pageIds = new Set(pageSections.keys());
  const addedIds = new Set<string>();
  const standIns = new Set<string>();
  added.forEach((a, i) => {
    const path = `addedSections.${i}`;
    if (addedIds.has(a.id) || pageIds.has(a.id)) issues.push({ path: `${path}.id`, message: `Section id ${a.id} is taken` });
    addedIds.add(a.id);
    if (a.after && !pageIds.has(a.after)) issues.push({ path: `${path}.after`, message: `This template has no section ${a.after}` });
    if (a.replaces) {
      if (!replaceable(pageSections.get(a.after))) issues.push({ path: `${path}.replaces`, message: 'Only a section of the template (not one of its canvases or the footer) can be redrawn' });
      else if (standIns.has(a.after)) issues.push({ path: `${path}.replaces`, message: `Section ${a.after} is redrawn already` });
      standIns.add(a.after);
    }
    if (a.mobile.width !== ADDED_SECTION_WIDTH || a.mobile.height < 120 || a.mobile.height > 2400) issues.push({ path: `${path}.mobile`, message: `An added section is ${ADDED_SECTION_WIDTH} wide and 120 to 2400 high` });
    issues.push(...linkIssues(a.mobile, `${path}.mobile`, ownLinks));
    // The section it stands in for, drawn behind it (ADR-065): once, and only that one.
    const drawn = a.mobile.layers.flatMap((layer, li) => (layer.kind === 'section' ? [{ layer, li }] : []));
    for (const { layer, li } of drawn) {
      if (!a.replaces || layer.section !== a.after || !canRedraw(pageSections.get(a.after) ?? { section: 'canvas' })) issues.push({ path: `${path}.mobile.layers.${li}`, message: 'A redrawn section can draw only the section it stands in for' });
    }
    if (drawn.length > 1) issues.push({ path: `${path}.mobile`, message: 'A section draws the template’s section once' });
  });
  for (const [id, override] of Object.entries(canvas)) {
    const own = sections.get(id);
    if ([override.mobile, override.desktop].some((board) => board?.layers.some((layer) => layer.kind === 'section'))) issues.push({ path: `canvas.${id}`, message: 'Only a section the host redrew draws one of the template’s sections' });
    if (!own) {
      issues.push({ path: `canvas.${id}`, message: `This template has no canvas section ${id}` });
      continue;
    }
    const boards: Array<['mobile' | 'desktop', Artboard | undefined, Artboard | undefined]> = [
      ['mobile', override.mobile, own.mobile],
      ['desktop', override.desktop, own.desktop],
    ];
    for (const [name, mine, theirs] of boards) {
      if (!mine) continue;
      const path = `canvas.${id}.${name}`;
      if (!theirs) {
        issues.push({ path, message: 'This section has no such artboard' });
        continue;
      }
      if (mine.width !== theirs.width || mine.height !== theirs.height) issues.push({ path, message: `This artboard is ${theirs.width} × ${theirs.height}` });
      issues.push(...linkIssues(mine, path, ownLinks));
    }
  }
  if (issues.length) return issues;
  // The drawn sections were checked above (the template's own section is no longer on the merged page).
  const plain = added.map((a) => ({ ...a, mobile: { ...a.mobile, layers: a.mobile.layers.filter((layer) => layer.kind !== 'section') } }));
  const applied = validateTemplateDefinition(withCanvasCustomization(definition, canvas, plain));
  // A stage opening on a template whose stage hero the host redrew still plays: the stand-in keeps the
  // stage behind its words, and without a stage DOM the opening falls back to its 2D twin (ADR-078).
  const redrawnStage = (i: { path: string }) => i.path === 'website.intro' && templateStage(definition) !== null;
  if (!applied.ok) issues.push(...applied.issues.filter((i) => !redrawnStage(i)).map((i) => ({ path: `canvas (${i.path})`, message: i.message })));
  return issues;
}

/**
 * What a customer's redrawn film scenes may hold (ADR-059): the film's own
 * scenes, each board at its scene's size, links to the event's own details,
 * and otherwise what any film may hold.
 */
function sceneCustomizationIssues(definition: TemplateDefinition, scenes: SceneCustomization, added: readonly AddedScene[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (definition.type !== 'VIDEO') return [{ path: added.length ? 'addedScenes' : 'scenes', message: 'Only films have scenes to redraw or add' }];
  const byId = new Map((definition.scenes ?? []).map((sc) => [sc.id, sc]));
  const ownLinks = ownLinksOf((definition.scenes ?? []).map((sc) => sc.canvas?.board));
  // Scenes the host added: unique, after one of the film's scenes (or at the end), on a 9:16 board.
  const addedIds = new Set<string>();
  added.forEach((a, i) => {
    const path = `addedScenes.${i}`;
    if (addedIds.has(a.id) || byId.has(a.id)) issues.push({ path: `${path}.id`, message: `Scene id ${a.id} is taken` });
    addedIds.add(a.id);
    if (a.after && !byId.has(a.after)) issues.push({ path: `${path}.after`, message: `This film has no scene ${a.after}` });
    if (a.board.width !== FILM_BOARD.width || a.board.height !== FILM_BOARD.height) issues.push({ path: `${path}.board`, message: `An added scene is ${FILM_BOARD.width} × ${FILM_BOARD.height}` });
    issues.push(...linkIssues(a.board, `${path}.board`, ownLinks));
  });
  for (const [id, mine] of Object.entries(scenes)) {
    const scene = byId.get(id);
    const path = `scenes.${id}`;
    if (!scene) {
      issues.push({ path, message: `This film has no scene ${id}` });
      continue;
    }
    const size = sceneBoardSize(scene);
    if (mine.board.width !== size.width || mine.board.height !== size.height) issues.push({ path: `${path}.board`, message: `This scene is ${size.width} × ${size.height}` });
    issues.push(...linkIssues(mine.board, `${path}.board`, ownLinks));
  }
  if (issues.length) return issues;
  const film = withFilmCustomization(definition, { scenes, addedScenes: added });
  const applied = validateTemplateDefinition(film);
  if (!applied.ok) issues.push(...applied.issues.map((i) => ({ path: `scenes (${i.path})`, message: i.message })));
  else if (videoDurationSec(applied.definition, 1) > FILM_MAX_SECONDS) issues.push({ path: 'addedScenes', message: `A film may run ${FILM_MAX_SECONDS} seconds at most` });
  return issues;
}

/** Reject anything the template does not allow the customer to change. */
export function validateCustomization(definition: TemplateDefinition, input: unknown): { ok: true; value: Customization } | { ok: false; issues: ValidationIssue[] } {
  const parsed = CustomizationSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
  }
  const c = parsed.data;
  const e = definition.capabilities.editable;
  const issues: ValidationIssue[] = [];
  if ((c.colors && Object.keys(c.colors).length) || c.colorPreset) {
    if (!e.colors) issues.push({ path: 'colors', message: 'This template does not allow colour changes' });
    // Presets are suggestions: custom colours may adjust one (text stays readable, see themeStyle).
    const presets = definition.capabilities.colorPresets;
    if (c.colorPreset && !presets.some((p) => p.name === c.colorPreset)) {
      issues.push({ path: 'colorPreset', message: 'Unknown colour preset' });
    }
  }
  if (c.fontPairing) {
    if (!e.fonts) issues.push({ path: 'fontPairing', message: 'This template does not allow font changes' });
    else if (!fontPairing(c.fontPairing)) issues.push({ path: 'fontPairing', message: 'Unknown font pairing' });
  }
  if ((c.intro || c.effect) && !e.animation) {
    issues.push({ path: c.intro ? 'intro' : 'effect', message: 'This template does not allow animation changes' });
  } else if (isStageIntro(c.intro) && !templateStage(definition)) {
    issues.push({ path: 'intro', message: 'This opening needs a 3D stage' });
  }
  if ((c.canvas && Object.keys(c.canvas).length) || c.addedSections?.length) {
    if (!e.layout) issues.push({ path: c.canvas ? 'canvas' : 'addedSections', message: 'This template does not allow layout changes' });
    else issues.push(...canvasCustomizationIssues(definition, c.canvas ?? {}, c.addedSections ?? []));
  }
  if ((c.scenes && Object.keys(c.scenes).length) || c.addedScenes?.length) {
    if (!e.layout) issues.push({ path: c.scenes ? 'scenes' : 'addedScenes', message: 'This film does not allow layout changes' });
    else issues.push(...sceneCustomizationIssues(definition, c.scenes ?? {}, c.addedScenes ?? []));
  }
  if (c.filmFormat && definition.type !== 'VIDEO') issues.push({ path: 'filmFormat', message: 'Only films have a size to choose' });
  if (c.sectionOrder?.length) {
    // The template's sections and the customer's own, once each (a redrawn section keeps its original's id).
    const known = new Set([...(definition.website?.pages[0]?.sections ?? []).map((s) => s.id), ...(c.addedSections ?? []).filter((a) => !a.replaces).map((a) => a.id)]);
    if (!e.layout) issues.push({ path: 'sectionOrder', message: 'This template does not allow reordering sections' });
    if (new Set(c.sectionOrder).size !== c.sectionOrder.length) issues.push({ path: 'sectionOrder', message: 'A section is listed twice' });
    for (const key of c.sectionOrder) if (!known.has(key)) issues.push({ path: 'sectionOrder', message: `Unknown section ${key}` });
  }
  if (c.hiddenSections?.length) {
    const sections = new Map((definition.website?.pages.flatMap((p) => p.sections) ?? []).map((s) => [s.id, s]));
    if (!e.layout) issues.push({ path: 'hiddenSections', message: 'This template does not allow hiding sections' });
    for (const id of c.hiddenSections) {
      const section = sections.get(id);
      if (!section) issues.push({ path: 'hiddenSections', message: `Unknown section ${id}` });
      else if (section.section === 'hero') issues.push({ path: 'hiddenSections', message: 'The opening section always shows' });
    }
  }
  if (c.photoSlots && Object.keys(c.photoSlots).length) {
    if (!e.photos) issues.push({ path: 'photoSlots', message: 'This template does not use customer photos' });
    const allowed = definition.capabilities.photoSlots;
    for (const slot of Object.keys(c.photoSlots)) {
      if (!allowed.includes(slot as PhotoSlot)) issues.push({ path: `photoSlots.${slot}`, message: 'This template has no such photo place' });
    }
  }
  if (c.musicId !== undefined && c.musicId !== null && !e.music) {
    issues.push({ path: 'musicId', message: 'This template does not allow music changes' });
  }
  if (c.custom && Object.keys(c.custom).length) {
    if (!e.text) issues.push({ path: 'custom', message: 'This template does not allow text changes' });
    const slots = new Map(definition.capabilities.textSlots.map((s) => [s.key, s]));
    for (const [key, value] of Object.entries(c.custom)) {
      const slot = slots.get(key);
      if (!slot) issues.push({ path: `custom.${key}`, message: 'Unknown text slot' });
      else if (value.length > slot.maxLength) issues.push({ path: `custom.${key}`, message: `At most ${slot.maxLength} characters` });
    }
  }
  if (c.photoIds?.length) {
    if (!e.photos) issues.push({ path: 'photoIds', message: 'This template does not use customer photos' });
    else if (c.photoIds.length > definition.capabilities.maxPhotos) {
      issues.push({ path: 'photoIds', message: `At most ${definition.capabilities.maxPhotos} photos` });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: c };
}

/** Theme colours after applying an allowed customization: a preset, then any custom colours on top. */
export function effectiveColors(definition: TemplateDefinition, customization: Customization | null | undefined): ThemeColors {
  const base = definition.theme.colors;
  if (!customization || !definition.capabilities.editable.colors) return base;
  const preset = definition.capabilities.colorPresets.find((p) => p.name === customization.colorPreset);
  return { ...(preset?.colors ?? base), ...(customization.colors ?? {}) };
}

/** Fonts after an allowed font-pairing choice. */
export function effectiveFonts(definition: TemplateDefinition, customization: Customization | null | undefined): Fonts {
  if (!customization?.fontPairing || !definition.capabilities.editable.fonts) return definition.fonts;
  return fontPairing(customization.fontPairing)?.fonts ?? definition.fonts;
}

/** Opening animation and ambient effect after allowed changes. */
export function effectiveMotion(definition: TemplateDefinition, customization: Customization | null | undefined): { intro: IntroName; effect: EffectName } {
  const intro = definition.website?.intro ?? 'none';
  const effect = definition.theme.effect ?? 'none';
  if (!customization || !definition.capabilities.editable.animation) return { intro, effect };
  return { intro: customization.intro ?? intro, effect: customization.effect ?? effect };
}

/** Sections the customer hid (never the hero), when layout is editable. */
export function hiddenSectionIds(definition: TemplateDefinition, customization: Customization | null | undefined): Set<string> {
  if (!customization?.hiddenSections?.length || !definition.capabilities.editable.layout) return new Set();
  return new Set(customization.hiddenSections);
}
