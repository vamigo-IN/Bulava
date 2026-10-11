'use client';

import { Clapperboard, Images, Palette, RotateCcw, Shapes, Type } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { backdropArt, CanvasArtboard, SceneStill, themeStyle } from '@bulava/template-engine';
import { effectiveColors, effectiveFonts, sceneBoard, stableStringify, type Artboard, type Customization, type Fonts, type RenderContext, type Scene, type TemplateDefinition, type ThemeColors } from '@bulava/template-schema';
import { ElementsPanel, TextPanel } from '@/components/cards/editor-panels';
import { IconButton, PanelSection } from '@/components/cards/editor-ui';
import { BoardStudio, type StudioApi, type StudioPanel, type StudioSide, type StudioTarget } from '@/components/editor/board-studio';
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
  const omit = useMemo(() => filmOmits(board), [board]);
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${board.width} / ${board.height}`, overflow: 'hidden', background: art?.background ?? sceneBackground(scene, colors) }}>
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

export interface FilmDesignerProps {
  eventId: string;
  definition: TemplateDefinition;
  templateName: string;
  context: RenderContext;
  custom: Customization;
  setCustom: (next: Customization) => void;
  photos: MediaItem[];
  onUploaded: (photo: MediaItem) => void;
  language: string;
  onClose: () => void;
}

/**
 * The film's canvas editor (ADR-059): each scene as a 9:16 board, edited like
 * a card, over the scene's illustrated backdrop. The host's boards are the
 * video page's customization (`scenes`), filmed in place of the scenes' own
 * when the video is made.
 */
export function FilmDesigner(props: FilmDesignerProps) {
  const { definition, custom, setCustom, context, photos, language, eventId } = props;
  const t = useT();
  const scenes = useMemo(() => definition.scenes ?? [], [definition]);
  const originals = useMemo(() => new Map(scenes.map((s) => [s.id, sceneBoard(s)])), [scenes]);
  const colors = useMemo(() => effectiveColors(definition, custom), [definition, custom]);
  const fonts = useMemo(() => effectiveFonts(definition, custom), [definition, custom]);
  const photoUrls = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p.viewUrl])), [photos]);
  const ctxBase = useMemo((): RenderContext => (custom.custom ? { ...context, custom: { ...context.custom, ...custom.custom } } : context), [context, custom.custom]);

  const targets: StudioTarget[] = useMemo(() => {
    const perFunction = ctxBase.functions[0] ? { ...ctxBase, function: ctxBase.functions[0], venue: ctxBase.functions[0].venue ?? ctxBase.venue } : ctxBase;
    return scenes.map((s, i): StudioTarget => {
      const name = SCENE_NAMES[s.id];
      return {
        id: s.id,
        label: name ? t(name) : t('film.scene.n', { n: i + 1 }),
        sides: ['mobile'],
        board: () => custom.scenes?.[s.id]?.board ?? originals.get(s.id)!,
        ctx: s.repeatPerFunction ? perFunction : ctxBase,
      };
    });
  }, [scenes, originals, custom.scenes, ctxBase, t]);

  const writeBoard = (c: Customization, sceneId: string, _side: StudioSide, board: Artboard): Customization => {
    const original = originals.get(sceneId);
    if (!original) return c;
    const next = { ...(c.scenes ?? {}) };
    if (stableStringify(board) === stableStringify(original)) delete next[sceneId];
    else next[sceneId] = { board };
    const out: Customization = { ...c, scenes: next };
    if (!Object.keys(next).length) delete out.scenes;
    return out;
  };

  const sceneOf = (id: string) => scenes.find((s) => s.id === id)!;
  const panelProps = (api: StudioApi | null) => ({ definition, custom, setCustom: (next: Customization) => (api ? api.commit(next) : setCustom(next)) });
  const panels: StudioPanel[] = [
    {
      key: 'scenes',
      label: t('film.canvas.scenes'),
      icon: <Clapperboard aria-hidden className="size-5" />,
      render: (api) => (
        <PanelSection title={t('film.canvas.scenesTitle')} hint={t('film.canvas.scenesHint')}>
          <ul className="grid grid-cols-2 gap-3">
            {targets.map((target) => {
              const scene = sceneOf(target.id);
              const active = target.id === api?.target.id;
              return (
                <li key={target.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => api?.selectTarget(target.id)}
                    className={cn('block w-full rounded-2xl p-1.5 text-left transition-colors', active ? 'bg-surface shadow-clay-sm ring-2 ring-brand-600' : 'hover:bg-white/60')}
                  >
                    <span className="pointer-events-none block overflow-hidden rounded-xl ring-1 ring-[var(--ed-line)]">
                      <FilmBoard board={target.board('mobile')} scene={scene} definition={definition} colors={colors} fonts={fonts} ctx={target.ctx} language={language} width={136} height={242} />
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-1 px-0.5 text-xs font-semibold text-stone-700">
                      <span className="truncate">{target.label}</span>
                      {custom.scenes?.[target.id] ? <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.625rem] text-brand-700">{t('design.canvas.edited')}</span> : null}
                    </span>
                    {scene.repeatPerFunction ? <span className="block px-0.5 text-[0.6875rem] text-stone-500">{t('design.canvas.perFunction')}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </PanelSection>
      ),
    },
    { key: 'text', label: t('cards.panel.text'), icon: <Type aria-hidden className="size-5" />, render: (api) => (api ? <TextPanel editor={api.editor} /> : null) },
    { key: 'style', label: t('design.canvas.panel.style'), icon: <Palette aria-hidden className="size-5" />, render: (api) => <StylePanel {...panelProps(api)} /> },
    { key: 'photos', label: t('cards.panel.photos'), icon: <Images aria-hidden className="size-5" />, render: (api) => <PhotosPanel {...panelProps(api)} eventId={eventId} photos={photos} onUploaded={props.onUploaded} /> },
    { key: 'elements', label: t('cards.panel.elements'), icon: <Shapes aria-hidden className="size-5" />, render: (api) => (api ? <ElementsPanel editor={api.editor} /> : null) },
  ];

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
        <div className="overflow-hidden bg-black" style={{ width: 'min(86vw, 340px)', aspectRatio: '9 / 16' }}>
          <Preview definition={definition} context={context} customization={custom} />
        </div>
      )}
      framed={() => true}
      photoUrls={photoUrls}
      uploadPhoto={async (file) => {
        const photo = await uploadDesignPhoto(eventId, file);
        props.onUploaded(photo);
        return photo.id;
      }}
      actions={(api) =>
        api ? (
          <IconButton
            label={t('film.canvas.reset')}
            tone="plain"
            disabled={!custom.scenes?.[api.target.id]}
            onClick={() => {
              if (!window.confirm(t('film.canvas.resetConfirm'))) return;
              const next = { ...(custom.scenes ?? {}) };
              delete next[api.target.id];
              const out: Customization = { ...custom, scenes: next };
              if (!Object.keys(next).length) delete out.scenes;
              api.commit(out);
            }}
          >
            <RotateCcw aria-hidden className="size-5" />
          </IconButton>
        ) : null
      }
      primary={{ label: t('film.canvas.done'), onClick: props.onClose }}
      onClose={props.onClose}
    />
  );
}
