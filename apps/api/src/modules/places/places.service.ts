import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SettingsStore } from '@bulava/settings';
import { googleMapsPlaceUrl, placesReady, type PlaceAutocompleteInput, type PlaceLocation, type PlaceSuggestion } from '@bulava/validation';
import { AppError } from '../../common/errors/app-error';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SETTINGS_STORE } from '../settings/settings.service';
import { consentTarget, coordinatesFrom, findLink, isGoogleMapsUrl, isShortLink, placeTextFrom, shareableLink, type Coordinates } from './map-links';

/** Google's Places API (New); tests point it at a stand-in. */
const PLACES_BASE = 'https://places.googleapis.com';
const TIMEOUT_MS = 8_000;
/** Searches stay fresh for a few minutes: many hosts type the same few venues ("taj", "itc"). */
const SEARCH_CACHE_SEC = 600;
/** One account's share of the day's budget, so a single host (or a script) cannot use up venue search for everyone. */
const PER_ACCOUNT_DAILY = 500;
/** Short links are followed this many times at most (maps.app.goo.gl → Google Maps, sometimes via goo.gl). */
const MAX_HOPS = 4;
/** The longest redirect address read; nothing else of the response is ever read. */
const MAX_LOCATION = 4_000;

/** Suggestions in India first: the country's box biases results (a destination wedding abroad still shows when typed). */
const INDIA_BIAS = { rectangle: { low: { latitude: 6.5, longitude: 68.1 }, high: { latitude: 35.7, longitude: 97.4 } } };
const LANGUAGE = 'en';
const REGION = 'in';

/** What a search returns (Autocomplete is billed per request; the mask only trims the answer). */
const SUGGESTION_FIELDS = 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat';
/** Place Details fields: all on the Essentials tier (no name, which is the host's own and costs more). */
const DETAIL_FIELDS = 'id,formattedAddress,addressComponents,location';

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

/** The street part of a formatted address: the city, district, state, PIN code and country have their own fields. */
export function streetPart(formatted: string, regional: Array<string | null>): string | null {
  const names = new Set(regional.filter((r): r is string => Boolean(r)).map((r) => r.toLowerCase()));
  // Postal codes as Google wrote them ("175-0082"), and the usual digit shapes ("302005", "302 005", "90815").
  const codes = [...names].filter((n) => /\d/.test(n));
  const parts = formatted.split(',').map((p) => p.trim()).filter(Boolean);
  const isRegional = (part: string) => {
    let words = part.toLowerCase();
    for (const code of codes) words = words.replace(code, '');
    words = words.replace(/\b\d{3}\s?\d{3}\b|\b\d{5,6}\b/g, '').replace(/\s+/g, ' ').trim();
    return words === '' || names.has(words);
  };
  while (parts.length && isRegional(parts.at(-1)!)) parts.pop();
  const street = parts.join(', ');
  return street ? street.slice(0, 500) : null;
}

/** A Place Details answer as a venue's address and location. */
export function toPlaceLocation(placeId: string | null, body: Record<string, unknown>): PlaceLocation | null {
  const location = obj(body.location);
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const components: AddressComponent[] = (Array.isArray(body.addressComponents) ? body.addressComponents : []).map((c) => {
    const o = obj(c);
    return { longText: str(o.longText), shortText: str(o.shortText), types: Array.isArray(o.types) ? o.types.filter((t): t is string => typeof t === 'string') : [] };
  });
  const long = (...types: string[]) => {
    for (const type of types) {
      const found = components.find((c) => c.types.includes(type) && c.longText);
      if (found) return found.longText.slice(0, 120);
    }
    return null;
  };
  const city = long('locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2');
  const state = long('administrative_area_level_1');
  const country = components.find((c) => c.types.includes('country'));
  const postalCode = long('postal_code')?.slice(0, 20) ?? null;
  const countryCode = /^[A-Za-z]{2}$/.test(country?.shortText ?? '') ? country!.shortText.toUpperCase() : null;
  const stateShort = components.find((c) => c.types.includes('administrative_area_level_1'))?.shortText ?? null;
  // Formatted addresses name some countries their own way ("USA", "UK").
  const countryAlias = countryCode === 'US' ? 'USA' : countryCode === 'GB' ? 'UK' : null;
  const regional = [city, state, stateShort, postalCode, country?.longText ?? null, countryCode, countryAlias, long('administrative_area_level_2'), long('administrative_area_level_3')];
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  const id = placeId ?? (str(body.id) || null);
  return {
    placeId: id,
    address: streetPart(str(body.formattedAddress), regional),
    city,
    state,
    postalCode,
    country: countryCode,
    latitude: round(latitude),
    longitude: round(longitude),
    mapUrl: googleMapsPlaceUrl(round(latitude), round(longitude), id),
  };
}

/**
 * Venues for the dashboard (ADR-072). Venue search asks Google's Places API
 * (New) with the platform's server key (Integrations → Google Maps, never sent
 * to browsers): suggestions as the host types, India first, then the chosen
 * place's address and location. Searches carry the browser's session token,
 * so a search that ends in a chosen place is billed as one session; they are
 * cached for a few minutes and kept within a daily budget (the site's, and
 * each account's share). A pasted Google Maps link is read for its spot,
 * following short links only to Google's own addresses.
 */
@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
    private readonly redis: RedisService,
  ) {}

  private base(): string {
    return (process.env.GOOGLE_PLACES_API_BASE || PLACES_BASE).replace(/\/$/, '');
  }

  private async config(): Promise<{ key: string | null; embedKey: string | null; dailyLimit: number }> {
    const s = await this.store.get('maps');
    return {
      key: placesReady(s.value, s.secrets) ? (s.secrets.placesApiKey ?? null) : null,
      embedKey: s.value.enabled ? (s.value.embedKey ?? null) : null,
      dailyLimit: s.value.placesDailyLimit,
    };
  }

  /** What the venue field may offer: search, and the public embed key for the map that confirms a spot. Never the server key. */
  async status(): Promise<{ search: boolean; embedKey: string | null }> {
    const c = await this.config();
    return { search: Boolean(c.key), embedKey: c.embedKey };
  }

  private unavailable(message = 'Venue search is not available right now.') {
    return new AppError('PLACES_UNAVAILABLE', message);
  }

  /** One Places call within today's budget (UTC days): the site's limit, and this account's share of it. */
  private async spend(dailyLimit: number, userId: string): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);
    const count = async (key: string) => {
      const used = await this.redis.client.incr(key);
      if (used === 1) await this.redis.client.expire(key, 26 * 3600);
      return used;
    };
    if ((await count(`bulava:places:budget:${day}`)) > dailyLimit) throw this.unavailable('Venue search is resting until tomorrow. Type the address yourself for now.');
    if ((await count(`bulava:places:user:${userId}:${day}`)) > PER_ACCOUNT_DAILY) throw this.unavailable('You have searched a lot today. Type the address yourself for now.');
  }

  private async call(key: string, method: 'GET' | 'POST', path: string, fieldMask: string, body?: object): Promise<{ status: number; body: Record<string, unknown> }> {
    let res: Response;
    try {
      res = await fetch(`${this.base()}${path}`, {
        method,
        headers: { 'x-goog-api-key': key, 'x-goog-fieldmask': fieldMask, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'error',
      });
    } catch (error) {
      this.logger.warn({ path: path.split('?')[0], err: error instanceof Error ? error.message : String(error) }, 'Places API did not answer');
      throw this.unavailable();
    }
    return { status: res.status, body: obj(await res.json().catch(() => ({}))) };
  }

  /** Google refused or failed: logged for the Super Admin (never the key), and the host types the address instead. */
  private failed(what: string, status: number, body: Record<string, unknown>): AppError {
    const error = obj(body.error);
    this.logger.warn({ what, status, reason: str(error.status) || undefined, message: str(error.message).slice(0, 300) || undefined }, 'Places API refused');
    return this.unavailable();
  }

  async autocomplete(input: PlaceAutocompleteInput, userId: string): Promise<{ suggestions: PlaceSuggestion[] }> {
    const c = await this.config();
    if (!c.key) throw this.unavailable();
    const q = input.q.normalize('NFKC').replace(/\s+/g, ' ').trim();
    const cacheKey = `bulava:places:search:v1:${createHash('sha256').update(`${LANGUAGE}\n${REGION}\n${q.toLowerCase()}`).digest('hex').slice(0, 32)}`;
    const hit = await this.redis.client.get(cacheKey);
    if (hit) return { suggestions: JSON.parse(hit) as PlaceSuggestion[] };
    await this.spend(c.dailyLimit, userId);
    const { status, body } = await this.call(c.key, 'POST', '/v1/places:autocomplete', SUGGESTION_FIELDS, {
      input: q,
      ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
      languageCode: LANGUAGE,
      regionCode: REGION,
      locationBias: INDIA_BIAS,
      includeQueryPredictions: false,
    });
    if (status !== 200) throw this.failed('autocomplete', status, body);
    const suggestions = (Array.isArray(body.suggestions) ? body.suggestions : []).flatMap((s): PlaceSuggestion[] => {
      const p = obj(obj(s).placePrediction);
      const placeId = str(p.placeId);
      const format = obj(p.structuredFormat);
      const name = str(obj(format.mainText).text) || str(obj(p.text).text);
      if (!/^[A-Za-z0-9_-]{10,512}$/.test(placeId) || !name) return [];
      return [{ placeId, name: name.slice(0, 160), description: str(obj(format.secondaryText).text).slice(0, 300) }];
    });
    await this.redis.client.set(cacheKey, JSON.stringify(suggestions.slice(0, 5)), 'EX', SEARCH_CACHE_SEC);
    return { suggestions: suggestions.slice(0, 5) };
  }

  /**
   * The chosen place's address and location. Never cached: this call closes
   * the browser's search session, which is what makes the searches before it
   * free of charge.
   */
  async details(placeId: string, sessionToken: string | undefined, userId: string): Promise<PlaceLocation> {
    const c = await this.config();
    if (!c.key) throw this.unavailable();
    return this.lookUp(c.key, c.dailyLimit, placeId, sessionToken, userId);
  }

  private async lookUp(key: string, dailyLimit: number, placeId: string, sessionToken: string | undefined, userId: string): Promise<PlaceLocation> {
    await this.spend(dailyLimit, userId);
    const params = new URLSearchParams({ languageCode: LANGUAGE, regionCode: REGION, ...(sessionToken ? { sessionToken } : {}) });
    const { status, body } = await this.call(key, 'GET', `/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`, DETAIL_FIELDS);
    // An ID Google no longer knows (places close and merge) or never issued.
    if (status === 404 || status === 400) throw AppError.notFound('Place');
    if (status !== 200) throw this.failed('details', status, body);
    const place = toPlaceLocation(placeId, body);
    if (!place) throw AppError.notFound('Place');
    return place;
  }

  /** A place named in a Maps link (the app's Share of a place): found by its name and address, then looked up. */
  private async findPlace(text: string, userId: string): Promise<PlaceLocation | null> {
    const c = await this.config();
    if (!c.key) return null;
    await this.spend(c.dailyLimit, userId);
    // Only the id: Text Search's cheapest tier.
    const { status, body } = await this.call(c.key, 'POST', '/v1/places:searchText', 'places.id', { textQuery: text, pageSize: 1, languageCode: LANGUAGE, regionCode: REGION });
    if (status !== 200) throw this.failed('text search', status, body);
    const first = obj((Array.isArray(body.places) ? body.places : [])[0]);
    const id = str(first.id);
    if (!/^[A-Za-z0-9_-]{10,512}$/.test(id)) return null;
    return this.lookUp(c.key, c.dailyLimit, id, undefined, userId);
  }

  /**
   * The spot of a Google Maps link the host pasted (a dropped pin, usually):
   * short links are followed, by their redirect address only, while it stays
   * on Google's own addresses; the spot is read from the address. A shared
   * place without a spot in its address is found by the name and address in
   * it, when venue search is on. The pasted link becomes the venue's mapUrl.
   */
  async resolveLink(text: string, userId: string): Promise<{ latitude: number; longitude: number; mapUrl: string; place: PlaceLocation | null }> {
    const pasted = findLink(text);
    if (!pasted || !(isShortLink(pasted) || isGoogleMapsUrl(pasted))) throw new AppError('MAP_LINK_INVALID', 'Paste a link from Google Maps.');
    let url = pasted;
    for (let hop = 0; isShortLink(url) || url.hostname === 'consent.google.com'; hop++) {
      if (hop >= MAX_HOPS) throw new AppError('MAP_LINK_UNREADABLE', 'This link goes round in circles.');
      const next = url.hostname === 'consent.google.com' ? consentTarget(url) : await this.follow(url);
      if (!next) throw new AppError('MAP_LINK_UNREADABLE', 'This link does not show where the venue is.');
      url = next;
    }
    if (!isGoogleMapsUrl(url)) throw new AppError('MAP_LINK_INVALID', 'This link does not lead to Google Maps.');

    let spot: Coordinates | null = coordinatesFrom(url);
    let place: PlaceLocation | null = null;
    if (!spot) {
      const named = placeTextFrom(url);
      // Not found, search off or Google busy: a dropped pin's link always works, and the answer below says how to get one.
      place = named ? await this.findPlace(named, userId).catch(() => null) : null;
      if (place) spot = { latitude: place.latitude, longitude: place.longitude };
    }
    if (!spot) throw new AppError('MAP_LINK_UNREADABLE', 'This link does not show where the venue is.');
    return { ...spot, mapUrl: shareableLink(pasted) ?? googleMapsPlaceUrl(spot.latitude, spot.longitude, place?.placeId), place };
  }

  /**
   * Where a short link leads: its redirect address alone. The response itself
   * is never read; the address must be Google's.
   */
  private async follow(url: URL): Promise<URL> {
    // Tests and staging answer Google's links from a stand-in (GOOGLE_MAPS_LINKS_BASE): <base>/<host><path>.
    const standin = process.env.GOOGLE_MAPS_LINKS_BASE?.replace(/\/$/, '');
    const target = standin ? `${standin}/${url.host}${url.pathname}${url.search}` : url.toString();
    let res: Response;
    try {
      res = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'text/html' } });
    } catch {
      throw new AppError('SERVICE_UNAVAILABLE', 'Google Maps did not answer. Please try again.');
    }
    await res.body?.cancel().catch(() => undefined);
    const location = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !location || location.length > MAX_LOCATION) {
      throw new AppError('MAP_LINK_UNREADABLE', 'This link has expired or does not show a place.');
    }
    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      throw new AppError('MAP_LINK_UNREADABLE', 'This link does not show where the venue is.');
    }
    if (!(isShortLink(next) || isGoogleMapsUrl(next) || (next.protocol === 'https:' && next.hostname === 'consent.google.com'))) {
      throw new AppError('MAP_LINK_INVALID', 'This link does not lead to Google Maps.');
    }
    return next;
  }
}
