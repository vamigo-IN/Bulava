/** Extra Content-Security-Policy sources for public pages (trackers and code snippets from the admin console). */
export interface CspExtras {
  script: string[];
  connect: string[];
  img: string[];
  frame: string[];
}

/** The rule the API validates with (CSP_SOURCE in @bulava/validation), repeated so the middleware bundle stays small. */
const SOURCE = /^https:\/\/(\*\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(:\d{2,5})?$/;

const DIRECTIVES: Record<string, keyof CspExtras> = { 'script-src': 'script', 'connect-src': 'connect', 'img-src': 'img', 'frame-src': 'frame' };

/** Append the extra sources to their directives. Anything that is not a plain https source is dropped. */
export function withExtraSources(policy: string, extra: CspExtras | null): string {
  if (!extra) return policy;
  return policy
    .split('; ')
    .map((directive) => {
      const key = DIRECTIVES[directive.split(' ', 1)[0] ?? ''];
      if (!key) return directive;
      const present = new Set(directive.split(' '));
      const add = [...new Set(extra[key] ?? [])].filter((s) => typeof s === 'string' && SOURCE.test(s) && !present.has(s));
      return add.length ? `${directive} ${add.join(' ')}` : directive;
    })
    .join('; ');
}
