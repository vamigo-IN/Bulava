import type { Request } from 'express';

/**
 * What a visitor of a public event page carries: a PIN pass (PRIVATE_LINK, set
 * after the PIN) and the secret link key (SECRET_TOKEN, moved from the link's
 * `?k=` into an httpOnly cookie by the web app). Server-side page renders send
 * them as headers instead. Both are checked by PublicEventsService.
 */
export function publicEventCredentials(req: Request, slug: string): { pinPass: string | undefined; linkKey: string | undefined } {
  const cookies = req.cookies as Record<string, string> | undefined;
  return {
    pinPass: req.get('x-bulava-pin-pass') ?? cookies?.[`bulava_pin_${slug}`] ?? undefined,
    linkKey: req.get('x-bulava-link-key') ?? cookies?.[`bulava_link_${slug}`] ?? undefined,
  };
}
