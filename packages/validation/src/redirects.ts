/**
 * Where to go after signing in (`?next=`), read from a link anyone can craft.
 * Only a path on this site gets through: never another site, whatever the link
 * holds (a protocol-relative `//host`, a backslash, the tabs and newlines that
 * browsers drop while reading an address so that `/\t/host` becomes `//host`,
 * `javascript:`, or a path outside `prefix`). Anything else is the fallback.
 */
export function safeRelativePath(value: string | null | undefined, fallback: string, prefix = '/'): string {
  if (!value || value.length > 500) return fallback;
  // Control characters (tab, newline…) and backslashes have no place in our paths.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return fallback;
  }
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  let url: URL;
  try {
    url = new URL(value, 'https://bulava.invalid');
  } catch {
    return fallback;
  }
  if (url.origin !== 'https://bulava.invalid') return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`) ? path : fallback;
}
