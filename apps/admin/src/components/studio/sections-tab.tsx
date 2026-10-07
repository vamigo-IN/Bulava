'use client';

import { ArrowDown, ArrowUp, ChevronDown, PenTool, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SECTION_VARIANTS } from '@bulava/template-engine';
import { BINDINGS, SECTION_KEYS, SectionInstanceSchema, type SectionKey } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { emptyCanvas } from '../canvas-editor/presets';
import { Badge, Button, Card, Input, Label, Select } from '../ui';
import { EditError, firstIssue, JsonField, type EditorProps } from './common';

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function SectionsTab({ definition, edit, onOpenCanvas }: EditorProps & { onOpenCanvas?: (sectionId: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<SectionKey>('story');
  const pages = definition.website?.pages ?? [];
  const run = (fn: Parameters<EditorProps['edit']>[0]) => setError(edit(fn));

  return (
    <div className="space-y-5">
      {pages.map((page, pageIndex) => {
        const taken = new Set(page.sections.map((s) => s.id));
        return (
          <Card key={page.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{t('sections.page', { id: page.id })}</h2>
              <div className="flex items-center gap-2">
                <Select aria-label={t('sections.add')} value={adding} onChange={(e) => setAdding(e.target.value as SectionKey)} className="min-h-8 w-auto py-0 text-xs">
                  {SECTION_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const id = uniqueId(adding, taken);
                    run((d) => {
                      const sections = d.website!.pages[pageIndex]!.sections;
                      // New sections go before the footer so the page still ends with it.
                      const footerAt = sections.findIndex((s) => s.section === 'footer');
                      const variant = SECTION_VARIANTS[adding]?.[0] ?? 'default';
                      // A canvas section starts with an empty phone artboard; the editor fills it.
                      const instance = adding === 'canvas' ? { id, section: adding, variant, props: {}, canvas: emptyCanvas() } : { id, section: adding, variant, props: {} };
                      sections.splice(footerAt === -1 ? sections.length : footerAt, 0, instance as (typeof sections)[number]);
                    });
                    setOpen(id);
                    if (adding === 'canvas') onOpenCanvas?.(id);
                  }}
                >
                  <Plus className="size-3.5" /> {t('sections.add')}
                </Button>
              </div>
            </div>

            <ol className="space-y-2">
              {page.sections.map((section, i) => {
                const variants = SECTION_VARIANTS[section.section] ?? ['default'];
                const isOpen = open === section.id;
                return (
                  <li key={section.id} className="rounded-lg border border-stone-200">
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <button type="button" onClick={() => setOpen(isOpen ? null : section.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} aria-hidden />
                        <span className="font-medium text-stone-900">{section.section}</span>
                        <span className="truncate font-mono text-xs text-stone-500">#{section.id}</span>
                        {Object.keys(section.props).length ? <Badge>{Object.keys(section.props).length}</Badge> : null}
                      </button>
                      <Select
                        aria-label={t('sections.variant')}
                        value={variants.includes(section.variant) ? section.variant : variants[0]}
                        onChange={(e) => run((d) => void (d.website!.pages[pageIndex]!.sections[i]!.variant = e.target.value))}
                        className="min-h-8 w-auto py-0 text-xs"
                        disabled={variants.length < 2}
                      >
                        {variants.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </Select>
                      <Button size="icon" variant="ghost" aria-label={t('sections.moveUp')} disabled={i === 0} onClick={() => run((d) => move(d.website!.pages[pageIndex]!.sections, i, -1))}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('sections.moveDown')}
                        disabled={i === page.sections.length - 1}
                        onClick={() => run((d) => move(d.website!.pages[pageIndex]!.sections, i, 1))}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50"
                        aria-label={t('sections.remove')}
                        disabled={page.sections.length === 1}
                        onClick={() => run((d) => void d.website!.pages[pageIndex]!.sections.splice(i, 1))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {isOpen && section.section === 'canvas' && section.canvas ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 p-3">
                        <p className="text-xs text-stone-600">{t('canvas.summary', { layers: section.canvas.mobile.layers.length, desktop: section.canvas.desktop ? t('canvas.summary.desktop') : '' })}</p>
                        <Button size="sm" onClick={() => onOpenCanvas?.(section.id)}>
                          <PenTool className="size-3.5" /> {t('canvas.open')}
                        </Button>
                      </div>
                    ) : null}
                    {isOpen && section.section !== 'canvas' ? (
                      <div className="space-y-3 border-t border-stone-200 bg-stone-50 p-3">
                        <div>
                          <Label>{t('sections.props')}</Label>
                          <p className="mb-2 text-xs text-stone-500">{t('sections.propsHint')}</p>
                          <JsonField
                            key={JSON.stringify(section.props)}
                            label={t('sections.props')}
                            value={section.props}
                            rows={Math.min(18, 3 + Object.keys(section.props).length * 2)}
                            onCommit={(parsed) => {
                              const check = SectionInstanceSchema.safeParse({ ...section, props: parsed });
                              if (!check.success) return firstIssue(check.error);
                              return edit((d) => void (d.website!.pages[pageIndex]!.sections[i]!.props = check.data.props));
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`vw-${section.id}`}>{t('sections.visibleWhen')}</Label>
                          <Input
                            id={`vw-${section.id}`}
                            key={section.visibleWhen?.exists ?? ''}
                            list="studio-bindings"
                            className="font-mono"
                            defaultValue={section.visibleWhen?.exists ?? ''}
                            onBlur={(e) =>
                              run((d) => {
                                const s = d.website!.pages[pageIndex]!.sections[i]!;
                                const exists = e.target.value.trim();
                                const rest = { ...s.visibleWhen };
                                delete rest.exists;
                                s.visibleWhen = exists ? { ...rest, exists } : Object.keys(rest).length ? rest : undefined;
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </Card>
        );
      })}
      <EditError message={error} />

      <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">{t('sections.bindings')}</summary>
        <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
          {Object.entries(BINDINGS).map(([key, b]) => (
            <div key={key} className="contents">
              <dt className="font-mono text-xs text-brand-700">{key}</dt>
              <dd className="text-xs text-stone-600">{b.description}</dd>
            </div>
          ))}
          {definition.capabilities.textSlots.map((slot) => (
            <div key={slot.key} className="contents">
              <dt className="font-mono text-xs text-brand-700">custom.{slot.key}</dt>
              <dd className="text-xs text-stone-600">{slot.label}</dd>
            </div>
          ))}
        </dl>
      </details>
      <datalist id="studio-bindings">
        {Object.keys(BINDINGS).map((k) => (
          <option key={k} value={k} />
        ))}
        {definition.capabilities.textSlots.map((slot) => (
          <option key={slot.key} value={`custom.${slot.key}`} />
        ))}
      </datalist>
    </div>
  );
}

function move<T>(list: T[], index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item!);
}
