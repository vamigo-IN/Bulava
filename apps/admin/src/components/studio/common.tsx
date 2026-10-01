'use client';

import { useState } from 'react';
import type { z } from 'zod';
import type { TemplateDefinition } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '../ui';

/** Every Studio tab edits the working draft through this contract. */
export interface EditorProps {
  definition: TemplateDefinition;
  /**
   * Apply a change to a copy of the draft. The result is validated against the
   * template schema; an invalid result is not applied and the message is returned.
   */
  edit: (mutate: (draft: TemplateDefinition) => void) => string | null;
}

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join('.') || 'value'}: ${issue.message}` : t('common.error');
}

/**
 * A JSON textarea for one part of the definition. It only commits parseable,
 * schema-valid values; remount it (key) when the value changes elsewhere.
 */
export function JsonField({
  value,
  onCommit,
  rows = 8,
  label,
  className,
}: {
  value: unknown;
  onCommit: (parsed: unknown) => string | null;
  rows?: number;
  label: string;
  className?: string;
}) {
  const original = JSON.stringify(value ?? {}, null, 2);
  const [text, setText] = useState(original);
  const [error, setError] = useState<string | null>(null);
  const changed = text !== original;

  function apply() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(t('json.invalid', { message: (e as Error).message }));
      return;
    }
    setError(onCommit(parsed));
  }

  return (
    <div className={className}>
      <textarea
        aria-label={label}
        spellCheck={false}
        rows={rows}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onBlur={() => changed && apply()}
        aria-invalid={error ? true : undefined}
        className={cn(
          'code-area block w-full rounded-lg border bg-stone-950 p-3 text-stone-100 focus:ring-2 focus:ring-brand-200 focus:outline-none',
          error ? 'border-red-500' : 'border-stone-700',
        )}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        {error ? <p className="text-xs text-red-700">{error}</p> : <span />}
        {changed ? (
          <Button size="sm" variant="secondary" onClick={apply}>
            {t('json.apply')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Small inline error line used by structured editors. */
export function EditError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
      {message}
    </p>
  );
}
