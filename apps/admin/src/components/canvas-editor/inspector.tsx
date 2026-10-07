'use client';

import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Maximize2, Trash2 } from 'lucide-react';
import {
  BINDINGS,
  BUTTON_ACTIONS,
  EFFECTS,
  ICONS,
  IMAGE_MASKS,
  LAYER_ENTRANCES,
  LAYER_MOTIONS,
  ORNAMENT_LAYERS,
  SHAPES,
  TEXT_SHADOWS,
  TEXT_TRANSFORMS,
  type Artboard,
  type CanvasSection,
  type IconLayer,
  type ImageLayer,
  type Layer,
  type OrnamentLayer,
  type ShapeLayer,
  type TextLayer,
  type ThemeColors,
  type WidgetLayer,
} from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { Badge, Button, Input } from '../ui';
import { ColorField, FillField, FontField, Group, NumberField, Row, SelectField, TextField, ToggleField, ValueField } from './fields';
import { desktopFromMobile } from './presets';

const IMAGE_BINDINGS = [...new Set([...Object.entries(BINDINGS).filter(([, b]) => b.type === 'image').map(([k]) => k), 'photos[0]', 'photos[1]', 'photos[2]', 'photos[3]'])];
const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;
const DETAIL_ROWS = ['date', 'time', 'venue', 'address', 'city'] as const;
type CountdownWidget = Extract<WidgetLayer['widget'], { type: 'countdown' }>;
type ButtonWidget = Extract<WidgetLayer['widget'], { type: 'button' }>;
type DetailsWidget = Extract<WidgetLayer['widget'], { type: 'details' }>;

export interface InspectorProps {
  canvas: CanvasSection;
  device: 'mobile' | 'desktop';
  board: Artboard;
  layer: Layer | null;
  colors: ThemeColors;
  textSlots: Array<{ key: string; label: string }>;
  onLayer: (mutate: (layer: Layer) => void) => void;
  onBoard: (mutate: (board: Artboard) => void) => void;
  onCanvas: (mutate: (canvas: CanvasSection) => void) => void;
  onPickAsset: (cb: (assetId: string) => void) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (where: 'forward' | 'backward' | 'front' | 'back') => void;
}

/** The right-hand panel: the selected layer's properties, or the artboard's and section's when nothing is selected. */
export function Inspector(p: InspectorProps) {
  if (!p.layer) return <BoardInspector {...p} />;
  return <LayerInspector {...p} layer={p.layer} />;
}

function BoardInspector({ canvas, device, board, colors, onBoard, onCanvas, onPickAsset }: InspectorProps) {
  return (
    <div>
      <Group title={t('canvas.artboard')}>
        <NumberField label={t('canvas.width')} value={board.width} min={200} max={4000} onChange={(width) => onBoard((b) => void (b.width = Math.round(width)))} />
        <NumberField label={t('canvas.height')} value={board.height} min={100} max={8000} onChange={(height) => onBoard((b) => void (b.height = Math.round(height)))} />
        <FillField value={board.background} onChange={(background) => onBoard((b) => void (b.background = background))} colors={colors} onPickAsset={onPickAsset} />
        <SelectField label={t('canvas.effect')} value={board.effect} onChange={(effect) => onBoard((b) => void (b.effect = effect))} options={EFFECTS} />
      </Group>
      <Group title={t('canvas.canvasSettings')}>
        <ToggleField label={t('canvas.repeat')} checked={canvas.repeatPerFunction} onChange={(v) => onCanvas((c) => void (c.repeatPerFunction = v))} />
        {canvas.desktop ? (
          <Button size="sm" variant="secondary" className="w-full" onClick={() => window.confirm(t('common.confirm')) && onCanvas((c) => void delete c.desktop)}>
            {t('canvas.removeDesktop')}
          </Button>
        ) : (
          <>
            <NumberField label={t('canvas.desktopMaxWidth')} value={canvas.desktopMaxWidth} min={320} max={1200} suffix="px" onChange={(n) => onCanvas((c) => void (c.desktopMaxWidth = Math.round(n)))} />
            <p className="text-[11px] text-stone-500">{t('canvas.noDesktop')}</p>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => onCanvas((c) => void (c.desktop = desktopFromMobile(c.mobile)))}>
              {t('canvas.addDesktop')}
            </Button>
            <p className="text-[11px] text-stone-500">{t('canvas.addDesktopHint')}</p>
          </>
        )}
        {device === 'desktop' ? <p className="text-[11px] text-stone-500">{t('canvas.device.desktop')}</p> : null}
      </Group>
      <div className="px-3 py-3 text-[11px] leading-relaxed text-stone-500">{t('canvas.help')}</div>
    </div>
  );
}

function LayerInspector({ layer, board, colors, textSlots, onLayer, onPickAsset, onDuplicate, onDelete, onReorder }: InspectorProps & { layer: Layer }) {
  const f = layer.frame;
  const setFrame = (patch: Partial<Layer['frame']>) => onLayer((l) => void (l.frame = { ...l.frame, ...patch }));
  const alignButtons: Array<{ label: string; icon: typeof AlignStartVertical; apply: () => void }> = [
    { label: t('canvas.align.left'), icon: AlignStartVertical, apply: () => setFrame({ x: 0 }) },
    { label: t('canvas.align.center'), icon: AlignCenterVertical, apply: () => setFrame({ x: Math.round((board.width - f.w) / 2) }) },
    { label: t('canvas.align.right'), icon: AlignEndVertical, apply: () => setFrame({ x: board.width - f.w }) },
    { label: t('canvas.align.top'), icon: AlignStartHorizontal, apply: () => setFrame({ y: 0 }) },
    { label: t('canvas.align.middle'), icon: AlignCenterHorizontal, apply: () => setFrame({ y: Math.round((board.height - f.h) / 2) }) },
    { label: t('canvas.align.bottom'), icon: AlignEndHorizontal, apply: () => setFrame({ y: board.height - f.h }) },
  ];
  return (
    <div>
      <div className="space-y-2 border-b border-stone-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge>{layer.kind}</Badge>
          <Input aria-label={t('canvas.name')} className="min-h-8 flex-1 py-0 text-xs" key={layer.id} defaultValue={layer.name ?? ''} placeholder={layer.id} maxLength={60} onBlur={(e) => onLayer((l) => void (l.name = e.target.value.trim() || undefined))} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button size="icon" variant="ghost" aria-label={t('canvas.forward')} title={t('canvas.forward')} onClick={() => onReorder('forward')}>
            <ChevronUp className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={t('canvas.backward')} title={t('canvas.backward')} onClick={() => onReorder('backward')}>
            <ChevronDown className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={t('canvas.front')} title={t('canvas.front')} onClick={() => onReorder('front')}>
            <ArrowUpToLine className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={t('canvas.backmost')} title={t('canvas.backmost')} onClick={() => onReorder('back')}>
            <ArrowDownToLine className="size-4" />
          </Button>
          <span className="flex-1" />
          <Button size="icon" variant="ghost" aria-label={t('canvas.duplicate')} title={t('canvas.duplicate')} onClick={onDuplicate}>
            <Copy className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-red-700 hover:bg-red-50" aria-label={t('canvas.delete')} title={t('canvas.delete')} onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <Group title={t('canvas.position')}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField compact label={t('canvas.x')} value={f.x} min={-4000} max={8000} onChange={(x) => setFrame({ x })} />
          <NumberField compact label={t('canvas.y')} value={f.y} min={-4000} max={8000} onChange={(y) => setFrame({ y })} />
          <NumberField compact label={t('canvas.w')} value={f.w} min={1} max={8000} onChange={(w) => setFrame({ w })} />
          <NumberField compact label={t('canvas.h')} value={f.h} min={1} max={8000} onChange={(h) => setFrame({ h })} />
          <NumberField compact label={t('canvas.rotate')} value={f.rotate} min={-360} max={360} suffix="°" onChange={(rotate) => setFrame({ rotate })} />
          <NumberField compact label={t('canvas.opacity')} value={layer.opacity} min={0} max={1} step={0.05} onChange={(opacity) => onLayer((l) => void (l.opacity = opacity))} />
        </div>
        <Row label={t('canvas.align')}>
          <div className="flex flex-wrap gap-0.5">
            {alignButtons.map((a) => (
              <Button key={a.label} size="icon" variant="ghost" className="size-7" aria-label={a.label} title={a.label} onClick={a.apply}>
                <a.icon className="size-4" />
              </Button>
            ))}
            <Button size="icon" variant="ghost" className="size-7" aria-label={t('canvas.fillBoard')} title={t('canvas.fillBoard')} onClick={() => setFrame({ x: 0, y: 0, w: board.width, h: board.height, rotate: 0 })}>
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </Row>
        <div className="flex gap-3">
          <ToggleField label={t('canvas.hidden')} checked={layer.hidden} onChange={(v) => onLayer((l) => void (l.hidden = v))} />
          <ToggleField label={t('canvas.locked')} checked={layer.locked} onChange={(v) => onLayer((l) => void (l.locked = v))} />
        </div>
      </Group>

      {layer.kind === 'text' ? <TextProps layer={layer} colors={colors} textSlots={textSlots} onLayer={onLayer} /> : null}
      {layer.kind === 'image' ? <ImageProps layer={layer} colors={colors} onLayer={onLayer} onPickAsset={onPickAsset} /> : null}
      {layer.kind === 'shape' ? <ShapeProps layer={layer} colors={colors} onLayer={onLayer} onPickAsset={onPickAsset} /> : null}
      {layer.kind === 'ornament' ? <OrnamentProps layer={layer} colors={colors} onLayer={onLayer} /> : null}
      {layer.kind === 'icon' ? <IconProps layer={layer} colors={colors} onLayer={onLayer} /> : null}
      {layer.kind === 'widget' ? <WidgetProps layer={layer} colors={colors} textSlots={textSlots} onLayer={onLayer} /> : null}

      <Group title={t('canvas.visibility')} open={!!layer.visibleWhen}>
        <TextField
          label={t('canvas.exists')}
          value={layer.visibleWhen?.exists ?? ''}
          list="canvas-bindings"
          onChange={(v) =>
            onLayer((l) => {
              const exists = v.trim();
              const next: { exists?: string; eventTypes?: string[] } = { ...(l.visibleWhen ?? {}), exists: exists || undefined };
              if (!next.exists) delete next.exists;
              l.visibleWhen = next.exists || next.eventTypes?.length ? next : undefined;
            })
          }
        />
        <TextField
          label={t('canvas.eventTypes')}
          value={layer.visibleWhen?.eventTypes?.join(', ') ?? ''}
          placeholder="WEDDING, ENGAGEMENT"
          maxLength={400}
          onChange={(v) =>
            onLayer((l) => {
              const eventTypes = v
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean);
              const next: { exists?: string; eventTypes?: string[] } = { ...(l.visibleWhen ?? {}), eventTypes: eventTypes.length ? eventTypes : undefined };
              if (!next.eventTypes) delete next.eventTypes;
              l.visibleWhen = next.exists || next.eventTypes?.length ? next : undefined;
            })
          }
        />
      </Group>

      <Group title={t('canvas.animation')} open={layer.animation.entrance !== 'none' || layer.animation.motion !== 'none'}>
        <SelectField label={t('canvas.entrance')} value={layer.animation.entrance} onChange={(entrance) => onLayer((l) => void (l.animation.entrance = entrance))} options={LAYER_ENTRANCES} />
        <NumberField label={t('canvas.delay')} value={layer.animation.delaySec} min={0} max={10} step={0.1} suffix="s" onChange={(delaySec) => onLayer((l) => void (l.animation.delaySec = delaySec))} />
        <NumberField label={t('canvas.duration')} value={layer.animation.durationSec} min={0.1} max={6} step={0.1} suffix="s" onChange={(durationSec) => onLayer((l) => void (l.animation.durationSec = durationSec))} />
        <SelectField label={t('canvas.motion')} value={layer.animation.motion} onChange={(motion) => onLayer((l) => void (l.animation.motion = motion))} options={LAYER_MOTIONS} />
      </Group>
    </div>
  );
}

type Edit<L extends Layer> = (mutate: (layer: L) => void) => void;

/** Narrow the layer mutation to one kind (the layer under edit cannot change kind). */
function narrow<L extends Layer>(onLayer: InspectorProps['onLayer'], kind: L['kind']): Edit<L> {
  return (mutate) =>
    onLayer((l) => {
      if (l.kind === kind) mutate(l as L);
    });
}

function TextProps({ layer, colors, textSlots, onLayer }: { layer: TextLayer; colors: ThemeColors; textSlots: InspectorProps['textSlots']; onLayer: InspectorProps['onLayer'] }) {
  const edit = narrow<TextLayer>(onLayer, 'text');
  const s = layer.style;
  return (
    <Group title={t('canvas.text')}>
      <ValueField label={t('canvas.content')} value={layer.content} onChange={(content) => edit((l) => void (l.content = content))} textSlots={textSlots} multiline />
      <FontField label={t('canvas.font')} value={s.font} onChange={(font) => edit((l) => void (l.style.font = font as TextLayer['style']['font']))} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumberField compact label={t('canvas.size')} value={s.size} min={6} max={600} onChange={(size) => edit((l) => void (l.style.size = size))} />
        <SelectField compact label={t('canvas.weight')} value={String(s.weight) as (typeof WEIGHTS)[number]} onChange={(w) => edit((l) => void (l.style.weight = Number(w)))} options={WEIGHTS} />
        <NumberField compact label={t('canvas.lineHeight')} value={s.lineHeight} min={0.7} max={3} step={0.05} onChange={(lineHeight) => edit((l) => void (l.style.lineHeight = lineHeight))} />
        <NumberField compact label={t('canvas.letterSpacing')} value={s.letterSpacing} min={-0.2} max={1} step={0.01} onChange={(letterSpacing) => edit((l) => void (l.style.letterSpacing = letterSpacing))} />
      </div>
      <ColorField label={t('canvas.color')} value={s.color} onChange={(color) => edit((l) => void (l.style.color = color ?? 'text'))} colors={colors} />
      <SelectField label={t('canvas.textAlign')} value={s.align} onChange={(align) => edit((l) => void (l.style.align = align))} options={['left', 'center', 'right']} />
      <SelectField label={t('canvas.valign')} value={s.valign} onChange={(valign) => edit((l) => void (l.style.valign = valign))} options={['top', 'middle', 'bottom']} />
      <SelectField label={t('canvas.transform')} value={s.transform} onChange={(transform) => edit((l) => void (l.style.transform = transform))} options={TEXT_TRANSFORMS} />
      <SelectField label={t('canvas.shadow')} value={s.shadow} onChange={(shadow) => edit((l) => void (l.style.shadow = shadow))} options={TEXT_SHADOWS} />
      <SelectField
        label={t('canvas.overflow')}
        value={layer.overflow}
        onChange={(overflow) => edit((l) => void (l.overflow = overflow))}
        options={[
          { value: 'shrink', label: t('canvas.overflow.shrink') },
          { value: 'wrap', label: t('canvas.overflow.wrap') },
          { value: 'clip', label: t('canvas.overflow.clip') },
        ]}
      />
      <ToggleField label={t('canvas.italic')} checked={s.italic} onChange={(italic) => edit((l) => void (l.style.italic = italic))} />
      <ToggleField label={t('canvas.contrast')} checked={s.contrast} onChange={(contrast) => edit((l) => void (l.style.contrast = contrast))} />
    </Group>
  );
}

function ImageProps({ layer, colors, onLayer, onPickAsset }: { layer: ImageLayer; colors: ThemeColors; onLayer: InspectorProps['onLayer']; onPickAsset: InspectorProps['onPickAsset'] }) {
  const edit = narrow<ImageLayer>(onLayer, 'image');
  return (
    <Group title={t('canvas.image')}>
      <SelectField
        label={t('canvas.source')}
        value={layer.source.type}
        onChange={(type) => {
          if (type === 'asset') onPickAsset((assetId) => edit((l) => void (l.source = { type: 'asset', assetId })));
          else edit((l) => void (l.source = { type: 'binding', binding: 'photo.cover' }));
        }}
        options={[
          { value: 'asset', label: t('canvas.source.asset') },
          { value: 'binding', label: t('canvas.source.binding') },
        ]}
      />
      {layer.source.type === 'asset' ? (
        <Row label={t('canvas.image')}>
          <Button size="sm" variant="secondary" className="w-full justify-start truncate font-mono" onClick={() => onPickAsset((assetId) => edit((l) => void (l.source = { type: 'asset', assetId })))}>
            {layer.source.assetId.slice(0, 8)}… · {t('canvas.chooseImage')}
          </Button>
        </Row>
      ) : (
        <SelectField label={t('canvas.source.binding')} value={layer.source.binding} onChange={(binding) => edit((l) => void (l.source = { type: 'binding', binding }))} options={IMAGE_BINDINGS.includes(layer.source.binding) ? IMAGE_BINDINGS : [layer.source.binding, ...IMAGE_BINDINGS]} />
      )}
      <SelectField label={t('canvas.fit')} value={layer.fit} onChange={(fit) => edit((l) => void (l.fit = fit))} options={['cover', 'contain']} />
      <SelectField label={t('canvas.mask')} value={layer.mask} onChange={(mask) => edit((l) => void (l.mask = mask))} options={IMAGE_MASKS} />
      {layer.mask === 'rounded' || layer.mask === 'arch' ? <NumberField label={t('canvas.radius')} value={layer.radius} min={0} max={1000} onChange={(radius) => edit((l) => void (l.radius = radius))} /> : null}
      <NumberField label={t('canvas.borderWidth')} value={layer.border?.width ?? 0} min={0} max={100} onChange={(width) => edit((l) => void (l.border = width > 0 ? { width, color: l.border?.color ?? 'surface' } : undefined))} />
      {layer.border ? <ColorField label={t('canvas.border')} value={layer.border.color} onChange={(color) => edit((l) => void (l.border = { width: l.border?.width ?? 2, color: color ?? 'surface' }))} colors={colors} /> : null}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumberField compact label={t('canvas.brightness')} value={layer.brightness} min={0.2} max={2} step={0.05} onChange={(brightness) => edit((l) => void (l.brightness = brightness))} />
        <NumberField compact label={t('canvas.saturate')} value={layer.saturate} min={0} max={2} step={0.05} onChange={(saturate) => edit((l) => void (l.saturate = saturate))} />
      </div>
      <div className="flex flex-wrap gap-3">
        <ToggleField label={t('canvas.shadow')} checked={layer.shadow} onChange={(shadow) => edit((l) => void (l.shadow = shadow))} />
        <ToggleField label={t('canvas.flipX')} checked={layer.flipX} onChange={(flipX) => edit((l) => void (l.flipX = flipX))} />
        <ToggleField label={t('canvas.flipY')} checked={layer.flipY} onChange={(flipY) => edit((l) => void (l.flipY = flipY))} />
      </div>
      <TextField label={t('canvas.alt')} value={layer.alt ?? ''} onChange={(alt) => edit((l) => void (l.alt = alt.trim() || undefined))} />
    </Group>
  );
}

function ShapeProps({ layer, colors, onLayer, onPickAsset }: { layer: ShapeLayer; colors: ThemeColors; onLayer: InspectorProps['onLayer']; onPickAsset: InspectorProps['onPickAsset'] }) {
  const edit = narrow<ShapeLayer>(onLayer, 'shape');
  return (
    <Group title={t('canvas.shape')}>
      <SelectField label={t('canvas.shape')} value={layer.shape} onChange={(shape) => edit((l) => void (l.shape = shape))} options={SHAPES} />
      {layer.shape !== 'line' ? <FillField value={layer.fill} onChange={(fill) => edit((l) => void (l.fill = fill))} colors={colors} onPickAsset={onPickAsset} /> : null}
      <NumberField label={t('canvas.strokeWidth')} value={layer.stroke?.width ?? 0} min={0} max={100} onChange={(width) => edit((l) => void (l.stroke = width > 0 ? { width, color: l.stroke?.color ?? 'secondary', dash: l.stroke?.dash ?? 0 } : undefined))} />
      {layer.stroke ? (
        <>
          <ColorField label={t('canvas.stroke')} value={layer.stroke.color} onChange={(color) => edit((l) => void (l.stroke = { ...(l.stroke ?? { width: 1, dash: 0 }), color: color ?? 'secondary' }))} colors={colors} />
          <NumberField label={t('canvas.dash')} value={layer.stroke.dash} min={0} max={100} onChange={(dash) => edit((l) => void (l.stroke = { ...(l.stroke ?? { width: 1, color: 'secondary' }), dash }))} />
        </>
      ) : null}
      {layer.shape === 'rect' || layer.shape === 'arch' ? <NumberField label={t('canvas.radius')} value={layer.radius} min={0} max={1000} onChange={(radius) => edit((l) => void (l.radius = radius))} /> : null}
      <ToggleField label={t('canvas.shadow')} checked={layer.shadow} onChange={(shadow) => edit((l) => void (l.shadow = shadow))} />
    </Group>
  );
}

function OrnamentProps({ layer, colors, onLayer }: { layer: OrnamentLayer; colors: ThemeColors; onLayer: InspectorProps['onLayer'] }) {
  const edit = narrow<OrnamentLayer>(onLayer, 'ornament');
  return (
    <Group title={t('canvas.ornament')}>
      <SelectField label={t('canvas.ornament')} value={layer.ornament} onChange={(ornament) => edit((l) => void (l.ornament = ornament))} options={ORNAMENT_LAYERS} />
      <ColorField label={t('canvas.color')} value={layer.color} onChange={(color) => edit((l) => void (l.color = color ?? 'secondary'))} colors={colors} />
      <div className="flex gap-3">
        <ToggleField label={t('canvas.flipX')} checked={layer.flipX} onChange={(flipX) => edit((l) => void (l.flipX = flipX))} />
        <ToggleField label={t('canvas.flipY')} checked={layer.flipY} onChange={(flipY) => edit((l) => void (l.flipY = flipY))} />
      </div>
    </Group>
  );
}

function IconProps({ layer, colors, onLayer }: { layer: IconLayer; colors: ThemeColors; onLayer: InspectorProps['onLayer'] }) {
  const edit = narrow<IconLayer>(onLayer, 'icon');
  return (
    <Group title={t('canvas.icon')}>
      <SelectField label={t('canvas.icon')} value={layer.icon} onChange={(icon) => edit((l) => void (l.icon = icon))} options={ICONS} />
      <ColorField label={t('canvas.color')} value={layer.color} onChange={(color) => edit((l) => void (l.color = color ?? 'primary'))} colors={colors} />
      <ColorField label={t('canvas.circle')} value={layer.circle} onChange={(circle) => edit((l) => void (l.circle = circle))} colors={colors} allowNone />
      <NumberField label={t('canvas.iconWeight')} value={layer.weight} min={1} max={3} step={0.25} onChange={(weight) => edit((l) => void (l.weight = weight))} />
    </Group>
  );
}

function WidgetProps({ layer, colors, textSlots, onLayer }: { layer: WidgetLayer; colors: ThemeColors; textSlots: InspectorProps['textSlots']; onLayer: InspectorProps['onLayer'] }) {
  const edit = narrow<WidgetLayer>(onLayer, 'widget');
  const w = layer.widget;
  if (w.type === 'countdown') {
    const set = (fn: (c: CountdownWidget) => void) =>
      edit((l) => {
        if (l.widget.type === 'countdown') fn(l.widget);
      });
    return (
      <Group title={t('canvas.widget')}>
        <SelectField label={t('canvas.variant')} value={w.variant} onChange={(variant) => set((c) => void (c.variant = variant))} options={['boxes', 'flip', 'inline']} />
        <NumberField label={t('canvas.size')} value={w.size} min={10} max={200} onChange={(size) => set((c) => void (c.size = size))} />
        <FontField label={t('canvas.font')} value={w.font} onChange={(font) => set((c) => void (c.font = font as typeof c.font))} />
        <ColorField label={t('canvas.color')} value={w.color} onChange={(color) => set((c) => void (c.color = color ?? 'primary'))} colors={colors} />
        <ColorField label={t('canvas.labelColor')} value={w.labelColor} onChange={(color) => set((c) => void (c.labelColor = color ?? 'muted'))} colors={colors} />
        <ColorField label={t('canvas.boxColor')} value={w.boxColor} onChange={(color) => set((c) => void (c.boxColor = color ?? 'surface'))} colors={colors} allowTransparent />
      </Group>
    );
  }
  if (w.type === 'button') {
    const set = (fn: (c: ButtonWidget) => void) =>
      edit((l) => {
        if (l.widget.type === 'button') fn(l.widget);
      });
    return (
      <Group title={t('canvas.widget')}>
        <ValueField label={t('canvas.label')} value={w.label} onChange={(label) => set((c) => void (c.label = label))} textSlots={textSlots} />
        <SelectField label={t('canvas.action')} value={w.action} onChange={(action) => set((c) => void (c.action = action))} options={BUTTON_ACTIONS.map((a) => ({ value: a, label: t(`canvas.action.${a}`) }))} />
        {w.action === 'link' ? <ValueField label={t('canvas.url')} value={w.url ?? { literal: 'https://' }} onChange={(url) => set((c) => void (c.url = url))} textSlots={textSlots} /> : null}
        {w.action === 'rsvp' ? <TextField label={t('canvas.target')} value={w.target ?? ''} onChange={(v) => set((c) => void (c.target = v.trim() || undefined))} maxLength={64} /> : null}
        <SelectField label={t('canvas.icon')} value={w.icon ?? 'none'} onChange={(icon) => set((c) => void (c.icon = icon === 'none' ? undefined : (icon as typeof c.icon)))} options={['none', ...ICONS]} />
        <FontField label={t('canvas.font')} value={w.font} onChange={(font) => set((c) => void (c.font = font as typeof c.font))} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField compact label={t('canvas.size')} value={w.size} min={8} max={120} onChange={(size) => set((c) => void (c.size = size))} />
          <SelectField compact label={t('canvas.weight')} value={String(w.weight) as (typeof WEIGHTS)[number]} onChange={(v) => set((c) => void (c.weight = Number(v)))} options={WEIGHTS} />
          <NumberField compact label={t('canvas.radius')} value={w.radius} min={0} max={500} onChange={(radius) => set((c) => void (c.radius = radius))} />
          <NumberField compact label={t('canvas.borderWidth')} value={w.border?.width ?? 0} min={0} max={20} onChange={(width) => set((c) => void (c.border = width > 0 ? { width, color: c.border?.color ?? 'primary' } : undefined))} />
        </div>
        <ColorField label={t('canvas.buttonFill')} value={w.fill} onChange={(fill) => set((c) => void (c.fill = fill ?? 'primary'))} colors={colors} allowTransparent />
        <ColorField label={t('canvas.color')} value={w.color} onChange={(color) => set((c) => void (c.color = color ?? 'background'))} colors={colors} />
        {w.border ? <ColorField label={t('canvas.border')} value={w.border.color} onChange={(color) => set((c) => void (c.border = { width: c.border?.width ?? 1, color: color ?? 'primary' }))} colors={colors} /> : null}
        <ToggleField label={t('canvas.shadow')} checked={w.shadow} onChange={(shadow) => set((c) => void (c.shadow = shadow))} />
      </Group>
    );
  }
  const set = (fn: (c: DetailsWidget) => void) =>
    edit((l) => {
      if (l.widget.type === 'details') fn(l.widget);
    });
  return (
    <Group title={t('canvas.widget')}>
      <Row label={t('canvas.rows')}>
        <div className="flex flex-wrap gap-x-3">
          {DETAIL_ROWS.map((row) => (
            <ToggleField
              key={row}
              label={row}
              checked={w.rows.includes(row)}
              onChange={(on) =>
                set((c) => {
                  const rows = DETAIL_ROWS.filter((r) => (r === row ? on : c.rows.includes(r)));
                  if (rows.length) c.rows = rows;
                })
              }
            />
          ))}
        </div>
      </Row>
      <FontField label={t('canvas.font')} value={w.font} onChange={(font) => set((c) => void (c.font = font as typeof c.font))} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumberField compact label={t('canvas.labelSize')} value={w.labelSize} min={6} max={60} onChange={(labelSize) => set((c) => void (c.labelSize = labelSize))} />
        <NumberField compact label={t('canvas.valueSize')} value={w.valueSize} min={8} max={120} onChange={(valueSize) => set((c) => void (c.valueSize = valueSize))} />
      </div>
      <ColorField label={t('canvas.labelColor')} value={w.labelColor} onChange={(color) => set((c) => void (c.labelColor = color ?? 'muted'))} colors={colors} />
      <ColorField label={t('canvas.valueColor')} value={w.valueColor} onChange={(color) => set((c) => void (c.valueColor = color ?? 'text'))} colors={colors} />
      <ToggleField label={t('canvas.rowIcons')} checked={w.icons} onChange={(icons) => set((c) => void (c.icons = icons))} />
      {w.icons ? (
        <>
          <ColorField label={t('canvas.iconColor')} value={w.iconColor} onChange={(color) => set((c) => void (c.iconColor = color ?? 'primary'))} colors={colors} />
          <ColorField label={t('canvas.iconCircle')} value={w.iconCircle} onChange={(color) => set((c) => void (c.iconCircle = color))} colors={colors} allowNone />
        </>
      ) : null}
      <ToggleField label={t('canvas.dividers')} checked={w.dividers} onChange={(dividers) => set((c) => void (c.dividers = dividers))} />
      {w.dividers ? <ColorField label={t('canvas.dividerColor')} value={w.dividerColor} onChange={(color) => set((c) => void (c.dividerColor = color ?? 'muted'))} colors={colors} /> : null}
    </Group>
  );
}
