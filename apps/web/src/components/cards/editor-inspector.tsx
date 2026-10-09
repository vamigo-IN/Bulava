'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Italic,
  Lock,
  LockOpen,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef } from 'react';
import { layerLabel } from '@bulava/template-engine';
import { FONT_FAMILIES, IMAGE_MASKS, type CardDesign, type ImageLayer, type Layer, type OrnamentLayer, type ShapeLayer, type TextLayer } from '@bulava/template-schema';
import { cn } from '@/lib/utils';
import { duplicate, restack } from './editor-model';
import { textOf } from './editor-panels';
import { ColorField, IconButton, PanelSection, Segmented, Slider, TextField } from './editor-ui';
import type { CardEditorApi } from './editor-types';

/** The selected element's settings: everything here changes the downloaded card too. */
export function LayerInspector({ editor, onClose }: { editor: CardEditorApi; onClose?: () => void }) {
  const { design, t } = editor;
  const layer = design.board.layers.find((l) => l.id === editor.selectedId);
  if (!layer) {
    return (
      <div className="space-y-3 text-sm text-stone-600">
        <p className="font-semibold text-ink">{t('cards.inspector.nothing')}</p>
        <p className="leading-relaxed">{t('cards.inspector.nothingHint')}</p>
      </div>
    );
  }
  const set = (fn: (l: Layer) => Layer, merge?: string) => editor.changeLayer(layer.id, fn, merge);
  const title = layer.kind === 'text' ? t('cards.inspector.text') : layer.kind === 'image' ? t('cards.inspector.photo') : layer.kind === 'shape' ? t('cards.inspector.shape') : t('cards.inspector.decoration');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow text-brand-700">{title}</p>
          <p className="truncate text-sm text-stone-500">{layer.kind === 'text' ? textOf(editor, layer).slice(0, 40) : layerLabel(layer)}</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="btn-3d btn-3d-light min-h-9 rounded-lg px-3 text-xs">
            {t('cards.inspector.done')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label={t('cards.inspector.arrange')}>
        <IconButton
          label={t('cards.layer.duplicate')}
          onClick={() => {
            const result = duplicate(design.board, layer.id);
            if (!result.id) return;
            editor.change((d) => ({ ...d, board: result.board }));
            editor.select(result.id);
          }}
        >
          <Copy aria-hidden className="size-4" />
        </IconButton>
        <IconButton label={t('cards.layer.front')} onClick={() => editor.change((d) => ({ ...d, board: restack(d.board, layer.id, 'top') }))}>
          <ChevronsUp aria-hidden className="size-4" />
        </IconButton>
        <IconButton label={t('cards.layer.back')} onClick={() => editor.change((d) => ({ ...d, board: restack(d.board, layer.id, 'bottom') }))}>
          <ChevronsDown aria-hidden className="size-4" />
        </IconButton>
        <IconButton label={layer.locked ? t('cards.layer.unlock') : t('cards.layer.lock')} active={layer.locked} onClick={() => set((l) => ({ ...l, locked: !l.locked }))}>
          {layer.locked ? <Lock aria-hidden className="size-4" /> : <LockOpen aria-hidden className="size-4" />}
        </IconButton>
        <IconButton label={layer.hidden ? t('cards.layer.show') : t('cards.layer.hide')} active={layer.hidden} onClick={() => set((l) => ({ ...l, hidden: !l.hidden }))}>
          {layer.hidden ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </IconButton>
        <IconButton label={t('cards.layer.delete')} onClick={() => editor.removeLayer(layer.id)} className="!text-red-700">
          <Trash2 aria-hidden className="size-4" />
        </IconButton>
      </div>

      {layer.kind === 'text' ? <TextSettings editor={editor} layer={layer} /> : null}
      {layer.kind === 'image' ? <PhotoSettings editor={editor} layer={layer} /> : null}
      {layer.kind === 'shape' ? <ShapeSettings editor={editor} layer={layer} /> : null}
      {layer.kind === 'ornament' ? <OrnamentSettings editor={editor} layer={layer} /> : null}
      {layer.kind === 'icon' ? <ColorField label={t('cards.inspector.color')} value={layer.color} colors={design.colors} onChange={(c) => set((l) => ({ ...l, color: c }) as Layer, 'color')} /> : null}
      {layer.kind === 'scene' ? (
        <label className="flex min-h-10 items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={layer.sky} onChange={(e) => set((l) => ({ ...l, sky: e.target.checked }) as Layer)} className="size-4 accent-brand-700" />
          {t('cards.inspector.sky')}
        </label>
      ) : null}

      <PanelSection title={t('cards.inspector.placement')}>
        <Slider label={t('cards.inspector.rotation')} value={Math.round(layer.frame.rotate)} min={-180} max={180} onChange={(v) => set((l) => ({ ...l, frame: { ...l.frame, rotate: v } }), 'rotate')} format={(v) => `${v}°`} />
        <Slider label={t('cards.inspector.opacity')} value={Math.round(layer.opacity * 100)} min={5} max={100} onChange={(v) => set((l) => ({ ...l, opacity: v / 100 }), 'opacity')} format={(v) => `${v}%`} />
      </PanelSection>
    </div>
  );
}

const FONT_ROLES = ['heading', 'body', 'script'] as const;

function TextSettings({ editor, layer }: { editor: CardEditorApi; layer: TextLayer }) {
  const { design, t } = editor;
  const style = layer.style;
  const setStyle = (patch: Partial<TextLayer['style']>, merge?: string) => editor.changeLayer(layer.id, (l) => ({ ...(l as TextLayer), style: { ...(l as TextLayer).style, ...patch } }), merge);
  const linked = !('literal' in layer.content);
  return (
    <>
      <TextField
        id="card-inspector-words"
        label={t('cards.inspector.words')}
        value={textOf(editor, layer)}
        multiline
        onChange={(v) => editor.changeLayer(layer.id, (l) => ({ ...(l as TextLayer), content: { literal: v } }), `text:${layer.id}`)}
        hint={linked && !('t' in layer.content) ? t('cards.text.linked') : undefined}
      />
      <PanelSection title={t('cards.inspector.font')}>
        <select
          aria-label={t('cards.inspector.font')}
          value={style.font}
          onChange={(e) => setStyle({ font: e.target.value as TextLayer['style']['font'] })}
          className="block min-h-10 w-full rounded-xl border border-[#e2d2c0] bg-[#f8f2ea] px-2 text-sm shadow-clay-inset focus:border-brand-600 focus:outline-none"
        >
          <optgroup label={t('cards.inspector.fontRoles')}>
            {FONT_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`cards.inspector.fontRole.${role}`)} · {(role === 'script' ? (design.fonts.script ?? design.fonts.heading) : design.fonts[role]).family}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('cards.inspector.fontFamilies')}>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </optgroup>
        </select>
        <Slider label={t('cards.inspector.size')} value={Math.round(style.size)} min={6} max={Math.max(160, Math.round(style.size))} onChange={(v) => setStyle({ size: v }, 'size')} />
        <div className="flex flex-wrap items-center gap-1.5">
          <IconButton label={t('cards.inspector.bold')} active={style.weight >= 600} onClick={() => setStyle({ weight: style.weight >= 600 ? 400 : 700 })}>
            <Bold aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={t('cards.inspector.italic')} active={style.italic} onClick={() => setStyle({ italic: !style.italic })}>
            <Italic aria-hidden className="size-4" />
          </IconButton>
          <span className="mx-1 h-6 w-px bg-stone-300" aria-hidden />
          <IconButton label={t('cards.inspector.alignLeft')} active={style.align === 'left'} onClick={() => setStyle({ align: 'left' })}>
            <AlignLeft aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={t('cards.inspector.alignCenter')} active={style.align === 'center'} onClick={() => setStyle({ align: 'center' })}>
            <AlignCenter aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={t('cards.inspector.alignRight')} active={style.align === 'right'} onClick={() => setStyle({ align: 'right' })}>
            <AlignRight aria-hidden className="size-4" />
          </IconButton>
        </div>
      </PanelSection>
      <ColorField label={t('cards.inspector.color')} value={style.color} colors={design.colors} onChange={(c) => setStyle({ color: c }, 'color')} />
      <PanelSection title={t('cards.inspector.spacing')}>
        <Slider label={t('cards.inspector.lineHeight')} value={style.lineHeight} min={0.8} max={2.6} step={0.05} onChange={(v) => setStyle({ lineHeight: v }, 'lineHeight')} format={(v) => v.toFixed(2)} />
        <Slider label={t('cards.inspector.letterSpacing')} value={style.letterSpacing} min={-0.1} max={0.6} step={0.01} onChange={(v) => setStyle({ letterSpacing: v }, 'letterSpacing')} format={(v) => v.toFixed(2)} />
      </PanelSection>
      <PanelSection title={t('cards.inspector.effects')}>
        <Segmented
          label={t('cards.inspector.case')}
          value={style.transform === 'upper' ? 'upper' : 'none'}
          onChange={(v) => setStyle({ transform: v })}
          options={[
            { value: 'none', label: t('cards.inspector.case.none') },
            { value: 'upper', label: t('cards.inspector.case.upper') },
          ]}
        />
        <Segmented
          label={t('cards.inspector.shadow')}
          value={style.shadow}
          onChange={(v) => setStyle({ shadow: v })}
          options={[
            { value: 'none', label: t('cards.inspector.shadow.none') },
            { value: 'soft', label: t('cards.inspector.shadow.soft') },
            { value: 'glow', label: t('cards.inspector.shadow.glow') },
            { value: 'hard', label: t('cards.inspector.shadow.hard') },
          ]}
        />
        <label className="flex min-h-10 items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={style.foil} onChange={(e) => setStyle({ foil: e.target.checked })} className="size-4 accent-brand-700" />
          {t('cards.inspector.foil')}
        </label>
        <Segmented
          label={t('cards.inspector.overflow')}
          value={layer.overflow === 'clip' ? 'shrink' : layer.overflow}
          onChange={(v) => editor.changeLayer(layer.id, (l) => ({ ...(l as TextLayer), overflow: v }))}
          options={[
            { value: 'shrink', label: t('cards.inspector.overflow.shrink') },
            { value: 'wrap', label: t('cards.inspector.overflow.wrap') },
          ]}
        />
      </PanelSection>
    </>
  );
}

function PhotoSettings({ editor, layer }: { editor: CardEditorApi; layer: ImageLayer }) {
  const { design, t } = editor;
  const input = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ImageLayer>, merge?: string) => editor.changeLayer(layer.id, (l) => ({ ...(l as ImageLayer), ...patch }), merge);
  const binding = layer.source.type === 'binding' ? (layer.source.binding as keyof CardDesign['photos']) : null;
  const hasPhoto = binding ? Boolean(design.photos[binding]) : true;
  return (
    <>
      {binding ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const id = await editor.uploadPhoto(file);
              if (id) editor.change((d) => ({ ...d, photos: { ...d.photos, [binding]: id } }));
            }}
          />
          <button type="button" disabled={editor.uploading} onClick={() => input.current?.click()} className="btn-3d min-h-11 w-full justify-center gap-2 rounded-xl text-sm disabled:opacity-60">
            <Upload aria-hidden className="size-4" /> {editor.uploading ? t('cards.photos.uploading') : hasPhoto ? t('cards.photos.replace') : t('cards.photos.upload')}
          </button>
        </>
      ) : null}
      <PanelSection title={t('cards.inspector.crop')} hint={t('cards.inspector.cropHint')}>
        <Segmented
          label={t('cards.inspector.fit')}
          value={layer.fit}
          onChange={(v) => set({ fit: v })}
          options={[
            { value: 'cover', label: t('cards.inspector.fit.cover') },
            { value: 'contain', label: t('cards.inspector.fit.contain') },
          ]}
        />
        <Slider label={t('cards.inspector.zoom')} value={layer.zoom} min={1} max={4} step={0.05} onChange={(v) => set({ zoom: v }, 'zoom')} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label={t('cards.inspector.focusX')} value={layer.focusX} min={0} max={100} onChange={(v) => set({ focusX: v }, 'focusX')} format={(v) => `${v}%`} />
        <Slider label={t('cards.inspector.focusY')} value={layer.focusY} min={0} max={100} onChange={(v) => set({ focusY: v }, 'focusY')} format={(v) => `${v}%`} />
        <div className="flex gap-1.5">
          <IconButton label={t('cards.inspector.flipX')} active={layer.flipX} onClick={() => set({ flipX: !layer.flipX })}>
            <FlipHorizontal2 aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={t('cards.inspector.flipY')} active={layer.flipY} onClick={() => set({ flipY: !layer.flipY })}>
            <FlipVertical2 aria-hidden className="size-4" />
          </IconButton>
        </div>
      </PanelSection>
      <PanelSection title={t('cards.inspector.frame')}>
        <div className="grid grid-cols-4 gap-1.5">
          {IMAGE_MASKS.map((mask) => (
            <button
              key={mask}
              type="button"
              aria-pressed={layer.mask === mask}
              onClick={() => set({ mask })}
              className={cn('min-h-9 rounded-lg text-xs font-medium', layer.mask === mask ? 'btn-3d' : 'btn-3d btn-3d-light')}
            >
              {t(`cards.mask.${mask}`)}
            </button>
          ))}
        </div>
        {layer.mask === 'rounded' ? <Slider label={t('cards.inspector.radius')} value={layer.radius} min={0} max={Math.round(Math.min(layer.frame.w, layer.frame.h) / 2)} onChange={(v) => set({ radius: v }, 'radius')} /> : null}
        <Slider label={t('cards.inspector.border')} value={layer.border?.width ?? 0} min={0} max={24} onChange={(v) => set({ border: { width: v, color: layer.border?.color ?? 'surface' } }, 'border')} />
        {layer.border && layer.border.width > 0 ? <ColorField label={t('cards.inspector.borderColor')} value={layer.border.color} colors={design.colors} onChange={(c) => set({ border: { width: layer.border!.width, color: c } }, 'borderColor')} /> : null}
        <Slider label={t('cards.inspector.brightness')} value={layer.brightness} min={0.4} max={1.6} step={0.05} onChange={(v) => set({ brightness: v }, 'brightness')} format={(v) => `${Math.round(v * 100)}%`} />
      </PanelSection>
    </>
  );
}

function ShapeSettings({ editor, layer }: { editor: CardEditorApi; layer: ShapeLayer }) {
  const { design, t } = editor;
  const set = (patch: Partial<ShapeLayer>, merge?: string) => editor.changeLayer(layer.id, (l) => ({ ...(l as ShapeLayer), ...patch }), merge);
  const fill = layer.fill;
  return (
    <>
      {fill.type === 'color' ? (
        <ColorField label={t('cards.inspector.fill')} value={fill.color} colors={design.colors} onChange={(c) => set({ fill: { type: 'color', color: c } }, 'fill')} allowNone />
      ) : fill.type === 'gradient' ? (
        <>
          <ColorField label={t('cards.colors.bg.from')} value={fill.gradient.from} colors={design.colors} onChange={(c) => set({ fill: { ...fill, gradient: { ...fill.gradient, from: c } } }, 'fillFrom')} />
          <ColorField label={t('cards.colors.bg.to')} value={fill.gradient.to} colors={design.colors} onChange={(c) => set({ fill: { ...fill, gradient: { ...fill.gradient, to: c } } }, 'fillTo')} />
        </>
      ) : (
        <button type="button" onClick={() => set({ fill: { type: 'color', color: 'accent' } })} className="btn-3d btn-3d-light min-h-10 w-full justify-center rounded-xl text-sm">
          {t('cards.inspector.solidFill')}
        </button>
      )}
      <Slider label={t('cards.inspector.outline')} value={layer.stroke?.width ?? 0} min={0} max={20} step={0.5} onChange={(v) => set({ stroke: { width: v, color: layer.stroke?.color ?? 'secondary', dash: layer.stroke?.dash ?? 0 } }, 'stroke')} />
      {layer.stroke && layer.stroke.width > 0 ? <ColorField label={t('cards.inspector.outlineColor')} value={layer.stroke.color} colors={design.colors} onChange={(c) => set({ stroke: { ...layer.stroke!, color: c } }, 'strokeColor')} /> : null}
      {layer.shape === 'rect' ? <Slider label={t('cards.inspector.radius')} value={layer.radius} min={0} max={Math.round(Math.min(layer.frame.w, layer.frame.h) / 2)} onChange={(v) => set({ radius: v }, 'radius')} /> : null}
    </>
  );
}

function OrnamentSettings({ editor, layer }: { editor: CardEditorApi; layer: OrnamentLayer }) {
  const { design, t } = editor;
  const set = (patch: Partial<OrnamentLayer>, merge?: string) => editor.changeLayer(layer.id, (l) => ({ ...(l as OrnamentLayer), ...patch }), merge);
  return (
    <>
      <ColorField label={t('cards.inspector.color')} value={layer.color} colors={design.colors} onChange={(c) => set({ color: c }, 'color')} />
      <div className="flex flex-wrap items-center gap-1.5">
        <IconButton label={t('cards.inspector.flipX')} active={layer.flipX} onClick={() => set({ flipX: !layer.flipX })}>
          <FlipHorizontal2 aria-hidden className="size-4" />
        </IconButton>
        <IconButton label={t('cards.inspector.flipY')} active={layer.flipY} onClick={() => set({ flipY: !layer.flipY })}>
          <FlipVertical2 aria-hidden className="size-4" />
        </IconButton>
        <label className="ml-2 flex min-h-10 items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={layer.foil} onChange={(e) => set({ foil: e.target.checked })} className="size-4 accent-brand-700" />
          {t('cards.inspector.foil')}
        </label>
      </div>
    </>
  );
}
