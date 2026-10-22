'use client';

import { Clapperboard, CopyPlus, Images, Palette, RectangleHorizontal, RectangleVertical, RotateCcw, Ruler, Shapes, Square, Trash2, Type } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { backdropArt, CanvasArtboard, SceneStill, StageStill, themeStyle } from '@bulava/template-engine';
import {
  ADDED_SCENE_SECONDS,
  ADDED_SCENES_MAX,
  addedSceneOf,
  ArtboardSchema,
  DARK_SCENE_NAMES,
  effectiveColors,
  effectiveFonts,
  FILM_BOARD,
  FILM_FORMAT_SIZE,
  FILM_FORMATS,
  FILM_MAX_SECONDS,
  sceneBoard,
  STAGE_META,
  stableStringify,
  videoDurationSec,
  withFilmCustomization,
  type AddedScene,
  type Artboard,
  type ArtboardInput,
  type Customization,
  type FilmFormat,
  type Fonts,
  type RenderContext,
  type Scene,
  type TemplateDefinition,
  type ThemeColors,
} from '@bulava/template-schema';
import { ElementsPanel, TextPanel } from '@/components/cards/editor-panels';
import { IconButton, PanelSection } from '@/components/cards/editor-ui';
import { BoardStudio, type StudioControls, type StudioPanel, type StudioSide, type StudioTarget } from '@/components/editor/board-studio';
import { useT } from '@/lib/i18n';
import type { MediaItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PhotosPanel, StylePanel } from './design-panels';
import { uploadDesignPhoto } from './upload-design-photo';

const Preview = dynamic(() => import('@/components/events/video-preview').then((m) => m.VideoPreview), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

/** What hosts call a film's scenes (the catalog's scene ids). */
const SCENE_NAMES: Record<string, MessageKey> = {
  intro: 'film.scene.opening',
  opening: 'film.scene.opening',
  names: 'film.scene.names',
  couple: 'film.scene.photo',
  photo: 'film.scene.photo',
  portrait: 'film.scene.photo',
  function: 'film.scene.function',
  closing: 'film.scene.closing',
  outro: 'film.scene.closing',
  card: 'film.scene.card',
};

/** The website's buttons and live countdown are not filmed; the editor leaves them out too. */
const filmOmits = (board: Artboard) => new Set(board.layers.flatMap((l) => (l.kind === 'widget' && l.widget.type !== 'details' ? [l.id] : [])));

const sceneBackground = (scene: Scene, colors: ThemeColors): string =>
  scene.background === 'gradient' ? `linear-gradient(160deg, ${colors.primary}, ${colors.secondary})` : scene.background.startsWith('#') ? scene.background : (colors[scene.background as keyof ThemeColors] ?? colors.background);

/** A scene's board as the film draws it: over its illustrated backdrop (or its background), the board's layers still. */
function FilmBoard({ board, scene, definition, colors, fonts, ctx, language, width, height }: { board: Artboard; scene: Scene; definition: TemplateDefinition; colors: ThemeColors; fonts: Fonts; ctx: RenderContext; language: string; width: number; height: number }) {
  const t = useMemo(() => createTranslator(language), [language]);
  const art = useMemo(() => (scene.backdrop ? backdropArt(definition, scene.backdrop, colors, { width: 1200 }) : null), [scene.backdrop, definition, colors]);
  // A Signature 3D stage (ADR-078): the set at its rest pose, as the film starts it before the camera moves, under the
  // scene's own veil as the film draws it.
  const stage = scene.backdrop?.stage;
  const veil = scene.backdrop?.veil ?? 0;
  const still = useMemo(() => (stage ? <StageStill name={stage} colors={colors} width={width} height={height} veil={veil} /> : null), [stage, colors, width, height, veil]);
  const omit = useMemo(() => filmOmits(board), [board]);
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${board.width} / ${board.height}`, overflow: 'hidden', background: art?.background ?? sceneBackground(scene, colors) }}>
      {still ? <div style={{ position: 'absolute', inset: 0 }}>{still}</div> : null}
      {art ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <SceneStill art={art} width={width} height={height} />
        </div>
      ) : null}
      <div className="bulava-template" lang={language} style={{ ...themeStyle(definition.theme, colors, fonts), position: 'absolute', inset: 0, backgroundColor: 'transparent' }}>
        <CanvasArtboard board={board} ctx={ctx} colors={colors} fonts={fonts} t={t} language={language} timeZone={ctx.event.timezone} mode="edit" omit={omit} />
      </div>
    </div>
  );
}

type Starter = 'words' | 'photo' | 'date' | 'blank';
const STARTERS: Starter[] = ['words', 'photo', 'date', 'blank'];

/** Does the scene's look need light words (a dark backdrop or background)? */
function darkLook(scene: Scene | undefined, definition: TemplateDefinition): boolean {
  if (!scene) return false;
  if (scene.backdrop?.stage) return STAGE_META[scene.backdrop.stage].dark;
  if (scene.backdrop?.scene) return DARK_SCENE_NAMES.includes(scene.backdrop.scene);
  if (scene.backdrop?.artwork) return Boolean(definition.artworks?.[scene.backdrop.artwork]?.dark);
  return scene.background === 'primary' || scene.background === 'gradient';
}

/** A new scene's first design: 9:16, over the backdrop of the scene before it (or on the film's colours), its words coming in one after another. */
function starterScene(kind: Starter, follows: Scene | undefined, definition: TemplateDefinition, t: ReturnType<typeof useT>): Artboard {
  const W = FILM_BOARD.width;
  const dark = darkLook(follows, definition);
  const main = dark ? 'accent' : 'primary';
  const ink = dark ? 'background' : 'text';
  const enter = (delaySec: number, entrance = 'fadeUp') => ({ animation: { entrance, delaySec, durationSec: 0.9 } });
  const text = (id: string, y: number, h: number, content: unknown, style: Record<string, unknown>, delay: number, overflow = 'shrink') => ({ id, kind: 'text', frame: { x: 36, y, w: W - 72, h }, content, style: { align: 'center', shadow: follows?.backdrop ? 'soft' : 'none', ...style }, overflow, ...enter(delay) });
  const background = follows?.backdrop ? { type: 'none' } : follows?.background === 'gradient' ? { type: 'gradient', gradient: { kind: 'linear', from: 'primary', to: 'secondary', angle: 160 } } : { type: 'color', color: follows?.background ?? 'background' };
  const boards: Record<Starter, unknown> = {
    words: {
      width: W,
      height: FILM_BOARD.height,
      background,
      layers: [
        { id: 'flourish', kind: 'ornament', ornament: 'flourish', color: dark ? 'accent' : 'secondary', frame: { x: 155, y: 214, w: 140, h: 36 }, ...enter(0.1, 'fade') },
        text('heading', 262, 76, { literal: t('design.canvas.starter.heading') }, { font: 'script', size: 46, color: main }, 0.35),
        text('words', 352, 190, { literal: t('cards.text.sample.body') }, { font: 'body', size: 18, color: ink, lineHeight: 1.6 }, 0.8, 'wrap'),
      ],
    },
    photo: {
      width: W,
      height: FILM_BOARD.height,
      background,
      layers: [
        { id: 'photo', kind: 'image', source: { type: 'binding', binding: 'photos[0]' }, frame: { x: 95, y: 150, w: 260, h: 380 }, fit: 'cover', mask: 'arch', border: { width: 4, color: dark ? 'accent' : 'secondary' }, alt: '', ...enter(0.15, 'zoomIn') },
        text('caption', 560, 70, { literal: t('design.canvas.starter.caption') }, { font: 'script', size: 38, color: main }, 0.7),
      ],
    },
    date: {
      width: W,
      height: FILM_BOARD.height,
      background,
      layers: [
        text('eyebrow', 210, 26, { t: 'template.saveTheDate' }, { font: 'body', size: 13, weight: 600, color: dark ? 'accent' : 'muted', letterSpacing: 0.26, transform: 'upper' }, 0.1),
        text('names', 248, 170, { template: '{{couple.partnerOne}}\n&\n{{couple.partnerTwo}}', fallback: { binding: 'honoree.name', fallback: { binding: 'event.title' } } }, { font: 'script', size: 50, color: main, lineHeight: 1.04 }, 0.4),
        text('date', 440, 34, { binding: 'event.startDate', format: 'dateWithWeekday' }, { font: 'heading', size: 20, weight: 600, color: ink, letterSpacing: 0.06, transform: 'upper' }, 0.9),
        text('venue', 484, 30, { binding: 'venue.name' }, { font: 'body', size: 17, color: ink }, 1.2),
      ],
    },
    blank: { width: W, height: FILM_BOARD.height, background, layers: [] },
  };
  return ArtboardSchema.parse(boards[kind] as ArtboardInput);
}

const newSceneId = () => `my-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** The film's scenes in the order they play: its own (redrawn or not) and the host's, each after the scene it names. */
type Part = { kind: 'film'; scene: Scene; n: number } | { kind: 'mine'; added: AddedScene; follows: Scene | undefined; n: number };

function partsOf(scenes: Scene[], added: AddedScene[]): Part[] {
  const ids = new Set(scenes.map((s) => s.id));
  const out: Part[] = [];
  let mine = 0;
  scenes.forEach((scene, i) => {
    out.push({ kind: 'film', scene, n: i + 1 });
    for (const a of added) if (a.after === scene.id) out.push({ kind: 'mine', added: a, follows: scene, n: ++mine });
  });
  const last = scenes[scenes.length - 1];
  for (const a of added) if (!a.after || !ids.has(a.after)) out.push({ kind: 'mine', added: a, follows: last, n: ++mine });
  return out;
}

const FORMAT_ICONS: Record<FilmFormat, typeof Square> = { story: RectangleVertical, square: Square, wide: RectangleHorizontal };

export interface FilmDesignerProps {
  /** None on the design page before signing in (ADR-063): photos come with an event. */
  eventId?: string;
  definition: TemplateDefinition;
  templateName: string;
  context: RenderContext;
  custom: Customization;
  setCustom: (next: Customization) => void;
  photos: MediaItem[];
  onUploaded: (photo: MediaItem) => void;
  language: string;
  onClose: () => void;
  /** The main button, when it is not Done (the design page: make the video). */
  primary?: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean };
}

/**
 * The film's canvas editor (ADR-059, ADR-061): each scene as a 9:16 board,
 * edited like a card, over the scene's illustrated backdrop; scenes of the
 * host's own after any scene; and the video's size. What the host changes is
 * the video page's customization (`scenes`, `addedScenes`, `filmFormat`),
 * filmed when the video is made.
 */
export function FilmDesigner(props: FilmDesignerProps) {
  const { definition, custom, setCustom, context, photos, language, eventId } = props;
  const t = useT();
  const scenes = useMemo(() => definition.scenes ?? [], [definition]);
  const added = useMemo(() => custom.addedScenes ?? [], [custom.addedScenes]);
  const originals = useMemo(() => new Map(scenes.map((s) => [s.id, sceneBoard(s)])), [scenes]);
  const parts = useMemo(() => partsOf(scenes, added), [scenes, added]);
  const colors = useMemo(() => effectiveColors(definition, custom), [definition, custom]);
  const fonts = useMemo(() => effectiveFonts(definition, custom), [definition, custom]);
  const photoUrls = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p.viewUrl])), [photos]);
  const ctxBase = useMemo((): RenderContext => (custom.custom ? { ...context, custom: { ...context.custom, ...custom.custom } } : context), [context, custom.custom]);
  const format: FilmFormat = custom.filmFormat ?? 'story';
  const seconds = useMemo(() => videoDurationSec(withFilmCustomization(definition, custom), Math.max(1, context.functions.length)), [definition, custom, context.functions.length]);
  const sceneName = (scene: Scene, n: number) => {
    const key = SCENE_NAMES[scene.id];
    return key ? t(key) : t('film.scene.n', { n });
  };

  const targets: StudioTarget[] = useMemo(() => {
    const perFunction = ctxBase.functions[0] ? { ...ctxBase, function: ctxBase.functions[0], venue: ctxBase.functions[0].venue ?? ctxBase.venue } : ctxBase;
    return parts.map((part): StudioTarget =>
      part.kind === 'film'
        ? {
            id: part.scene.id,
            label: sceneName(part.scene, part.n),
            sides: ['mobile'],
            board: () => custom.scenes?.[part.scene.id]?.board ?? originals.get(part.scene.id)!,
            ctx: part.scene.repeatPerFunction ? perFunction : ctxBase,
          }
        : { id: part.added.id, label: t('film.canvas.yourSceneN', { n: part.n }), sides: ['mobile'], board: () => part.added.board, ctx: part.added.perFunction ? perFunction : ctxBase },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, originals, custom.scenes, ctxBase, t]);

  /** The scene a part is drawn as (an added one over the look of the scene before it). */
  const sceneOf = (id: string): Scene => {
    const part = parts.find((p) => (p.kind === 'film' ? p.scene.id : p.added.id) === id);
    return !part ? scenes[0]! : part.kind === 'film' ? part.scene : addedSceneOf(part.added, part.follows);
  };

  const writeBoard = (c: Customization, sceneId: string, _side: StudioSide, board: Artboard): Customization => {
    const mineIndex = (c.addedScenes ?? []).findIndex((a) => a.id === sceneId);
    if (mineIndex !== -1) {
      const next = [...(c.addedScenes ?? [])];
      next[mineIndex] = { ...next[mineIndex]!, board };
      return { ...c, addedScenes: next };
    }
    const original = originals.get(sceneId);
    if (!original) return c;
    const next = { ...(c.scenes ?? {}) };
    if (stableStringify(board) === stableStringify(original)) delete next[sceneId];
    else next[sceneId] = { board };
    const out: Customization = { ...c, scenes: next };
    if (!Object.keys(next).length) delete out.scenes;
    return out;
  };

  const setAdded = (controls: StudioControls, next: AddedScene[]) => {
    const out: Customization = { ...controls.custom, addedScenes: next };
    if (!next.length) delete out.addedScenes;
    controls.commit(out);
  };
  const addScene = (kind: Starter, controls: StudioControls) => {
    const list = controls.custom.addedScenes ?? [];
    if (list.length >= ADDED_SCENES_MAX) return;
    const current = controls.target?.id ?? null;
    // Right after the scene on screen: one of the film's, or one of the host's (the same place, next in line).
    const at = list.findIndex((a) => a.id === current);
    const after = current && scenes.some((s) => s.id === current) ? current : at !== -1 ? list[at]!.after : '';
    const follows = scenes.find((s) => s.id === after) ?? scenes[scenes.length - 1];
    const scene: AddedScene = { id: newSceneId(), after, board: starterScene(kind, follows, definition, t), durationSec: ADDED_SCENE_SECONDS.default };
    setAdded(controls, at === -1 ? [...list, scene] : [...list.slice(0, at + 1), scene, ...list.slice(at + 1)]);
    requestAnimationFrame(() => controls.selectTarget(scene.id));
  };
  const setFormat = (controls: StudioControls, next: FilmFormat) => {
    const out: Customization = { ...controls.custom, filmFormat: next };
    if (next === 'story') delete out.filmFormat;
    controls.commit(out);
  };

  const panelProps = (controls: StudioControls) => ({ definition, custom, setCustom: (next: Customization) => controls.commit(next) });
  const full = added.length >= ADDED_SCENES_MAX;
  const panels: StudioPanel[] = [
    {
      key: 'scenes',
      label: t('film.canvas.scenes'),
      icon: <Clapperboard aria-hidden className="size-5" />,
      render: (_api, controls) => (
        <div className="space-y-6">
          <PanelSection title={t('film.canvas.scenesTitle')} hint={t('film.canvas.scenesHint')}>
            <ul className="grid grid-cols-2 gap-3">
              {parts.map((part, i) => {
                const target = targets[i]!;
                const scene = part.kind === 'film' ? part.scene : addedSceneOf(part.added, part.follows);
                const active = target.id === controls.target?.id;
                const mine = part.kind === 'mine' ? part.added : null;
                return (
                  <li key={target.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => controls.selectTarget(target.id)}
                      className={cn('block w-full rounded-2xl p-1.5 text-left transition-colors', active ? 'bg-surface shadow-clay-sm ring-2 ring-brand-600' : 'hover:bg-white/60')}
                    >
                      <span className="pointer-events-none block overflow-hidden rounded-xl ring-1 ring-[var(--ed-line)]">
                        <FilmBoard board={target.board!('mobile')} scene={scene} definition={definition} colors={colors} fonts={fonts} ctx={target.ctx} language={language} width={136} height={242} />
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-1 px-0.5 text-xs font-semibold text-stone-700">
                        <span className="truncate">{target.label}</span>
                        {mine ? (
                          <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.625rem] text-brand-700">{t('film.canvas.badge.yours')}</span>
                        ) : custom.scenes?.[target.id] ? (
                          <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.625rem] text-brand-700">{t('design.canvas.edited')}</span>
                        ) : null}
                      </span>
                      {scene.repeatPerFunction ? <span className="block px-0.5 text-[0.6875rem] text-stone-500">{t('design.canvas.perFunction')}</span> : null}
                    </button>
                    {mine ? (
                      <div className="mt-1 space-y-1 px-0.5">
                        <label className="block text-[0.625rem] font-semibold text-stone-500" htmlFor={`after-${mine.id}`}>
                          {t('film.canvas.playsAfter')}
                        </label>
                        <select
                          id={`after-${mine.id}`}
                          value={mine.after}
                          onChange={(e) => setAdded(controls, added.map((a) => (a.id === mine.id ? { ...a, after: e.target.value } : a)))}
                          className="min-h-8 w-full rounded-lg border border-[var(--ed-field-line)] bg-[var(--ed-field)] px-1 text-[0.6875rem] text-stone-800"
                        >
                          {scenes.map((s, n) => (
                            <option key={s.id} value={s.id}>
                              {t('film.canvas.after', { scene: sceneName(s, n + 1) })}
                            </option>
                          ))}
                          <option value="">{t('film.canvas.atTheEnd')}</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <label className="sr-only" htmlFor={`length-${mine.id}`}>
                            {t('film.canvas.length')}
                          </label>
                          <select
                            id={`length-${mine.id}`}
                            value={mine.durationSec}
                            onChange={(e) => setAdded(controls, added.map((a) => (a.id === mine.id ? { ...a, durationSec: Number(e.target.value) } : a)))}
                            className="min-h-8 min-w-0 flex-1 rounded-lg border border-[var(--ed-field-line)] bg-[var(--ed-field)] px-1 text-[0.6875rem] text-stone-800"
                            title={t('film.canvas.length')}
                          >
                            {Array.from({ length: ADDED_SCENE_SECONDS.max - ADDED_SCENE_SECONDS.min + 1 }, (_, k) => ADDED_SCENE_SECONDS.min + k).map((n) => (
                              <option key={n} value={n}>
                                {t('film.canvas.seconds', { n })}
                              </option>
                            ))}
                          </select>
                          <IconButton
                            label={t('film.canvas.removeScene')}
                            tone="plain"
                            className="size-8 !text-red-700"
                            onClick={() => {
                              if (window.confirm(t('film.canvas.removeConfirm'))) setAdded(controls, added.filter((a) => a.id !== mine.id));
                            }}
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </IconButton>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </PanelSection>
          <PanelSection title={t('film.canvas.addScene')} hint={full ? t('film.canvas.addSceneFull', { max: ADDED_SCENES_MAX }) : t('film.canvas.addSceneHint')}>
            <div className="grid grid-cols-2 gap-2">
              {STARTERS.map((kind) => (
                <button key={kind} type="button" disabled={full} onClick={() => addScene(kind, controls)} className="btn-3d btn-3d-light min-h-12 justify-center gap-1.5 rounded-xl px-2 text-xs disabled:opacity-50">
                  <CopyPlus aria-hidden className="size-4" />
                  {t(`design.canvas.starter.${kind}`)}
                </button>
              ))}
            </div>
          </PanelSection>
          <p className={cn('text-xs leading-relaxed', seconds > FILM_MAX_SECONDS ? 'font-semibold text-red-700' : 'text-stone-500')} role="status">
            {seconds > FILM_MAX_SECONDS ? t('film.canvas.tooLong', { max: FILM_MAX_SECONDS }) : t('film.canvas.total', { seconds: Math.round(seconds) })}
          </p>
        </div>
      ),
    },
    { key: 'text', label: t('cards.panel.text'), icon: <Type aria-hidden className="size-5" />, render: (api) => (api ? <TextPanel editor={api.editor} /> : null) },
    { key: 'style', label: t('design.canvas.panel.style'), icon: <Palette aria-hidden className="size-5" />, render: (_api, controls) => <StylePanel {...panelProps(controls)} /> },
    { key: 'photos', label: t('cards.panel.photos'), icon: <Images aria-hidden className="size-5" />, render: (_api, controls) => <PhotosPanel {...panelProps(controls)} eventId={eventId} photos={photos} onUploaded={props.onUploaded} /> },
    { key: 'elements', label: t('cards.panel.elements'), icon: <Shapes aria-hidden className="size-5" />, render: (api) => (api ? <ElementsPanel editor={api.editor} /> : null) },
    {
      key: 'size',
      label: t('film.canvas.panel.size'),
      icon: <Ruler aria-hidden className="size-5" />,
      render: (_api, controls) => (
        <PanelSection title={t('film.canvas.size.title')} hint={t('film.canvas.size.hint')}>
          <div className="space-y-2" role="radiogroup" aria-label={t('film.canvas.size.title')}>
            {FILM_FORMATS.map((f) => {
              const Icon = FORMAT_ICONS[f];
              const size = FILM_FORMAT_SIZE[f];
              const chosen = format === f;
              return (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => setFormat(controls, f)}
                  className={cn('flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors', chosen ? 'bg-surface shadow-clay-sm ring-2 ring-brand-600' : 'clay-inset hover:bg-white/60')}
                >
                  <Icon aria-hidden className={cn('size-7 shrink-0', chosen ? 'text-brand-700' : 'text-stone-500')} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{t(`film.canvas.size.${f}`)}</span>
                    <span className="block text-xs text-stone-600">{t(`film.canvas.size.${f}Hint`)}</span>
                    <span className="block text-[0.6875rem] text-stone-500">{t('film.canvas.size.pixels', { width: size.width, height: size.height })}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </PanelSection>
      ),
    },
  ];

  const previewSize = FILM_FORMAT_SIZE[format];
  return (
    <BoardStudio
      kind="film"
      title={props.templateName}
      labels={{ dialog: t('film.canvas.title'), canvas: t('film.canvas.canvas'), hint: t('film.canvas.hint'), close: t('film.canvas.close'), empty: t('film.canvas.empty') }}
      targets={targets}
      custom={custom}
      setCustom={setCustom}
      writeBoard={writeBoard}
      colors={colors}
      fonts={fonts}
      language={language}
      renderBoard={(board, target, size) => <FilmBoard board={board} scene={sceneOf(target.id)} definition={definition} colors={colors} fonts={fonts} ctx={target.ctx} language={language} width={size.width} height={size.height} />}
      panels={panels}
      renderPreview={() => (
        // The whole film at the size chosen: a wide one is as wide as the stage allows.
        <div className="overflow-hidden bg-black" style={{ width: format === 'wide' ? 'min(86vw, 720px)' : format === 'square' ? 'min(86vw, 480px)' : 'min(86vw, 340px)', aspectRatio: `${previewSize.width} / ${previewSize.height}` }}>
          <Preview definition={definition} context={context} customization={custom} />
        </div>
      )}
      framed={() => format === 'story'}
      photoUrls={photoUrls}
      uploadPhoto={
        eventId
          ? async (file) => {
              const photo = await uploadDesignPhoto(eventId, file);
              props.onUploaded(photo);
              return photo.id;
            }
          : undefined
      }
      actions={(api, controls) => {
        const id = controls.target?.id;
        if (!api || !id || !originals.has(id)) return null;
        return (
          <IconButton
            label={t('film.canvas.reset')}
            tone="plain"
            disabled={!custom.scenes?.[id]}
            onClick={() => {
              if (!window.confirm(t('film.canvas.resetConfirm'))) return;
              const next = { ...(custom.scenes ?? {}) };
              delete next[id];
              const out: Customization = { ...custom, scenes: next };
              if (!Object.keys(next).length) delete out.scenes;
              controls.commit(out);
            }}
          >
            <RotateCcw aria-hidden className="size-5" />
          </IconButton>
        );
      }}
      primary={props.primary ?? { label: t('film.canvas.done'), onClick: props.onClose }}
      onClose={props.onClose}
    />
  );
}
