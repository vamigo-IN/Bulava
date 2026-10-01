'use client';

import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CAMERA_MOVES, EFFECTS, ElementSchema, SCENE_NAMES, type Scene } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { Badge, Button, Card, CardTitle, Checkbox, Field, Input, Label, Select } from '../ui';
import { EditError, firstIssue, JsonField, type EditorProps } from './common';

const BACKGROUNDS = ['background', 'surface', 'primary', 'secondary', 'accent', 'gradient'] as const;
const TRANSITIONS = ['none', 'fade', 'slide', 'wipe'] as const;
const ElementsSchema = ElementSchema.array().max(40);

function uniqueId(base: string, taken: Set<string>): string {
  let i = taken.size + 1;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function ScenesTab({ definition, edit }: EditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(definition.scenes?.[0]?.id ?? null);
  const scenes = definition.scenes ?? [];
  const canvas = definition.canvas ?? { width: 1080, height: 1920, fps: 30 };
  const isCard = definition.type === 'DIGITAL_CARD';
  const run = (fn: Parameters<EditorProps['edit']>[0]) => setError(edit(fn));
  const setCanvas = (key: 'width' | 'height' | 'fps', value: number) =>
    run((d) => {
      d.canvas = { ...canvas, [key]: value };
    });

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>{t('scenes.canvas')}</CardTitle>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('scenes.width')}>
            {(p) => <Input {...p} key={canvas.width} type="number" min={200} max={4096} defaultValue={canvas.width} onBlur={(e) => setCanvas('width', Number(e.target.value))} />}
          </Field>
          <Field label={t('scenes.height')}>
            {(p) => <Input {...p} key={canvas.height} type="number" min={200} max={4096} defaultValue={canvas.height} onBlur={(e) => setCanvas('height', Number(e.target.value))} />}
          </Field>
          <Field label={t('scenes.fps')}>
            {(p) => <Input {...p} key={canvas.fps} type="number" min={12} max={60} defaultValue={canvas.fps} onBlur={(e) => setCanvas('fps', Number(e.target.value))} />}
          </Field>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('studio.tab.scenes')}</h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={isCard && scenes.length >= 1}
            onClick={() => {
              const id = uniqueId('scene', new Set(scenes.map((s) => s.id)));
              run((d) => {
                const scene: Scene = { id, durationSec: 3, background: 'background', transition: 'fade', repeatPerFunction: false, particles: 'none', elements: [] };
                d.scenes = [...(d.scenes ?? []), scene];
              });
              setOpen(id);
            }}
          >
            <Plus className="size-3.5" /> {t('scenes.add')}
          </Button>
        </div>
        <ol className="space-y-2">
          {scenes.map((scene, i) => {
            const isOpen = open === scene.id;
            return (
              <li key={scene.id} className="rounded-lg border border-stone-200">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => setOpen(isOpen ? null : scene.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} aria-hidden />
                    <span className="font-mono text-sm font-medium">{scene.id}</span>
                    <span className="text-xs text-stone-500">{scene.durationSec}s</span>
                    {scene.repeatPerFunction ? <Badge tone="brand">×fn</Badge> : null}
                    <Badge>{scene.elements.length}</Badge>
                  </button>
                  <Button size="icon" variant="ghost" aria-label={t('sections.moveUp')} disabled={i === 0} onClick={() => run((d) => move(d.scenes!, i, -1))}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={t('sections.moveDown')} disabled={i === scenes.length - 1} onClick={() => run((d) => move(d.scenes!, i, 1))}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50"
                    aria-label={t('sections.remove')}
                    disabled={scenes.length === 1}
                    onClick={() => run((d) => void d.scenes!.splice(i, 1))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {isOpen ? (
                  <div className="space-y-3 border-t border-stone-200 bg-stone-50 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label={t('scenes.duration')}>
                        {(p) => (
                          <Input
                            {...p}
                            key={scene.durationSec}
                            type="number"
                            step={0.5}
                            min={0.5}
                            max={60}
                            defaultValue={scene.durationSec}
                            onBlur={(e) => run((d) => void (d.scenes![i]!.durationSec = Number(e.target.value)))}
                          />
                        )}
                      </Field>
                      <Field label={t('scenes.background')}>
                        {(p) => (
                          <Select
                            {...p}
                            value={(BACKGROUNDS as readonly string[]).includes(scene.background) ? scene.background : 'custom'}
                            onChange={(e) => e.target.value !== 'custom' && run((d) => void (d.scenes![i]!.background = e.target.value as Scene['background']))}
                          >
                            {BACKGROUNDS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                            {(BACKGROUNDS as readonly string[]).includes(scene.background) ? null : <option value="custom">{scene.background}</option>}
                          </Select>
                        )}
                      </Field>
                      <Field label={t('scenes.transition')}>
                        {(p) => (
                          <Select {...p} value={scene.transition} onChange={(e) => run((d) => void (d.scenes![i]!.transition = e.target.value as Scene['transition']))}>
                            {TRANSITIONS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label={t('scenes.backdrop')}>
                        {(p) => (
                          <Select
                            {...p}
                            value={scene.backdrop?.artwork ? `artwork:${scene.backdrop.artwork}` : (scene.backdrop?.scene ?? '')}
                            onChange={(e) =>
                              run((d) => {
                                const target = d.scenes![i]!;
                                const value = e.target.value;
                                if (!value) {
                                  delete target.backdrop;
                                  return;
                                }
                                // A backdrop is either a drawn scene or one of the template's painted artworks.
                                const { scene: _scene, artwork: _artwork, ...rest } = target.backdrop ?? { camera: 'push' as const, intensity: 1, veil: 0 };
                                target.backdrop = value.startsWith('artwork:')
                                  ? { ...rest, artwork: value.slice('artwork:'.length) }
                                  : { ...rest, scene: value as NonNullable<NonNullable<Scene['backdrop']>['scene']> };
                              })
                            }
                          >
                            <option value="">{t('scenes.backdrop.none')}</option>
                            {Object.keys(definition.artworks ?? {}).length ? (
                              <optgroup label={t('scenes.backdrop.painted')}>
                                {Object.entries(definition.artworks ?? {}).map(([key, artwork]) => (
                                  <option key={key} value={`artwork:${key}`}>
                                    {artwork.name}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                            <optgroup label={t('scenes.backdrop.drawn')}>
                              {SCENE_NAMES.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </optgroup>
                          </Select>
                        )}
                      </Field>
                      <Field label={t('scenes.camera')}>
                        {(p) => (
                          <Select
                            {...p}
                            disabled={!scene.backdrop}
                            value={scene.backdrop?.camera ?? 'push'}
                            onChange={(e) => run((d) => void (d.scenes![i]!.backdrop!.camera = e.target.value as NonNullable<Scene['backdrop']>['camera']))}
                          >
                            {CAMERA_MOVES.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Field label={t('scenes.particles')}>
                        {(p) => (
                          <Select {...p} value={scene.particles} onChange={(e) => run((d) => void (d.scenes![i]!.particles = e.target.value as Scene['particles']))}>
                            {EFFECTS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    </div>
                    {!isCard ? (
                      <Checkbox
                        label={t('scenes.repeat')}
                        checked={scene.repeatPerFunction}
                        onChange={(e) => run((d) => void (d.scenes![i]!.repeatPerFunction = e.target.checked))}
                      />
                    ) : null}
                    <div>
                      <Label>{t('scenes.elements')}</Label>
                      <p className="mb-2 text-xs text-stone-500">{t('scenes.elementsHint')}</p>
                      <JsonField
                        key={JSON.stringify(scene.elements)}
                        label={t('scenes.elements')}
                        value={scene.elements}
                        rows={18}
                        onCommit={(parsed) => {
                          const check = ElementsSchema.safeParse(parsed);
                          if (!check.success) return firstIssue(check.error);
                          return edit((d) => void (d.scenes![i]!.elements = check.data));
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>
      <EditError message={error} />
    </div>
  );
}

function move<T>(list: T[], index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item!);
}
