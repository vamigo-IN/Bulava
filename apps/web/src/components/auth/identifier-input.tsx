'use client';

import { AtSign, Mail, Phone } from 'lucide-react';
import { forwardRef, type ComponentProps } from 'react';
import { readIdentifier } from '@/lib/identifier';
import { cn } from '@/lib/utils';

/** India's flag, drawn (no emoji): saffron, white with the navy chakra, green. */
export function IndiaFlag({ className = 'h-3.5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true" className={cn('shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]', className)}>
      <rect width="30" height="20" fill="#ffffff" />
      <rect width="30" height="6.67" fill="#ff9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.7" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </svg>
  );
}

/**
 * The one sign-in field: an email or a WhatsApp number, told apart as it is
 * typed. An Indian mobile typed without a country code shows India's flag and
 * +91 in front (the code is added for it); an email shows the mail mark.
 */
export const IdentifierInput = forwardRef<HTMLInputElement, Omit<ComponentProps<'input'>, 'value' | 'onChange'> & { value: string; onChange: (value: string) => void }>(
  ({ value, onChange, className, ...props }, ref) => {
    const read = readIdentifier(value);
    const india = read.kind === 'phone' && read.india;
    return (
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center gap-1.5 text-stone-500">
          {india ? (
            <>
              <IndiaFlag />
              <span className="text-base font-medium text-ink">+91</span>
              <span className="ml-1 h-5 w-px bg-stone-300" />
            </>
          ) : read.kind === 'email' ? (
            <Mail className="size-4.5" />
          ) : read.kind === 'phone' ? (
            <Phone className="size-4.5" />
          ) : (
            <AtSign className="size-4.5" />
          )}
        </span>
        <input
          ref={ref}
          type="text"
          // The email keyboard has @ and the digits are a tap away; a number needs no other keyboard.
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'block min-h-13 w-full rounded-2xl border border-[#e2d2c0] bg-[#f8f2ea] pr-4 text-base text-stone-900 shadow-clay-inset transition-[padding] placeholder:text-stone-400 focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none aria-invalid:border-red-500',
            india ? 'pl-[5.5rem]' : 'pl-11',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
IdentifierInput.displayName = 'IdentifierInput';
