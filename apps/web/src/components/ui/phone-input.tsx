'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';
import { useOptionalT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Input } from './primitives';

/** Calling codes offered beside the number: India first (the default), then where Indian families most often live. */
export const CALLING_CODES = [
  { code: '+91', country: 'India' },
  { code: '+971', country: 'UAE' },
  { code: '+1', country: 'USA / Canada' },
  { code: '+44', country: 'United Kingdom' },
  { code: '+61', country: 'Australia' },
  { code: '+65', country: 'Singapore' },
  { code: '+64', country: 'New Zealand' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+974', country: 'Qatar' },
  { code: '+965', country: 'Kuwait' },
  { code: '+968', country: 'Oman' },
  { code: '+973', country: 'Bahrain' },
  { code: '+60', country: 'Malaysia' },
  { code: '+977', country: 'Nepal' },
  { code: '+880', country: 'Bangladesh' },
  { code: '+94', country: 'Sri Lanka' },
  { code: '+49', country: 'Germany' },
  { code: '+33', country: 'France' },
  { code: '+31', country: 'Netherlands' },
  { code: '+353', country: 'Ireland' },
  { code: '+27', country: 'South Africa' },
  { code: '+254', country: 'Kenya' },
] as const;

const DEFAULT_CODE = '+91';
// Longest first, so +971 is matched before a shorter code it starts with.
const BY_LENGTH = [...CALLING_CODES].sort((a, b) => b.code.length - a.code.length);

/**
 * A number as a calling code and its national part ("+91 98765 43210" → +91,
 * "98765 43210"). The national part is kept as typed when the value is what
 * this field reports ("<code> <number>"); without a +, the default code.
 */
export function splitPhone(value: string, fallbackCode = DEFAULT_CODE): { code: string; national: string } {
  const v = value.replace(/^\s+/, '');
  if (!v.startsWith('+')) return { code: fallbackCode, national: v };
  const compact = `+${v.slice(1).replace(/\D/g, '')}`;
  const match = BY_LENGTH.find((c) => compact.startsWith(c.code));
  if (!match) return { code: fallbackCode, national: v };
  if (v.startsWith(`${match.code} `)) return { code: match.code, national: v.slice(match.code.length + 1) };
  return { code: match.code, national: compact.slice(match.code.length) };
}

/** What the field reports: the number with its calling code (a trunk 0 dropped), or '' while no number is typed. */
export function joinPhone(code: string, national: string): string {
  const number = national.replace(/^[\s0]+/, '');
  return number.trim() ? `${code} ${number}` : '';
}

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * A phone number with its calling code: +91 (India) unless the person picks
 * another or types one. Reports "+91 98765 43210"; the API normalises it to
 * E.164 (normalizePhone).
 */
export function PhoneInput({ value, onChange, className, disabled, ...rest }: PhoneInputProps) {
  const t = useOptionalT();
  // The code is kept separately so choosing one before typing the number sticks.
  const [chosen, setChosen] = useState(() => splitPhone(value).code);
  const { code, national } = value.trim() ? splitPhone(value, chosen) : { code: chosen, national: '' };

  return (
    <div className={cn('flex min-w-0 items-stretch gap-2', className)}>
      <span className="relative inline-flex shrink-0 items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-200">
        <span aria-hidden>{code}</span>
        <ChevronDown aria-hidden className="size-3.5 text-stone-500" />
        <select
          aria-label={t('phone.countryCode')}
          value={code}
          disabled={disabled}
          onChange={(e) => {
            setChosen(e.target.value);
            onChange(joinPhone(e.target.value, national));
          }}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        >
          {CALLING_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} {c.country}
            </option>
          ))}
        </select>
      </span>
      <Input
        {...rest}
        disabled={disabled}
        type="tel"
        inputMode="tel"
        autoComplete={rest.autoComplete ?? 'tel-national'}
        className="min-w-0 flex-1"
        value={national}
        onChange={(e) => {
          const typed = e.target.value;
          // A pasted international number switches the code.
          if (typed.trim().startsWith('+')) {
            const split = splitPhone(typed, code);
            setChosen(split.code);
            onChange(joinPhone(split.code, split.national));
            return;
          }
          onChange(joinPhone(code, typed));
        }}
      />
    </div>
  );
}
