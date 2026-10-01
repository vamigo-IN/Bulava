'use client';

import { useState } from 'react';
import { TemplateDefinitionSchema, type TemplateDefinition } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, Button } from '../ui';

/** The whole definition as JSON. Applying replaces the working draft (not saved until "Save draft"). */
export function JsonTab({ value, onApply }: { value: unknown; onApply: (definition: TemplateDefinition) => void }) {
  const original = JSON.stringify(value, null, 2);
  const [text, setText] = useState(original);
  const [issues, setIssues] = useState<string[]>([]);

  function apply() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setIssues([t('json.invalid', { message: (e as Error).message })]);
      return;
    }
    const result = TemplateDefinitionSchema.safeParse(parsed);
    if (!result.success) {
      setIssues(result.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
      return;
    }
    setIssues([]);
    onApply(result.data);
    setText(JSON.stringify(result.data, null, 2));
  }

  function format() {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setIssues([]);
    } catch (e) {
      setIssues([t('json.invalid', { message: (e as Error).message })]);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">{t('json.hint')}</p>
      {issues.length ? (
        <Alert>
          <ul className="list-disc space-y-0.5 pl-4 font-mono text-xs">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <textarea
        aria-label={t('studio.tab.json')}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={cn('code-area block h-[62vh] w-full rounded-lg border bg-stone-950 p-4 text-stone-100 focus:ring-2 focus:ring-brand-200 focus:outline-none', issues.length ? 'border-red-500' : 'border-stone-700')}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={format}>
          {t('json.format')}
        </Button>
        <Button onClick={apply} disabled={text === original}>
          {t('json.apply')}
        </Button>
      </div>
    </div>
  );
}
