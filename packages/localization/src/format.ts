import { getLanguage } from './languages';

export interface FormatOptions {
  /** Event language code, e.g. 'hi'. */
  language: string;
  /** IANA time zone of the event, e.g. 'Asia/Kolkata'. */
  timeZone: string;
  /** Use the script's native digits (१५ vs 15). Default false. */
  nativeDigits?: boolean;
  /** 12 or 24 hour clock. Default 12 (common in India). */
  hourCycle?: 12 | 24;
}

function localeFor(options: FormatOptions): string {
  const lang = getLanguage(options.language);
  const base = lang.intlLocale;
  if (options.nativeDigits && lang.nativeNumberingSystem) {
    return `${base}-u-nu-${lang.nativeNumberingSystem}`;
  }
  return `${base}-u-nu-latn`;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. "15 December 2026", "१५ दिसंबर २०२६", "15 दिसंबर 2026" */
export function formatEventDate(value: Date | string, options: FormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(options), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: options.timeZone,
  }).format(toDate(value));
}

/** e.g. "15 Dec", "15 दिस॰": the day and month alone, for timelines and other tight spaces. */
export function formatEventDateShort(value: Date | string, options: FormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(options), {
    day: 'numeric',
    month: 'short',
    timeZone: options.timeZone,
  }).format(toDate(value));
}

/** e.g. "Tuesday, 15 December 2026" */
export function formatEventDateWithWeekday(value: Date | string, options: FormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(options), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: options.timeZone,
  }).format(toDate(value));
}

/** e.g. "7:30 pm" / "19:30" */
export function formatEventTime(value: Date | string, options: FormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(options), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: (options.hourCycle ?? 12) === 12,
    timeZone: options.timeZone,
  }).format(toDate(value));
}

export function formatNumber(value: number, options: Pick<FormatOptions, 'language' | 'nativeDigits'>): string {
  return new Intl.NumberFormat(localeFor({ ...options, timeZone: 'UTC' })).format(value);
}

// ───── Wall-clock <-> UTC conversion in an IANA time zone ─────
// Hosts enter "15 Dec 2026, 7:30 pm" meaning the event's local time; we store UTC.

function partsInZone(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const out: Record<string, number> = {};
  for (const p of parts) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}

/** Offset of `timeZone` from UTC at `date`, in minutes (IST = +330). */
export function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/**
 * "2026-12-15T19:30" in Asia/Kolkata -> "2026-12-15T14:00:00.000Z".
 * Accepts the value of an <input type="datetime-local">.
 */
export function zonedWallTimeToUtcIso(wallTime: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(wallTime);
  if (!m) throw new Error(`Invalid wall time: ${wallTime}`);
  const [, y, mo, d, h, mi, s] = m;
  const naiveUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  // Two passes handle DST transitions correctly for zones that have them.
  let offset = timeZoneOffsetMinutes(new Date(naiveUtc), timeZone);
  let utc = naiveUtc - offset * 60_000;
  const offset2 = timeZoneOffsetMinutes(new Date(utc), timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    utc = naiveUtc - offset * 60_000;
  }
  return new Date(utc).toISOString();
}

/** Inverse of zonedWallTimeToUtcIso, for pre-filling datetime-local inputs. */
export function utcToZonedWallTime(value: Date | string, timeZone: string): string {
  const p = partsInZone(value instanceof Date ? value : new Date(value), timeZone);
  const pad = (n: number | undefined) => String(n ?? 0).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
