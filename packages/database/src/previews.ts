import type { Prisma } from '../generated/client';

// The preview desk's words (ADR-076), shared by the API and the worker's messages.

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** What the celebration is called: the couple, the person celebrated, or its title. */
export function previewTitle(request: { details: Prisma.JsonValue; title: string | null }): string {
  const d = (request.details ?? {}) as Record<string, unknown>;
  const one = text(d.partnerOne);
  const two = text(d.partnerTwo);
  if (one && two) return `${one} & ${two}`;
  return text(d.name) ?? one ?? two ?? request.title ?? 'Your celebration';
}

/** A person's first name, for greetings. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0]!.slice(0, 60) || name.slice(0, 60);

const ORDER = ['WEBSITE', 'CARD', 'FILM'] as const;
const WORDS = { WEBSITE: 'invitation website', CARD: 'card', FILM: 'invitation film' } as const;

/** What was made, as the message to the customer says it ("your invitation website and card"). */
export function previewMadeList(kinds: ReadonlyArray<(typeof ORDER)[number]>): string {
  const words = [...new Set(kinds)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).map((k) => WORDS[k]);
  if (!words.length) return 'your preview';
  if (words.length === 1) return `your ${words[0]}`;
  return `your ${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
