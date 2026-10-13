import type { PlaceLocation, PlaceSuggestion } from '@bulava/validation';
import { apiGet, apiPost } from './api';

/**
 * Venue search for the Functions page (ADR-072). The API asks Google with the
 * platform's server key; the browser sees suggestions, the chosen place's
 * address and spot, and the public embed key for the small map, never a key
 * that calls Google's APIs.
 */

export type { PlaceLocation, PlaceSuggestion };

export interface PlacesStatus {
  /** Whether typing a venue shows Google's suggestions. */
  search: boolean;
  /** The public Maps Embed key, for the map that confirms a spot (null while maps are off). */
  embedKey: string | null;
}

export interface MapLinkResult {
  latitude: number;
  longitude: number;
  /** The link kept for guests' directions: the one pasted, without the share's tracking. */
  mapUrl: string;
  /** Filled when the link named a place Google found (the address comes with it). */
  place: PlaceLocation | null;
}

export const placesStatus = (eventId: string) => apiGet<PlacesStatus>(`/events/${eventId}/places/status`);

export const searchPlaces = (eventId: string, q: string, sessionToken: string) =>
  apiGet<{ suggestions: PlaceSuggestion[] }>(`/events/${eventId}/places/autocomplete?${new URLSearchParams({ q, sessionToken }).toString()}`);

export const placeDetails = (eventId: string, placeId: string, sessionToken: string | null) =>
  apiGet<PlaceLocation>(`/events/${eventId}/places/${encodeURIComponent(placeId)}${sessionToken ? `?${new URLSearchParams({ sessionToken }).toString()}` : ''}`);

export const resolveMapLink = (eventId: string, url: string) => apiPost<MapLinkResult>(`/events/${eventId}/places/link`, { url });

/**
 * A search session's token (Google bills a search that ends in a chosen place
 * as one session): a UUID, also where crypto.randomUUID is missing (plain-http
 * addresses on a local network).
 */
export function newSessionToken(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Google Maps, searching for what the host typed: where they drop the pin. */
export function mapsSearchUrl(text: string): string {
  const query = text.trim();
  return query ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query }).toString()}` : 'https://www.google.com/maps';
}

/** The small map that confirms a spot (Maps Embed API, the public key): the Google place itself when known, else the pin. */
export function embedMapUrl(key: string, spot: { latitude: number; longitude: number; placeId: string | null }): string {
  const q = spot.placeId ? `place_id:${spot.placeId}` : `${spot.latitude},${spot.longitude}`;
  return `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key, q, zoom: '16' }).toString()}`;
}
