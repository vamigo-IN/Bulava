'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Capabilities } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { Button, Card, CardTitle, Checkbox, Field, Input } from '../ui';
import { EditError, type EditorProps } from './common';

const EDITABLE: Array<keyof Capabilities['editable']> = ['colors', 'fonts', 'music', 'background', 'layout', 'photos', 'text', 'animation'];

export function CapabilitiesTab({ definition, edit }: EditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const caps = definition.capabilities;
  const run = (fn: Parameters<EditorProps['edit']>[0]) => setError(edit(fn));

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>{t('caps.editable')}</CardTitle>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
          {EDITABLE.map((key) => (
            <Checkbox key={key} label={t(`caps.editable.${key}`)} checked={caps.editable[key]} onChange={(e) => run((d) => void (d.capabilities.editable[key] = e.target.checked))} />
          ))}
        </div>
        <Field label={t('caps.maxPhotos')} className="mt-4 max-w-40">
          {(p) => (
            <Input
              {...p}
              key={caps.maxPhotos}
              type="number"
              min={0}
              max={50}
              defaultValue={caps.maxPhotos}
              onBlur={(e) => run((d) => void (d.capabilities.maxPhotos = Math.max(0, Math.min(50, Number(e.target.value) || 0))))}
            />
          )}
        </Field>
      </Card>

      <Card>
        <CardTitle>{t('caps.textSlots')}</CardTitle>
        <div className="space-y-2">
          {caps.textSlots.map((slot, i) => (
            <div key={`${slot.key}-${i}`} className="grid grid-cols-[1fr_1.5fr_90px_auto] items-end gap-2">
              <Field label={i === 0 ? t('caps.slotKey') : ''}>
                {(p) => (
                  <Input
                    {...p}
                    aria-label={t('caps.slotKey')}
                    className="font-mono"
                    defaultValue={slot.key}
                    onBlur={(e) => e.target.value !== slot.key && run((d) => void (d.capabilities.textSlots[i]!.key = e.target.value.trim()))}
                  />
                )}
              </Field>
              <Field label={i === 0 ? t('caps.slotLabel') : ''}>
                {(p) => (
                  <Input
                    {...p}
                    aria-label={t('caps.slotLabel')}
                    defaultValue={slot.label}
                    maxLength={60}
                    onBlur={(e) => e.target.value !== slot.label && run((d) => void (d.capabilities.textSlots[i]!.label = e.target.value))}
                  />
                )}
              </Field>
              <Field label={i === 0 ? t('caps.slotMax') : ''}>
                {(p) => (
                  <Input
                    {...p}
                    aria-label={t('caps.slotMax')}
                    type="number"
                    min={1}
                    max={2000}
                    defaultValue={slot.maxLength}
                    onBlur={(e) => run((d) => void (d.capabilities.textSlots[i]!.maxLength = Number(e.target.value)))}
                  />
                )}
              </Field>
              <Button size="icon" variant="ghost" className="mb-1 text-red-700 hover:bg-red-50" aria-label={t('sections.remove')} onClick={() => run((d) => void d.capabilities.textSlots.splice(i, 1))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          disabled={caps.textSlots.length >= 20}
          onClick={() =>
            run((d) => {
              let n = d.capabilities.textSlots.length + 1;
              while (d.capabilities.textSlots.some((s) => s.key === `text${n}`)) n += 1;
              d.capabilities.textSlots.push({ key: `text${n}`, label: `Text ${n}`, maxLength: 120 });
            })
          }
        >
          <Plus className="size-3.5" /> {t('caps.addSlot')}
        </Button>
      </Card>

      <Card>
        <CardTitle>{t('caps.colorPresets')}</CardTitle>
        <p className="-mt-2 mb-3 text-xs text-stone-500">{t('caps.colorPresetsHint')}</p>
        <ul className="space-y-2">
          {caps.colorPresets.map((preset, i) => (
            <li key={`${preset.name}-${i}`} className="flex items-center gap-3">
              <div className="flex h-7 w-32 overflow-hidden rounded-md border border-stone-200" aria-hidden>
                {Object.values(preset.colors).map((c, j) => (
                  <span key={j} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <span className="flex-1 text-sm">{preset.name}</span>
              <Button size="icon" variant="ghost" className="text-red-700 hover:bg-red-50" aria-label={t('sections.remove')} onClick={() => run((d) => void d.capabilities.colorPresets.splice(i, 1))}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-end gap-2">
          <Field label={t('caps.presetName')} className="flex-1">
            {(p) => <Input {...p} maxLength={40} value={presetName} onChange={(e) => setPresetName(e.target.value)} />}
          </Field>
          <Button
            variant="secondary"
            disabled={!presetName.trim() || caps.colorPresets.length >= 12}
            onClick={() => {
              const name = presetName.trim();
              run((d) => void d.capabilities.colorPresets.push({ name, colors: { ...d.theme.colors } }));
              setPresetName('');
            }}
          >
            <Plus className="size-4" /> {t('caps.addPreset')}
          </Button>
        </div>
      </Card>
      <EditError message={error} />
    </div>
  );
}
