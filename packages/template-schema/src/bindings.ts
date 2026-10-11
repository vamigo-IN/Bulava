import {
  formatEventDate,
  formatEventDateShort,
  formatEventDateWithWeekday,
  formatEventTime,
  type MessageKey,
  type Translator,
} from '@bulava/localization';
import type { RenderContext } from './context';
import type { Value } from './definition';

export type BindingType = 'text' | 'datetime' | 'image' | 'list' | 'url';

/** Every binding a template may use. Unknown bindings fail validation at publish time. */
export const BINDINGS: Record<string, { type: BindingType; description: string }> = {
  'event.title': { type: 'text', description: 'Event title' },
  'event.description': { type: 'text', description: 'Event description' },
  'event.startDate': { type: 'datetime', description: 'First function start' },
  'event.endDate': { type: 'datetime', description: 'Last function end' },
  'couple.partnerOne': { type: 'text', description: 'First partner name (couple events)' },
  'couple.partnerTwo': { type: 'text', description: 'Second partner name (couple events)' },
  'couple.brideName': { type: 'text', description: 'Alias of couple.partnerOne' },
  'couple.groomName': { type: 'text', description: 'Alias of couple.partnerTwo' },
  'honoree.name': { type: 'text', description: 'Person being celebrated (birthday, mundan…)' },
  'function.name': { type: 'text', description: 'Current function name' },
  'function.description': { type: 'text', description: 'Current function description' },
  'function.startsAt': { type: 'datetime', description: 'Current function start' },
  'function.date': { type: 'datetime', description: 'Current function start (format as date)' },
  'function.time': { type: 'datetime', description: 'Current function start (format as time)' },
  'function.venue.name': { type: 'text', description: 'Current function venue' },
  'function.venue.address': { type: 'text', description: 'Current function venue address' },
  'function.venue.city': { type: 'text', description: 'Current function venue city' },
  'functions': { type: 'list', description: 'All functions the viewer may see' },
  'venue.name': { type: 'text', description: 'Main venue name' },
  'venue.address': { type: 'text', description: 'Main venue address' },
  'venue.city': { type: 'text', description: 'Main venue city' },
  'venue.mapUrl': { type: 'url', description: 'Main venue map link' },
  'guest.name': { type: 'text', description: 'Guest name (personalized invitations only)' },
  'gallery.images': { type: 'list', description: 'Approved gallery photos' },
  'photos': { type: 'list', description: 'Customer photos chosen for the template' },
  'photos[0]': { type: 'image', description: 'First customer photo' },
  'photos[1]': { type: 'image', description: 'Second customer photo' },
  'photos[2]': { type: 'image', description: 'Third customer photo' },
  'photo.cover': { type: 'image', description: 'Cover photo placed by the customer' },
  'photo.partnerOne': { type: 'image', description: 'Photo of the first partner / honoree' },
  'photo.partnerTwo': { type: 'image', description: 'Photo of the second partner' },
  'photo.story': { type: 'image', description: 'Photo beside the story' },
  'photo.closing': { type: 'image', description: 'Photo in the closing section' },
  'announcements': { type: 'list', description: 'Published announcements for the viewer' },
  // The first functions the viewer may see, by position: a card's timeline (Mehendi · Sangeet · Wedding).
  ...Object.fromEntries(
    [0, 1, 2, 3].flatMap((n) => [
      [`functions[${n}].name`, { type: 'text' as const, description: `Function ${n + 1}: name` }],
      [`functions[${n}].startsAt`, { type: 'datetime' as const, description: `Function ${n + 1}: start` }],
      [`functions[${n}].date`, { type: 'datetime' as const, description: `Function ${n + 1}: start (format as date)` }],
      [`functions[${n}].time`, { type: 'datetime' as const, description: `Function ${n + 1}: start (format as time)` }],
      [`functions[${n}].venue.name`, { type: 'text' as const, description: `Function ${n + 1}: venue` }],
    ]),
  ),
};

/** custom.<key> bindings are validated against capabilities.textSlots. */
export function isKnownBinding(path: string, textSlotKeys: readonly string[] = []): boolean {
  if (path in BINDINGS) return true;
  const custom = /^custom\.([a-zA-Z0-9]+)$/.exec(path);
  return custom !== null && textSlotKeys.includes(custom[1]!);
}

/** Resolve a dotted path (supports [n] indexes) against the context. */
export function resolveBinding(path: string, ctx: RenderContext): unknown {
  const slot = /^photo\.(\w+)$/.exec(path);
  if (slot) return ctx.photoSlots?.[slot[1] as keyof NonNullable<RenderContext['photoSlots']>]?.url;
  const normalized = path
    .replace('function.date', 'function.startsAt')
    .replace('function.time', 'function.startsAt')
    .replace(/^(functions\[\d+\])\.(date|time)$/, '$1.startsAt');
  const parts = normalized.split('.').flatMap((p) => {
    const m = /^(\w+)\[(\d+)\]$/.exec(p);
    return m ? [m[1]!, Number(m[2])] : [p];
  });
  let current: unknown = ctx;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[part];
  }
  if (path === 'photos[0]' || path === 'photos[1]' || path === 'photos[2]') {
    return (current as { url?: string } | undefined)?.url;
  }
  return current;
}

export interface ResolveOptions {
  t: Translator;
  language: string;
  timeZone: string;
  nativeDigits?: boolean;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function format(value: unknown, fmt: string | undefined, opts: ResolveOptions): unknown {
  if (!fmt || isEmpty(value)) return value;
  const f = { language: opts.language, timeZone: opts.timeZone, nativeDigits: opts.nativeDigits };
  switch (fmt) {
    case 'date':
      return formatEventDate(String(value), f);
    case 'dateWithWeekday':
      return formatEventDateWithWeekday(String(value), f);
    case 'dateShort':
      return formatEventDateShort(String(value), f);
    case 'time':
      return formatEventTime(String(value), f);
    case 'dateTime':
      return `${formatEventDateWithWeekday(String(value), f)} · ${formatEventTime(String(value), f)}`;
    case 'upper':
      return String(value).toLocaleUpperCase(opts.language);
    case 'lower':
      return String(value).toLocaleLowerCase(opts.language);
    case 'initial': {
      // The first letter (a whole code point, so Devanagari and emoji stay intact).
      const first = Array.from(String(value).trim())[0];
      return first ? first.toLocaleUpperCase(opts.language) : undefined;
    }
    default:
      return value;
  }
}

/** Resolve a template Value to a displayable primitive. Returns undefined when empty. */
export function resolveValue(value: Value | undefined, ctx: RenderContext, opts: ResolveOptions): string | number | boolean | undefined {
  if (!value) return undefined;
  if ('literal' in value) return value.literal;
  if ('t' in value) return opts.t(value.t as MessageKey);
  if ('template' in value) {
    let missing = false;
    const out = value.template.replace(/\{\{\s*([\w.[\]]+)\s*(?:\|\s*(\w+))?\s*\}\}/g, (_, path: string, fmt?: string) => {
      const v = format(resolveBinding(path, ctx), fmt, opts);
      if (isEmpty(v)) missing = true;
      return isEmpty(v) ? '' : String(v);
    });
    // A template with an unresolved binding uses its fallback when one is given.
    if (missing && value.fallback) return resolveValue(value.fallback, ctx, opts);
    return out.trim() === '' ? undefined : out;
  }
  const raw = resolveBinding(value.binding, ctx);
  if (isEmpty(raw)) return value.fallback ? resolveValue(value.fallback, ctx, opts) : undefined;
  const formatted = format(raw, value.format, opts);
  if (typeof formatted === 'string' || typeof formatted === 'number' || typeof formatted === 'boolean') return formatted;
  return undefined;
}

/** Collect every binding path referenced by a Value (for validation). */
export function bindingsIn(value: Value | undefined): string[] {
  if (!value) return [];
  if ('binding' in value) return [value.binding, ...bindingsIn(value.fallback)];
  if ('template' in value) {
    return [...[...value.template.matchAll(/\{\{\s*([\w.[\]]+)/g)].map((m) => m[1]!), ...bindingsIn(value.fallback)];
  }
  return [];
}

export function translationKeysIn(value: Value | undefined): string[] {
  if (!value) return [];
  if ('t' in value) return [value.t];
  if ('binding' in value) return translationKeysIn(value.fallback);
  return [];
}
