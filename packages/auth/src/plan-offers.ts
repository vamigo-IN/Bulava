import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Offers of hidden plans (ADR-062): the ₹159 plan is never on the plans page;
 * it is sold only through an offer the API made for one signed-in account, for
 * a day (a host about to leave the checkout, a link in an ad). The token is
 * `<planKey>.<expiry>.<mac>`, the MAC binding the account, so an offer cannot
 * be passed on. Derived from the platform's token key, like the card links.
 */
function offerKey(tokenEncryptionKey: string): Buffer {
  return createHmac('sha256', Buffer.from(tokenEncryptionKey, 'base64')).update('bulava/plan-offers/v1').digest();
}

const mac = (key: Buffer, data: string) => createHmac('sha256', key).update(data).digest('base64url');

export function planOfferToken(userId: string, planKey: string, tokenEncryptionKey: string, ttlSeconds = 86_400, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${planKey}.${exp}.${mac(offerKey(tokenEncryptionKey), `offer:${userId}:${planKey}:${exp}`)}`;
}

/** Whether the token is this account's offer of this plan, still valid. */
export function verifyPlanOfferToken(token: string, userId: string, planKey: string, tokenEncryptionKey: string, now = Date.now()): boolean {
  const [key, exp, given] = token.split('.');
  if (key !== planKey || !exp || !given || !/^\d{1,12}$/.test(exp) || Number(exp) * 1000 < now) return false;
  const expected = Buffer.from(mac(offerKey(tokenEncryptionKey), `offer:${userId}:${planKey}:${exp}`));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
