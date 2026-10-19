import { FILM_BOARD, sceneBoard, type Artboard, type CanvasSection, type Scene, type TemplateDefinition } from '@bulava/template-schema';
import { emptyCanvas } from './presets';

/**
 * Every board a template is drawn on, as the Design Studio's pages: a website's
 * canvas sections (phone, and desktop when it has one) and a film's or a
 * card's scenes. A scene drawn with elements (not on a board) is a page too,
 * shown as its elements laid out on a board until it is moved onto the canvas
 * (`toCanvasScene`).
 */

export type Side = 'mobile' | 'desktop';

export interface DesignPage {
  /** `section:<id>` or `scene:<id>`. */
  id: string;
  kind: 'section' | 'scene';
  /** The section's or the scene's own id. */
  refId: string;
  /** Its position among its kind (for labels and reordering). */
  index: number;
  sides: Side[];
  /** A scene drawn with elements: shown, but drawn on the canvas only once moved there. */
  onCanvas: boolean;
}

/**
 * The board a scene is drawn on: 450 wide (the film board), in the shape of
 * the template's frame (9:16 for films, 4:5 for image cards), so the board
 * fills the frame it is played in.
 */
export function sceneSize(def: Pick<TemplateDefinition, 'canvas'>): { width: number; height: number } {
  const frame = def.canvas ?? { width: 1080, height: 1920 };
  return { width: FILM_BOARD.width, height: Math.round((FILM_BOARD.width * frame.height) / frame.width) };
}

export const pageId = (kind: DesignPage['kind'], refId: string) => `${kind}:${refId}`;

/** Where a section is in the website's pages. */
export function locateSection(def: TemplateDefinition, sectionId: string): { pi: number; si: number } | null {
  for (const [pi, page] of (def.website?.pages ?? []).entries()) {
    const si = page.sections.findIndex((s) => s.id === sectionId);
    if (si !== -1) return { pi, si };
  }
  return null;
}

export function designPages(def: TemplateDefinition): DesignPage[] {
  const pages: DesignPage[] = [];
  let n = 0;
  for (const page of def.website?.pages ?? []) {
    for (const section of page.sections) {
      if (section.section !== 'canvas' || !section.canvas) continue;
      pages.push({ id: pageId('section', section.id), kind: 'section', refId: section.id, index: n++, sides: section.canvas.desktop ? ['mobile', 'desktop'] : ['mobile'], onCanvas: true });
    }
  }
  (def.scenes ?? []).forEach((scene, i) => {
    pages.push({ id: pageId('scene', scene.id), kind: 'scene', refId: scene.id, index: i, sides: ['mobile'], onCanvas: !!scene.canvas });
  });
  return pages;
}

export function sectionOf(def: TemplateDefinition, page: DesignPage): CanvasSection | null {
  if (page.kind !== 'section') return null;
  const at = locateSection(def, page.refId);
  return at ? (def.website!.pages[at.pi]!.sections[at.si]!.canvas ?? null) : null;
}

export function sceneOf(def: TemplateDefinition, page: DesignPage): Scene | null {
  return page.kind === 'scene' ? ((def.scenes ?? []).find((s) => s.id === page.refId) ?? null) : null;
}

/** The board a page shows on a side (a section without a desktop board shows its phone board). */
export function pageBoard(def: TemplateDefinition, page: DesignPage, side: Side): Artboard | null {
  if (page.kind === 'section') {
    const canvas = sectionOf(def, page);
    if (!canvas) return null;
    return side === 'desktop' && canvas.desktop ? canvas.desktop : canvas.mobile;
  }
  const scene = sceneOf(def, page);
  if (!scene) return null;
  // Elements are placed in film pixels from the top left, so a card's board is the film board cut to its frame.
  return scene.canvas ? scene.canvas.board : { ...sceneBoard(scene), ...sceneSize(def) };
}

/** Writes a page's board into a draft (the Studio's `edit` validates the whole definition after). */
export function writeBoard(draft: TemplateDefinition, page: DesignPage, side: Side, board: Artboard): void {
  if (page.kind === 'section') {
    const at = locateSection(draft, page.refId);
    const section = at ? draft.website!.pages[at.pi]!.sections[at.si]! : null;
    if (!section?.canvas) return;
    if (side === 'desktop' && section.canvas.desktop) section.canvas.desktop = board;
    else section.canvas.mobile = board;
    return;
  }
  const scene = (draft.scenes ?? []).find((s) => s.id === page.refId);
  if (!scene) return;
  if (scene.canvas) scene.canvas.board = board;
  else Object.assign(scene, toCanvasScene(scene, board));
}

/** A scene moved onto the canvas: its elements (`pageBoard`) become the board's layers (over its backdrop, if it has one). */
export function toCanvasScene(scene: Scene, board: Artboard): Scene {
  return { ...scene, canvas: { board, stagger: 0.14, camera: scene.backdrop?.camera ?? 'push', intensity: 0.6 }, elements: [] };
}

function freeId(base: string, taken: Set<string>): string {
  let i = 1;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/** A new, empty page after `after` (or at the end): a canvas section on websites, a canvas scene on films and cards. */
export function addPage(draft: TemplateDefinition, after: DesignPage | null): string {
  if (draft.type === 'WEBSITE') {
    const site = draft.website!;
    const at = after?.kind === 'section' ? locateSection(draft, after.refId) : null;
    const pi = at?.pi ?? 0;
    const sections = site.pages[pi]!.sections;
    const id = freeId('canvas', new Set(site.pages.flatMap((p) => p.sections.map((s) => s.id))));
    // Before the RSVP and the footer when appended, so they stay last.
    const tail = sections.findIndex((s) => s.section === 'rsvp' || s.section === 'footer');
    const index = at ? at.si + 1 : tail === -1 ? sections.length : tail;
    sections.splice(index, 0, { id, section: 'canvas', canvas: emptyCanvas() } as never);
    return pageId('section', id);
  }
  const scenes = (draft.scenes ??= []);
  const id = freeId('scene', new Set(scenes.map((s) => s.id)));
  const board = { ...sceneSize(draft), background: { type: 'color', color: 'background' }, effect: 'none', texture: 'none', textureStrength: 0.6, layers: [] };
  const scene = { id, durationSec: 5, background: 'background', transition: 'fade', repeatPerFunction: false, particles: 'none', reveal: 'none', canvas: { board, stagger: 0.14, camera: 'push', intensity: 0.6 }, elements: [] } as unknown as Scene;
  const index = after?.kind === 'scene' ? scenes.findIndex((s) => s.id === after.refId) + 1 : scenes.length;
  scenes.splice(index, 0, scene);
  return pageId('scene', id);
}

/** A new page after `after` holding `board` (an imported design): a website's phone board, or a scene's board. */
export function addBoardPage(draft: TemplateDefinition, after: DesignPage | null, board: Artboard): DesignPage {
  const id = addPage(draft, after);
  const page = designPages(draft).find((p) => p.id === id)!;
  writeBoard(draft, page, 'mobile', board);
  return page;
}

/** A copy of a page, right after it. */
export function duplicatePage(draft: TemplateDefinition, page: DesignPage): string | null {
  if (page.kind === 'section') {
    const at = locateSection(draft, page.refId);
    if (!at) return null;
    const sections = draft.website!.pages[at.pi]!.sections;
    const id = freeId(page.refId.replace(/-\d+$/, ''), new Set(draft.website!.pages.flatMap((p) => p.sections.map((s) => s.id))));
    sections.splice(at.si + 1, 0, { ...structuredClone(sections[at.si]!), id });
    return pageId('section', id);
  }
  const scenes = draft.scenes ?? [];
  const i = scenes.findIndex((s) => s.id === page.refId);
  if (i === -1) return null;
  const id = freeId(page.refId.replace(/-\d+$/, ''), new Set(scenes.map((s) => s.id)));
  scenes.splice(i + 1, 0, { ...structuredClone(scenes[i]!), id });
  return pageId('scene', id);
}

/** Removes a page; refused for the last scene of a film and the last section of a website. */
export function removePage(draft: TemplateDefinition, page: DesignPage): boolean {
  if (page.kind === 'section') {
    const at = locateSection(draft, page.refId);
    if (!at) return false;
    const sections = draft.website!.pages[at.pi]!.sections;
    if (sections.length <= 1) return false;
    sections.splice(at.si, 1);
    return true;
  }
  const scenes = draft.scenes ?? [];
  if (scenes.length <= 1) return false;
  const i = scenes.findIndex((s) => s.id === page.refId);
  if (i === -1) return false;
  scenes.splice(i, 1);
  return true;
}

/** Moves a page one place earlier or later among its kind. */
export function movePage(draft: TemplateDefinition, page: DesignPage, by: -1 | 1): void {
  if (page.kind === 'section') {
    const at = locateSection(draft, page.refId);
    if (!at) return;
    const sections = draft.website!.pages[at.pi]!.sections;
    // Among the canvas sections only: the page order the strip shows.
    const canvasAt = sections.map((s, i) => (s.section === 'canvas' ? i : -1)).filter((i) => i !== -1);
    const k = canvasAt.indexOf(at.si);
    const to = canvasAt[k + by];
    if (to === undefined) return;
    const [item] = sections.splice(at.si, 1);
    sections.splice(to, 0, item!);
    return;
  }
  const scenes = draft.scenes ?? [];
  const i = scenes.findIndex((s) => s.id === page.refId);
  const j = i + by;
  if (i === -1 || j < 0 || j >= scenes.length) return;
  const [item] = scenes.splice(i, 1);
  scenes.splice(j, 0, item!);
}
