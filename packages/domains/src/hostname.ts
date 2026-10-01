/**
 * Hostname rules for customer domains. Accepts what people paste
 * ("https://AmanWeddsRiya.com/", "www.amanweddsriya.com") and returns the
 * canonical lower-case, punycode form, or a reason it cannot be used.
 */

export type HostnameProblem = 'INVALID' | 'IP_ADDRESS' | 'RESERVED';

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function normalizeHostname(input: string, reservedSuffixes: readonly string[] = []): { hostname: string } | { problem: HostnameProblem } {
  let raw = input.trim().toLowerCase();
  if (!raw || raw.length > 300) return { problem: 'INVALID' };
  raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0]!;
  let hostname: string;
  try {
    // The URL parser punycodes internationalised names and drops the port.
    hostname = new URL(`http://${raw}`).hostname.replace(/\.$/, '');
  } catch {
    return { problem: 'INVALID' };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[')) return { problem: 'IP_ADDRESS' };
  const labels = hostname.split('.');
  if (hostname.length > 253 || labels.length < 2 || !labels.every((l) => LABEL.test(l))) return { problem: 'INVALID' };
  const tld = labels[labels.length - 1]!;
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld)) return { problem: 'INVALID' };
  const reserved = ['localhost', 'local', 'internal', 'test', 'example', 'invalid', ...reservedSuffixes];
  if (reserved.some((r) => hostname === r || hostname.endsWith(`.${r}`) || tld === r)) return { problem: 'RESERVED' };
  return { hostname };
}

/** The DNS name holding the ownership proof. */
export function challengeName(hostname: string): string {
  return `_bulava-challenge.${hostname}`;
}

export function challengeValue(token: string): string {
  return `bulava-verify=${token}`;
}
