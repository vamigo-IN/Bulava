import { randomInt } from 'node:crypto';

export { firstName, previewTitle } from '@bulava/database';

const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** A reference people can read out: PV- and six letters and digits (no 0, O, 1 or I). */
export function previewReference(): string {
  return `PV-${Array.from({ length: 6 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join('')}`;
}

/** A customer's number for staff who have not taken the request yet: the country and the last two digits. */
export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 3)}•••••${phone.slice(-2)}` : '•••';
}
