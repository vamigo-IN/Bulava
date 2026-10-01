import { apiGet, apiPost } from '@/lib/api';
import type { MediaItem } from '@/lib/types';

interface Ticket {
  itemId: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

/**
 * Upload a photo straight from the design panel: a signed PUT to storage, then
 * the server verifies it and the media worker processes it (EXIF removed,
 * renditions made). Resolves once the photo is ready to place.
 */
export async function uploadDesignPhoto(eventId: string, file: File, signal?: AbortSignal): Promise<MediaItem> {
  const ticket = await apiPost<Ticket>(`/events/${eventId}/media/design-uploads`, { contentType: file.type, sizeBytes: file.size });
  const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: file, signal });
  if (!put.ok) throw new Error('upload failed');
  await apiPost(`/events/${eventId}/media/design-uploads/${ticket.itemId}/complete`);
  for (let attempt = 0; attempt < 60; attempt++) {
    if (signal?.aborted) throw new Error('aborted');
    const state = await apiGet<{ status: string; photo?: MediaItem }>(`/events/${eventId}/media/design-uploads/${ticket.itemId}`);
    if (state.status === 'APPROVED' && state.photo) return state.photo;
    if (state.status === 'REJECTED' || state.status === 'DELETED') throw new Error('rejected');
    await new Promise((r) => setTimeout(r, attempt < 10 ? 800 : 1500));
  }
  throw new Error('timeout');
}
