import { createHmac } from 'node:crypto';

/**
 * The customer's link to their previews (/look/<token>, ADR-076): an HMAC of
 * the request's id and link version, derived from the platform's token key
 * (TOKEN_ENCRYPTION_KEY). The API and the worker rebuild it for messages while
 * the database keeps only its hash (`PreviewRequest.tokenHash`); a new version
 * replaces the link and the old one stops working.
 */
function previewKey(tokenEncryptionKey: string): Buffer {
  return createHmac('sha256', Buffer.from(tokenEncryptionKey, 'base64')).update('bulava/previews/v1').digest();
}

export function previewLookToken(requestId: string, version: number, tokenEncryptionKey: string): string {
  return createHmac('sha256', previewKey(tokenEncryptionKey)).update(`look:${requestId}:${version}`).digest('base64url');
}

/** What a look token looks like (43 characters of base64url): anything else is refused before the database. */
export const PREVIEW_LOOK_TOKEN = /^[A-Za-z0-9_-]{43}$/;
