import { normalizePhone } from '@bulava/validation';

/** What the one sign-in field holds so far. */
export type Identifier =
  | { kind: 'empty' }
  | { kind: 'email'; email: string; valid: boolean }
  /** `phone`: E.164 once it is a whole number; `india`: shown with India's flag and +91 (typed without a country code). */
  | { kind: 'phone'; phone: string | null; india: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Reads the sign-in field: an email address (it has an @ or a letter) or a
 * WhatsApp number (digits, spaces, dashes, a leading +). A number typed without
 * a country code is Indian when it starts 6–9 (or 0 / 91 then 6–9), so +91 is
 * added; other countries are typed with their + code.
 */
export function readIdentifier(raw: string): Identifier {
  const value = raw.trim();
  if (!value) return { kind: 'empty' };
  if (/[@a-z]/i.test(value)) return { kind: 'email', email: value.toLowerCase(), valid: EMAIL.test(value) };
  const digits = value.replace(/\D/g, '');
  const international = value.startsWith('+');
  return {
    kind: 'phone',
    phone: normalizePhone(value),
    india: !international && /^(0|91)?[6-9]/.test(digits),
  };
}
