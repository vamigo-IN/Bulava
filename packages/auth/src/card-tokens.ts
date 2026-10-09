import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Links in the digital card flow (docs/cards.md). Both are derived from the
 * platform's token key (TOKEN_ENCRYPTION_KEY), so the API and the workers
 * agree on them without a secret of their own.
 */
function cardKey(tokenEncryptionKey: string): Buffer {
  return createHmac('sha256', Buffer.from(tokenEncryptionKey, 'base64')).update('bulava/cards/v1').digest();
}

const mac = (key: Buffer, data: string) => createHmac('sha256', key).update(data).digest('base64url');

/**
 * The link to a paid card's order page: an HMAC of the order's id. It says
 * nothing about the order, and the worker can rebuild it for the email while
 * the database keeps only its hash (`CardOrder.tokenHash`).
 */
export function cardOrderToken(orderId: string, tokenEncryptionKey: string): string {
  return mac(cardKey(tokenEncryptionKey), `order:${orderId}`);
}

/** A short-lived token for the export renderer to open one card: `<exportId>.<expiry>.<mac>`. */
export function cardRenderToken(exportId: string, tokenEncryptionKey: string, ttlSeconds = 600, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${exportId}.${exp}.${mac(cardKey(tokenEncryptionKey), `render:${exportId}:${exp}`)}`;
}

/** The export a render token opens, or null when it is forged or expired. */
export function verifyCardRenderToken(token: string, tokenEncryptionKey: string, now = Date.now()): string | null {
  const [exportId, exp, given] = token.split('.');
  if (!exportId || !exp || !given || !/^[0-9a-f-]{36}$/.test(exportId) || !/^\d{1,12}$/.test(exp)) return null;
  if (Number(exp) * 1000 < now) return null;
  const expected = Buffer.from(mac(cardKey(tokenEncryptionKey), `render:${exportId}:${exp}`));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? exportId : null;
}
