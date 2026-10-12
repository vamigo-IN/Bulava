import { api, apiGet, apiPost } from './api';
import type { MediaItem } from './types';

/**
 * Stock photos and illustrations in the editors (ADR-064): searched through
 * the API (licensed libraries, the platform's keys) and brought in by the
 * server as the host's own photo. The browser only shows the libraries' small
 * previews; it never hands the server an address to fetch.
 */

export type StockKind = 'photo' | 'illustration';

export interface StockResult {
  id: string;
  provider: 'pexels' | 'pixabay';
  thumb: string;
  width: number;
  height: number;
  alt: string;
  author: string;
  authorUrl: string | null;
  pageUrl: string;
}

export interface StockCredit {
  provider: StockResult['provider'];
  name: string;
  url: string;
}

export interface StockPage {
  results: StockResult[];
  page: number;
  more: boolean;
  credits: StockCredit[];
}

export interface StockStatus {
  photo: boolean;
  illustration: boolean;
  credits: StockCredit[];
}

let status: Promise<StockStatus> | null = null;

/** Whether the editors offer stock images (and which), asked once per visit. */
export function stockStatus(): Promise<StockStatus> {
  status ??= api<StockStatus>('/public/stock/status').catch(() => {
    status = null;
    return { photo: false, illustration: false, credits: [] };
  });
  return status;
}

export const stockQuery = (q: string, kind: StockKind, page: number) => new URLSearchParams({ q, kind, page: String(page) }).toString();

/** A search for an event's editors (the right to edit the event). */
export const searchEventStock = (eventId: string, q: string, kind: StockKind, page: number) => apiGet<StockPage>(`/events/${eventId}/stock?${stockQuery(q, kind, page)}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Brings a result in as one of the event's design photos; resolves once it is processed and ready to place. */
export async function importEventStock(eventId: string, id: string): Promise<MediaItem> {
  const { itemId } = await apiPost<{ itemId: string }>(`/events/${eventId}/stock`, { id });
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await apiGet<{ status: string; photo?: MediaItem }>(`/events/${eventId}/media/design-uploads/${itemId}`);
    if (state.status === 'APPROVED' && state.photo) return state.photo;
    if (state.status === 'REJECTED' || state.status === 'DELETED') throw new Error('rejected');
    await sleep(attempt < 10 ? 800 : 1500);
  }
  throw new Error('timeout');
}
