import type { Customization } from '@bulava/template-schema';

/**
 * Designs kept on this device. Nothing here reaches the server until the host
 * saves it to an event (the design page or the video page sends it).
 *
 * - Film drafts: an event's film design until (and after) the video is made,
 *   so canvas work survives a refresh.
 * - Design-page drafts (ADR-063): a website or film designed before signing
 *   in, carried to the event the host creates when they publish.
 *
 * Private windows and full storage throw: the design then stays for the visit.
 */

const filmKey = (eventId: string, templateKey: string) => `bulava.film.${eventId}.${templateKey}`;

export function readFilmDraft(eventId: string, templateKey: string): Customization | null {
  try {
    const raw = localStorage.getItem(filmKey(eventId, templateKey));
    return raw ? (JSON.parse(raw) as Customization) : null;
  } catch {
    return null;
  }
}

export function writeFilmDraft(eventId: string, templateKey: string, custom: Customization): void {
  try {
    if (Object.keys(custom).length) localStorage.setItem(filmKey(eventId, templateKey), JSON.stringify(custom));
    else localStorage.removeItem(filmKey(eventId, templateKey));
  } catch {
    // Kept for this visit only.
  }
}

export type StudioKind = 'website' | 'video';

export interface StudioDraft {
  templateKey: string;
  /** The occasion it was designed for (an event type key): the event it goes to starts as one. */
  eventType: string;
  custom: Customization;
  savedAt: string;
}

const studioKey = (kind: StudioKind, templateKey: string) => `bulava.design.${kind}.${templateKey}`;

export function readStudioDraft(kind: StudioKind, templateKey: string): StudioDraft | null {
  try {
    const raw = localStorage.getItem(studioKey(kind, templateKey));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<StudioDraft>;
    if (draft.templateKey !== templateKey || typeof draft.custom !== 'object' || draft.custom === null || Array.isArray(draft.custom)) return null;
    return { templateKey, eventType: typeof draft.eventType === 'string' ? draft.eventType : 'WEDDING', custom: draft.custom, savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : '' };
  } catch {
    return null;
  }
}

export function writeStudioDraft(kind: StudioKind, draft: Omit<StudioDraft, 'savedAt'>): void {
  try {
    localStorage.setItem(studioKey(kind, draft.templateKey), JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    // Kept for this visit only.
  }
}

export function clearStudioDraft(kind: StudioKind, templateKey: string): void {
  try {
    localStorage.removeItem(studioKey(kind, templateKey));
  } catch {
    // Nothing to clear.
  }
}
