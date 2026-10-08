'use client';

import { Check, Globe2, Link2, MailCheck, TimerOff, UsersRound, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { useT } from '@/lib/i18n';
import type { AccessMode } from '@/lib/types';
import { cn } from '@/lib/utils';

/** The access modes in the order hosts should consider them: one private link first. */
export const ACCESS_OPTIONS: ReadonlyArray<{ mode: AccessMode; icon: LucideIcon }> = [
  { mode: 'PRIVATE_LINK', icon: Link2 },
  { mode: 'INVITE_ONLY', icon: MailCheck },
  { mode: 'GROUP_RESTRICTED', icon: UsersRound },
  { mode: 'SECRET_TOKEN', icon: TimerOff },
  { mode: 'PUBLIC', icon: Globe2 },
];

/**
 * "Who can open the invitation", as cards that say what each choice means.
 * Real radio inputs (visually hidden), so the keyboard and screen readers work
 * as in any form.
 */
export function AccessOptions({ value, onChange, disabled = false, columns = 2 }: { value: AccessMode; onChange: (mode: AccessMode) => void; disabled?: boolean; columns?: 1 | 2 }) {
  const t = useT();
  const name = useId();
  return (
    <div role="radiogroup" aria-label={t('event.field.accessMode')} className={cn('grid gap-2.5', columns === 2 && 'sm:grid-cols-2')}>
      {ACCESS_OPTIONS.map(({ mode, icon: Icon }) => {
        const checked = value === mode;
        return (
          <label
            key={mode}
            className={cn(
              'relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow] duration-200 has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-brand-100',
              checked ? 'border-brand-600 bg-white shadow-clay-sm' : 'border-gold-200 bg-white/60 hover:border-gold-300 hover:bg-white',
              disabled && 'pointer-events-none opacity-60',
            )}
          >
            <input type="radio" name={name} value={mode} checked={checked} onChange={() => onChange(mode)} disabled={disabled} className="sr-only" />
            <span aria-hidden className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition-colors', checked ? 'icon-3d' : 'bg-sand text-stone-600')}>
              <Icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                {t(`access.short.${mode}`)}
                {mode === 'PRIVATE_LINK' ? <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-gold-700">{t('access.recommended')}</span> : null}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-stone-600">{t(`access.desc.${mode}`)}</span>
            </span>
            <span aria-hidden className={cn('grid size-5 shrink-0 place-items-center rounded-full border transition-colors', checked ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-white')}>
              {checked ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
