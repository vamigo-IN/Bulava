/**
 * Google Maps links a host pastes for a venue (ADR-072): which links are
 * Google's, the spot a link shows, and the link kept for guests' directions.
 * Pure functions; PlacesService follows the short links.
 *
 * Only addresses are read, never pages: a Maps page fetched by a server shows
 * the map around the server's own location until its scripts run, so its
 * coordinates would be wrong without saying so.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Google's sites for Maps pages: google.com and the country sites hosts and their guests use most (with www. or maps.). */
const MAPS_DOMAINS = new Set(['google.com', 'google.co.in', 'google.ae', 'google.co.uk', 'google.ca', 'google.com.au', 'google.com.sg', 'google.co.nz', 'google.com.my']);

/** Query parameters that only track the share (who, when, from which app); the link works without them. */
const TRACKING = ['g_ep', 'g_st', 'skid', 'entry', 'utm_source', 'utm_medium', 'utm_campaign', 'coh', 'lucs', 'shorturl', 'ved', 'authuser', 'ucbcb'];

/** The longest link kept as a venue's mapUrl (VenueInputSchema allows 1000). */
const MAX_MAP_URL = 1000;

/** A short share link (Share in the Google Maps app or site): maps.app.goo.gl, and older goo.gl/maps links. */
export function isShortLink(url: URL): boolean {
  if (url.protocol !== 'https:' || url.port) return false;
  return (url.hostname === 'maps.app.goo.gl' && url.pathname.length > 1) || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'));
}

/** A Google Maps page: google.com/maps…, maps.google.com…, or the same on a country site. */
export function isGoogleMapsUrl(url: URL): boolean {
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  const bare = host.replace(/^(www|maps)\./, '');
  if (!MAPS_DOMAINS.has(bare)) return false;
  return host.startsWith('maps.') || url.pathname === '/maps' || url.pathname.startsWith('/maps/');
}

/** Google's cookie notice in front of Maps (in some countries): the page it continues to. */
export function consentTarget(url: URL): URL | null {
  if (url.protocol !== 'https:' || url.hostname !== 'consent.google.com') return null;
  const next = parseUrl(url.searchParams.get('continue'));
  return next && (isGoogleMapsUrl(next) || isShortLink(next)) ? next : null;
}

function parseUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * The first link in what the host pasted: the Share sheet often adds the
 * place's name and address before it. Google's links over http are read as
 * https (they redirect there anyway).
 */
export function findLink(text: string): URL | null {
  const match = /https?:\/\/[^\s<>"'`]+/i.exec(text);
  const url = parseUrl(match?.[0].replace(/[),.;!?]+$/, ''));
  if (!url) return null;
  if (url.protocol === 'http:') url.protocol = 'https:';
  return url;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** A real spot: on the globe, and not "0,0" (what a broken link would give). */
function valid(lat: number, lng: number): Coordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { latitude: round(lat), longitude: round(lng) };
}

const PAIR = /^\s*(?:loc:\s*)?(-?\d{1,3}(?:\.\d+)?)\s*,\s*\+?\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const DMS = /(\d{1,2})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]\s*([NS])[\s,]*(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]\s*([EW])/i;

/** "26.898108, 75.808414", or a dropped pin's name in degrees, minutes and seconds (26°53'53.2"N 75°48'30.3"E). */
export function spotFromText(text: string): Coordinates | null {
  const pair = PAIR.exec(text);
  if (pair) return valid(Number(pair[1]), Number(pair[2]));
  const dms = DMS.exec(text);
  if (!dms) return null;
  const deg = (d: string, m: string, s: string, dir: string) => (Number(d) + Number(m) / 60 + Number(s) / 3600) * (/[SW]/i.test(dir) ? -1 : 1);
  return valid(deg(dms[1]!, dms[2]!, dms[3]!, dms[4]!), deg(dms[5]!, dms[6]!, dms[7]!, dms[8]!));
}

/** The address's path, segment by segment, decoded. */
function segments(url: URL): string[] {
  return url.pathname.split('/').map(decode);
}

/**
 * The spot a Google Maps address shows, most precise first: the place's own
 * pin in the data part (`!3d<lat>!4d<lng>`), a pin named in the path
 * (/maps/search/<lat>,<lng>, /maps/place/<pin>), the query (?q=, ?query=,
 * ?ll=, a destination), and only for a plain map view without a place, the
 * view's centre (/maps/@<lat>,<lng>,<zoom>z). A place's address also has
 * that centre, but it can be kilometres from the place, so it is never used
 * for one.
 */
export function coordinatesFrom(url: URL): Coordinates | null {
  const path = decode(url.pathname);
  const pins = [...path.matchAll(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/g)];
  const last = pins.at(-1);
  if (last) {
    const spot = valid(Number(last[1]), Number(last[2]));
    if (spot) return spot;
  }
  const parts = segments(url);
  for (const marker of ['place', 'search']) {
    const at = parts.indexOf(marker);
    const named = at >= 0 ? parts[at + 1] : undefined;
    const spot = named ? spotFromText(named) : null;
    if (spot) return spot;
  }
  const dir = parts.indexOf('dir');
  if (dir >= 0) {
    // Directions: the last stop is the destination.
    const stops = parts.slice(dir + 1).filter((p) => p && !p.startsWith('@') && !p.startsWith('data='));
    const spot = stops.length ? spotFromText(stops.at(-1)!) : null;
    if (spot) return spot;
  }
  for (const key of ['q', 'query', 'll', 'destination', 'daddr', 'center', 'sll']) {
    const value = url.searchParams.get(key);
    const spot = value ? spotFromText(value) : null;
    if (spot) return spot;
  }
  if (!parts.some((p) => p === 'place' || p === 'search' || p === 'dir') && !url.searchParams.has('q') && !url.searchParams.has('query') && !url.searchParams.has('cid')) {
    const view = /\/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:,|$)/.exec(path);
    if (view) return valid(Number(view[1]), Number(view[2]));
  }
  return null;
}

/**
 * The place a Google Maps address names when it has no spot in it: the Maps
 * app's Share gives /maps/place/<name, full address>/data=… with only Google's
 * own feature id. The text is precise enough to find the place by.
 */
export function placeTextFrom(url: URL): string | null {
  const parts = segments(url);
  const at = parts.indexOf('place');
  const candidates = [at >= 0 ? parts[at + 1] : undefined, url.searchParams.get('q') ?? undefined, url.searchParams.get('query') ?? undefined];
  for (const raw of candidates) {
    const text = raw?.replace(/\s+/g, ' ').trim();
    if (text && text.length >= 3 && !text.startsWith('@') && !spotFromText(text)) return text.slice(0, 300);
  }
  return null;
}

/**
 * The link kept for guests: a short link as it is (without the share's
 * tracking), or a Maps address without its tracking parameters; null when
 * that is still too long to keep (the caller then links the spot itself).
 */
export function shareableLink(pasted: URL): string | null {
  const url = new URL(pasted.toString());
  url.hash = '';
  if (isShortLink(url)) return `https://${url.hostname}${url.pathname}`;
  for (const name of TRACKING) url.searchParams.delete(name);
  const link = url.toString();
  return link.length <= MAX_MAP_URL ? link : null;
}
