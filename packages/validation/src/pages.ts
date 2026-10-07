import { z } from 'zod';

/**
 * Site pages (About, Contact, the policies and any page staff create) are rows
 * edited in the admin console. Their text is plain writing with a few marks,
 * parsed here so the site and the console's preview agree:
 *
 *   blank line          new paragraph
 *   ### Heading         a sub-heading inside the section
 *   - item / * item     bulleted list
 *   1. item             numbered list
 *   **bold**            bold
 *   [text](link)        a link (https://, mailto:, tel:, /page or #anchor)
 *   {supportEmail}      a value from the site settings (see PAGE_TOKENS)
 *
 * Email addresses and https:// links in the text become links on their own. A
 * paragraph or list item that uses a value the settings do not have yet (say
 * {address}) is left out, so a page never shows a half-finished sentence.
 */

export const SITE_PAGE_LAYOUTS = ['DOCUMENT', 'CARDS', 'CONTACT'] as const;
export type SitePageLayout = (typeof SITE_PAGE_LAYOUTS)[number];

export const SITE_PAGE_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type SitePageStatus = (typeof SITE_PAGE_STATUSES)[number];

/** Footer column a page is listed in (none: reachable only by its link). */
export const SITE_PAGE_FOOTER_GROUPS = ['COMPANY', 'LEGAL'] as const;
export type SitePageFooterGroup = (typeof SITE_PAGE_FOOTER_GROUPS)[number];

/** Addresses the site already uses; a page there would never be shown. */
export const RESERVED_PAGE_SLUGS: readonly string[] = [
  'api',
  'admin',
  'brand-icon.svg',
  'checkin',
  'dashboard',
  'e',
  'favicon.ico',
  'healthz',
  'invite',
  'llms.txt',
  'login',
  'logout',
  'og.png',
  'p',
  'preview-frame',
  'pricing',
  'robots.txt',
  'signup',
  'sitemap.xml',
  'team',
  'template-previews',
  'templates',
  'wall',
  '_next',
];

export const PageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens')
  .refine((slug) => !RESERVED_PAGE_SLUGS.includes(slug), 'This address is already used by another part of the site');

export const SitePageSectionSchema = z.object({
  heading: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20_000),
});
export type SitePageSection = z.infer<typeof SitePageSectionSchema>;

/**
 * A whole page (POST creates, PUT replaces). No defaults, so a save never
 * resets a field the form did not send (ADR-024).
 */
export const SitePageInputSchema = z.object({
  slug: PageSlugSchema,
  title: z.string().trim().min(2).max(120),
  /** The lead under the title, and the description search engines show. */
  description: z.string().trim().min(10).max(300),
  layout: z.enum(SITE_PAGE_LAYOUTS),
  status: z.enum(SITE_PAGE_STATUSES),
  footerGroup: z.enum(SITE_PAGE_FOOTER_GROUPS).nullable(),
  sortOrder: z.number().int().min(0).max(1000),
  sections: z.array(SitePageSectionSchema).min(1).max(40),
});
export type SitePageInput = z.infer<typeof SitePageInputSchema>;

/** A published page as the site receives it (GET /public/pages/:slug). */
export interface PublicSitePage {
  slug: string;
  title: string;
  description: string;
  layout: SitePageLayout;
  footerGroup: SitePageFooterGroup | null;
  sections: SitePageSection[];
  updatedAt: string;
}

/** A footer or sitemap entry (GET /public/pages). */
export interface PublicSitePageLink {
  slug: string;
  title: string;
  footerGroup: SitePageFooterGroup | null;
  sortOrder: number;
  updatedAt: string;
}

// ───────────────────────────── Values from the settings ─────────────────────────────

/** Placeholders a page may use, filled from the site settings when the page is shown. */
export const PAGE_TOKENS = ['siteName', 'supportEmail', 'supportPhone', 'legalName', 'address', 'grievanceOfficer'] as const;
export type PageToken = (typeof PAGE_TOKENS)[number];
export type PageTokenValues = Partial<Record<PageToken, string | null | undefined>>;

const TOKEN = /\{([a-zA-Z]+)\}/g;
const KNOWN_TOKENS = new Set<string>(PAGE_TOKENS);

/** The text with its placeholders filled in, or null when one has no value yet. */
export function fillPageTokens(text: string, values: PageTokenValues): string | null {
  let missing = false;
  const filled = text.replace(TOKEN, (match, name: string) => {
    if (!KNOWN_TOKENS.has(name)) return match;
    const value = values[name as PageToken]?.trim();
    if (!value) missing = true;
    return value ?? '';
  });
  return missing ? null : filled;
}

// ───────────────────────────── Text to blocks ─────────────────────────────

export type PageInline = { type: 'text'; text: string } | { type: 'strong'; text: string } | { type: 'link'; text: string; href: string };
export type PageBlock =
  | { type: 'p'; content: PageInline[] }
  | { type: 'h3'; content: PageInline[] }
  | { type: 'ul' | 'ol'; items: PageInline[][] };

/** Links a page may point to; anything else (javascript:, data:) stays plain text. */
export function safePageHref(href: string): string | null {
  const h = href.trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(h)) return h;
  if (/^mailto:[^\s"'<>@]+@[^\s"'<>@]+$/i.test(h)) return h;
  if (/^tel:\+?[0-9 ()-]{5,20}$/.test(h)) return h.replace(/[ ()-]/g, '');
  if (/^\/(?!\/)[A-Za-z0-9/_?=&.#-]*$/.test(h)) return h;
  if (/^#[A-Za-z0-9_-]+$/.test(h)) return h;
  return null;
}

// [text](href) | **bold** | email | https URL
const INLINE = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)|\*\*([^*\n]{1,500})\*\*|([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})|(https:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

export function parsePageInline(text: string): PageInline[] {
  const out: PageInline[] = [];
  const push = (node: PageInline) => {
    const last = out[out.length - 1];
    if (node.type === 'text' && last?.type === 'text') last.text += node.text;
    else if (node.type !== 'text' || node.text) out.push(node);
  };
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    push({ type: 'text', text: text.slice(at, m.index) });
    const [whole, linkText, linkHref, bold, email, url] = m;
    if (linkText !== undefined && linkHref !== undefined) {
      const href = safePageHref(linkHref);
      push(href ? { type: 'link', text: linkText, href } : { type: 'text', text: linkText });
    } else if (bold !== undefined) push({ type: 'strong', text: bold });
    else if (email !== undefined) push({ type: 'link', text: email, href: `mailto:${email}` });
    else if (url !== undefined) push({ type: 'link', text: url.replace(/^https:\/\//, ''), href: url });
    else push({ type: 'text', text: whole });
    at = m.index + whole.length;
  }
  push({ type: 'text', text: text.slice(at) });
  return out;
}

/** A section's text as paragraphs, sub-headings and lists, with the settings' values filled in. */
export function parsePageBody(body: string, values: PageTokenValues = {}): PageBlock[] {
  const blocks: PageBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const inline = (text: string) => {
    const filled = fillPageTokens(text, values);
    return filled === null ? null : parsePageInline(filled.trim());
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      const content = inline(paragraph.join(' '));
      if (content?.length) blocks.push({ type: 'p', content });
    }
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map(inline).filter((i): i is PageInline[] => !!i?.length);
      if (items.length) blocks.push({ type: list.type, items });
    }
    list = null;
  };

  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d{1,3}[.)]\s+(.*)$/.exec(line);
    const heading = /^#{2,4}\s+(.*)$/.exec(line);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const content = inline(heading[1]!);
      if (content?.length) blocks.push({ type: 'h3', content });
    } else if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
    } else if (list) {
      // A wrapped line continues the list item above it.
      const last = list.items.length - 1;
      list.items[last] = `${list.items[last] ?? ''} ${line}`;
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** The anchor a section heading gets (the policies' "On this page" index links to it). */
export function pageAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
