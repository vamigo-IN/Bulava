/**
 * One card per design. Templates that are one design for different occasions
 * (a wedding design and its anniversary version) share a look (`preview.look`,
 * designLook in @bulava/template-schema). A list shows each look once, where
 * its first member stood, as the member `prefer` picks (the version for the
 * occasion asked for), else the first in the list's own order: featured first,
 * then catalog order, which puts a design's main occasion first. Items without
 * a look all show.
 */
export function onePerLook<T>(items: readonly T[], lookOf: (item: T) => string | null | undefined, prefer?: (item: T) => boolean): T[] {
  const pick = new Map<string, T>();
  for (const item of items) {
    const look = lookOf(item);
    if (!look) continue;
    const chosen = pick.get(look);
    if (chosen === undefined || (prefer && !prefer(chosen) && prefer(item))) pick.set(look, item);
  }
  const shown = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const look = lookOf(item);
    if (!look) {
      out.push(item);
    } else if (!shown.has(look)) {
      shown.add(look);
      out.push(pick.get(look)!);
    }
  }
  return out;
}

/** The version whose main occasion is the one asked for (an event type key). */
export const forEvent =
  (event: string | undefined) =>
  (item: { eventTypes: readonly string[] }): boolean =>
    !!event && item.eventTypes[0] === event;
