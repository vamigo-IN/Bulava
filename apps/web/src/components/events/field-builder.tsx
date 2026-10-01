'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui/primitives';

export const FIELD_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'SINGLE_CHOICE', 'MULTI_CHOICE'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Shape shared by RSVP questions and registration fields (labels are localized records). */
export interface FieldDraft {
  key: string;
  label: Record<string, string>;
  type: FieldType;
  options: Array<{ value: string; label: Record<string, string> }>;
  required: boolean;
  functionId?: string | null;
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,47}$/;

export function toKey(text: string, fallback: string): string {
  const key = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 48);
  return KEY_PATTERN.test(key) ? key : fallback;
}

export function emptyField(existingKeys: string[]): FieldDraft {
  let n = existingKeys.length + 1;
  while (existingKeys.includes(`question_${n}`)) n += 1;
  return { key: `question_${n}`, label: { en: '' }, type: 'TEXT', options: [], required: false, functionId: null };
}

/** Choices are edited as one line each; values are derived from the text. */
function optionsFromText(text: string): FieldDraft['options'] {
  const seen = new Set<string>();
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((line, i) => {
      let value = toKey(line, `option_${i + 1}`).slice(0, 60);
      while (seen.has(value)) value = `${value}_${i + 1}`;
      seen.add(value);
      return { value, label: { en: line.slice(0, 300) } };
    });
}

/** Drop an empty Hindi label so the API's localized-text schema stays clean. */
export function cleanField(d: FieldDraft): FieldDraft {
  const label = Object.fromEntries(Object.entries(d.label).filter(([, v]) => v.trim())) as Record<string, string>;
  return { ...d, label, options: d.type === 'SINGLE_CHOICE' || d.type === 'MULTI_CHOICE' ? d.options : [] };
}

export function FieldEditor({
  value,
  onChange,
  onRemove,
  keyEditable = true,
  functions,
}: {
  value: FieldDraft;
  onChange: (next: FieldDraft) => void;
  onRemove?: () => void;
  keyEditable?: boolean;
  /** When given, the question can be limited to one function (RSVP questions). */
  functions?: Array<{ id: string; name: string }>;
}) {
  const t = useT();
  const [optionsText, setOptionsText] = useState(() => value.options.map((o) => o.label.en ?? o.value).join('\n'));
  const [keyTouched, setKeyTouched] = useState(!keyEditable || !value.key.startsWith('question_'));
  const isChoice = value.type === 'SINGLE_CHOICE' || value.type === 'MULTI_CHOICE';

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('fields.label')}>
          {(p) => (
            <Input
              {...p}
              required
              maxLength={300}
              value={value.label.en ?? ''}
              onChange={(e) => {
                const en = e.target.value;
                onChange({ ...value, label: { ...value.label, en }, ...(keyEditable && !keyTouched ? { key: toKey(en, value.key) } : {}) });
              }}
            />
          )}
        </Field>
        <Field label={t('fields.hindiLabel')}>
          {(p) => <Input {...p} lang="hi" maxLength={300} value={value.label.hi ?? ''} onChange={(e) => onChange({ ...value, label: { ...value.label, hi: e.target.value } })} />}
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('fields.type')}>
          {(p) => (
            <Select {...p} value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as FieldType, options: optionsFromText(optionsText) })}>
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`fields.type.${type}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('fields.key')} hint={keyEditable ? t('fields.keyHint') : undefined}>
          {(p) => (
            <Input
              {...p}
              className="font-mono text-sm"
              disabled={!keyEditable}
              pattern="[a-z][a-z0-9_]{0,47}"
              value={value.key}
              onChange={(e) => {
                setKeyTouched(true);
                onChange({ ...value, key: e.target.value.toLowerCase() });
              }}
            />
          )}
        </Field>
        {functions ? (
          <Field label={t('fields.function')}>
            {(p) => (
              <Select {...p} value={value.functionId ?? ''} onChange={(e) => onChange({ ...value, functionId: e.target.value || null })}>
                <option value="">{t('fields.allFunctions')}</option>
                {functions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </div>
      {isChoice ? (
        <Field label={t('fields.options')} hint={t('fields.optionsHint')}>
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              value={optionsText}
              onChange={(e) => {
                setOptionsText(e.target.value);
                onChange({ ...value, options: optionsFromText(e.target.value) });
              }}
            />
          )}
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Checkbox label={t('fields.required')} checked={value.required} onChange={(e) => onChange({ ...value, required: e.target.checked })} />
        {onRemove ? (
          <Button variant="danger" size="sm" onClick={onRemove}>
            {t('fields.remove')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
