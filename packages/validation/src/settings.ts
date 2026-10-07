import { z } from 'zod';

/**
 * Platform settings managed by the Super Admin in the admin console. Each
 * group is saved whole (PUT replaces it), so defaults are safe here. Secret
 * fields live beside the values, encrypted, and are never sent back to a
 * browser: the console only sees whether each secret is set.
 */

export const SETTING_GROUPS = ['site', 'seo', 'tracking', 'code', 'payments', 'email', 'whatsapp', 'maps', 'domains'] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
/** An optional field where an empty input means "not set". */
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema.optional());
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);
const hostname = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, 'Enter a host name like smtp.example.com');
/** A mail server: a public name, a single-label name on a private network (`mailpit` in Docker) or an IPv4 address. */
const serverHost = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/, 'Enter a host name like smtp.example.com, or an IP address');
/** A Content-Security-Policy source: https host, optionally a wildcard subdomain and port. Strict, because it goes into a header. */
export const CSP_SOURCE = /^https:\/\/(\*\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(:\d{2,5})?$/;
const cspSources = z.array(z.string().trim().toLowerCase().regex(CSP_SOURCE, 'Use https://host or https://*.host')).max(20).default([]);
const e164 = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Use the international format, e.g. +919876543210');
const token = z.string().trim().max(120).regex(/^[A-Za-z0-9_\-=.:]+$/, 'Letters, numbers and - _ = . : only');

// ───────────────────────────── Site & branding ─────────────────────────────

export const SITE_ASSET_KINDS = ['logo', 'favicon', 'ogImage'] as const;
export type SiteAssetKind = (typeof SITE_ASSET_KINDS)[number];

const FOOTER_DEFAULTS = {
  eyebrow: 'Made in India',
  about: 'Digital invitations, RSVPs and memories for every Indian celebration.',
  copyright: '© {year} {name}. All rights reserved.',
  note: '',
};

export const SiteSettingsSchema = z.object({
  name: z.string().trim().min(1).max(60).default('Bulava'),
  tagline: z.string().trim().max(120).default('Digital invitations for every Indian celebration'),
  /** Storage keys, set only by the upload endpoint (never from a form). */
  logoKey: z.string().max(200).optional(),
  faviconKey: z.string().max(200).optional(),
  ogImageKey: z.string().max(200).optional(),
  themeColor: hex.default('#5b0e1b'),
  /** The one support address: the contact page, the policies, the footer and new contact-form messages. */
  supportEmail: z.preprocess(blank, z.email().max(200).default('support@bulava.in')),
  supportPhone: opt(e164),
  /** Click-to-chat button on public pages. */
  whatsappNumber: opt(e164),
  whatsappMessage: z.string().trim().max(200).default('Hi Bulava, I have a question about invitations.'),
  announcement: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().trim().max(160).default(''),
      link: opt(httpsUrl.or(z.string().regex(/^\/[A-Za-z0-9/_?=&.-]*$/, 'Use a full https:// link or a path like /pricing'))),
      linkText: z.string().trim().max(40).default(''),
    })
    .default({ enabled: false, text: '', linkText: '' }),
  social: z
    .object({
      instagram: opt(httpsUrl),
      facebook: opt(httpsUrl),
      youtube: opt(httpsUrl),
      x: opt(httpsUrl),
      linkedin: opt(httpsUrl),
      pinterest: opt(httpsUrl),
    })
    .default({}),
  /** Footer text on every public page. An empty field hides its line. */
  footer: z
    .object({
      /** The small line under the logo. */
      eyebrow: z.string().trim().max(60).default(FOOTER_DEFAULTS.eyebrow),
      /** The short description under it. */
      about: z.string().trim().max(300).default(FOOTER_DEFAULTS.about),
      /** The bottom line; {year} and {name} are filled in. */
      copyright: z.string().trim().max(200).default(FOOTER_DEFAULTS.copyright),
      /** An extra line at the bottom, for example the registered company name and GSTIN. */
      note: z.string().trim().max(300).default(FOOTER_DEFAULTS.note),
    })
    .default(FOOTER_DEFAULTS),
});

// ───────────────────────────── SEO & AI ─────────────────────────────

/** Crawlers that collect content for AI models or AI answers. Each can be allowed or blocked in robots.txt. */
export const AI_CRAWLERS = [
  { id: 'GPTBot', owner: 'OpenAI', purpose: 'training' },
  { id: 'OAI-SearchBot', owner: 'OpenAI', purpose: 'search' },
  { id: 'ChatGPT-User', owner: 'OpenAI', purpose: 'assistant' },
  { id: 'ClaudeBot', owner: 'Anthropic', purpose: 'training' },
  { id: 'Claude-SearchBot', owner: 'Anthropic', purpose: 'search' },
  { id: 'Claude-User', owner: 'Anthropic', purpose: 'assistant' },
  { id: 'Google-Extended', owner: 'Google (Gemini)', purpose: 'training' },
  { id: 'PerplexityBot', owner: 'Perplexity', purpose: 'search' },
  { id: 'Perplexity-User', owner: 'Perplexity', purpose: 'assistant' },
  { id: 'Applebot-Extended', owner: 'Apple', purpose: 'training' },
  { id: 'meta-externalagent', owner: 'Meta', purpose: 'training' },
  { id: 'Amazonbot', owner: 'Amazon', purpose: 'search' },
  { id: 'CCBot', owner: 'Common Crawl', purpose: 'training' },
  { id: 'Bytespider', owner: 'ByteDance', purpose: 'training' },
] as const;
export type AiCrawlerId = (typeof AI_CRAWLERS)[number]['id'];
const AI_IDS = new Set<string>(AI_CRAWLERS.map((c) => c.id));

export const SeoSettingsSchema = z.object({
  title: z.string().trim().min(1).max(70).default('Bulava · Digital invitations for every Indian celebration'),
  titleTemplate: z.string().trim().max(40).regex(/%s/, 'Include %s where the page name goes').default('%s · Bulava'),
  description: z
    .string()
    .trim()
    .max(200)
    .default('Wedding websites, video invitations, RSVP and QR photo sharing for Hindu, Sikh, Muslim, South Indian and Christian weddings, birthdays, pujas and every celebration.'),
  keywords: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  twitterHandle: opt(z.string().trim().regex(/^@[A-Za-z0-9_]{1,15}$/, 'Like @bulava')),
  /** false = ask every search engine not to index the site (staging, pre-launch). */
  indexing: z.boolean().default(true),
  robotsDisallow: z.array(z.string().trim().regex(/^\/[A-Za-z0-9/_*$.-]*$/, 'Paths start with /')).max(30).default([]),
  verification: z
    .object({ google: opt(token), bing: opt(token), yandex: opt(token), pinterest: opt(token), facebook: opt(token) })
    .default({}),
  organization: z
    .object({
      legalName: opt(z.string().trim().max(120)),
      email: opt(z.email().max(200)),
      phone: opt(e164),
      address: opt(z.string().trim().max(300)),
      /** Named in the privacy policy and terms, as Indian law requires; the policies leave the line out until it is set. */
      grievanceOfficer: opt(z.string().trim().max(120)),
      foundingYear: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().int().min(1900).max(2100).optional()),
    })
    .default({}),
  /** Per crawler; a crawler not listed is allowed. */
  aiCrawlers: z
    .record(z.string(), z.enum(['allow', 'block']))
    .refine((r) => Object.keys(r).every((k) => AI_IDS.has(k)), 'Unknown crawler')
    .default({}),
  /** Custom /llms.txt; empty = generated from these settings. */
  llmsTxt: z.string().max(20_000).default(''),
});

// ───────────────────────────── Tracking & code ─────────────────────────────

export const TrackingSettingsSchema = z.object({
  ga4Id: opt(z.string().trim().regex(/^G-[A-Z0-9]{4,16}$/, 'Like G-XXXXXXX')),
  gtmId: opt(z.string().trim().regex(/^GTM-[A-Z0-9]{4,12}$/, 'Like GTM-XXXXXX')),
  googleAdsId: opt(z.string().trim().regex(/^AW-\d{6,15}$/, 'Like AW-123456789')),
  metaPixelId: opt(z.string().trim().regex(/^\d{6,20}$/, 'Digits only')),
  clarityId: opt(z.string().trim().regex(/^[a-z0-9]{6,20}$/, 'Like abcd1234ef')),
  linkedinPartnerId: opt(z.string().trim().regex(/^\d{4,12}$/, 'Digits only')),
  posthogKey: opt(z.string().trim().regex(/^phc_[A-Za-z0-9]{10,64}$/, 'Like phc_…')),
  posthogHost: opt(httpsUrl),
});

export const CodeSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** HTML added to <head> of public marketing pages (never dashboards or guest pages). */
  headHtml: z.string().max(20_000).default(''),
  /** HTML added at the end of <body> of public marketing pages. */
  bodyHtml: z.string().max(20_000).default(''),
  /** Extra sources the public pages' Content-Security-Policy allows, for the code above. */
  allowedSources: z
    .object({ script: cspSources, connect: cspSources, img: cspSources, frame: cspSources })
    .default({ script: [], connect: [], img: [], frame: [] }),
});

// ───────────────────────────── Integrations ─────────────────────────────

export const PaymentSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.literal('RAZORPAY').default('RAZORPAY'),
  keyId: opt(z.string().trim().regex(/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/, 'A Razorpay key id: rzp_test_… or rzp_live_…')),
});

export const EmailSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  host: opt(serverHost),
  port: z.coerce.number().int().min(1).max(65_535).default(587),
  /** auto: TLS on port 465, STARTTLS otherwise. */
  security: z.enum(['auto', 'ssl', 'starttls', 'none']).default('auto'),
  username: opt(z.string().trim().max(200)),
  fromName: z.string().trim().min(1).max(80).default('Bulava'),
  fromEmail: opt(z.email().max(200)),
  replyTo: opt(z.email().max(200)),
});

export const WhatsAppSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.literal('META_CLOUD').default('META_CLOUD'),
  phoneNumberId: opt(z.string().trim().regex(/^\d{5,20}$/, 'The phone number ID from WhatsApp Manager (digits)')),
  businessAccountId: opt(z.string().trim().regex(/^\d{5,20}$/, 'Digits only')),
  apiVersion: z.string().trim().regex(/^v\d{1,2}\.\d$/, 'Like v21.0').default('v21.0'),
  /** Approved message templates (names from WhatsApp Manager). */
  templates: z
    .object({
      invitation: opt(z.string().trim().regex(/^[a-z0-9_]{1,512}$/, 'Lower-case letters, digits and _')),
      reminder: opt(z.string().trim().regex(/^[a-z0-9_]{1,512}$/, 'Lower-case letters, digits and _')),
    })
    .default({}),
  templateLanguage: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, 'Like en or en_US').default('en'),
});

export const MapsSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  /** A browser key for the Maps Embed API, restricted to the site's domains in Google Cloud. Public by design. */
  embedKey: opt(z.string().trim().regex(/^AIza[0-9A-Za-z_-]{35}$/, 'A Google API key starts with AIza')),
  showOnInvitations: z.boolean().default(true),
});

export const DomainSettingsSchema = z.object({
  mode: z.enum(['off', 'cloudflare', 'manual']).default('off'),
  zoneId: opt(z.string().trim().regex(/^[a-f0-9]{32}$/, 'The 32-character zone ID')),
  cnameTarget: opt(hostname),
  addresses: z.array(z.ipv4()).max(4).default([]),
});

export const SETTING_SCHEMAS = {
  site: SiteSettingsSchema,
  seo: SeoSettingsSchema,
  tracking: TrackingSettingsSchema,
  code: CodeSettingsSchema,
  payments: PaymentSettingsSchema,
  email: EmailSettingsSchema,
  whatsapp: WhatsAppSettingsSchema,
  maps: MapsSettingsSchema,
  domains: DomainSettingsSchema,
} as const;

export type SettingValues = { [G in SettingGroup]: z.infer<(typeof SETTING_SCHEMAS)[G]> };

/** Secret fields per group: stored encrypted, write-only from the console. */
export const SETTING_SECRETS = {
  site: [],
  seo: [],
  tracking: [],
  code: [],
  payments: ['keySecret', 'webhookSecret'],
  email: ['password'],
  whatsapp: ['accessToken', 'appSecret', 'webhookVerifyToken'],
  maps: [],
  domains: ['cloudflareApiToken'],
} as const satisfies Record<SettingGroup, readonly string[]>;
export type SettingSecretName<G extends SettingGroup> = (typeof SETTING_SECRETS)[G][number];

/**
 * Body of PUT /admin/settings/:group. `secrets`: a string sets a secret, null
 * clears it, and a missing key keeps the stored one.
 */
export const SaveSettingsSchema = z.object({
  value: z.record(z.string(), z.unknown()),
  secrets: z.record(z.string(), z.string().trim().min(1).max(2000).nullable()).default({}),
});
export type SaveSettingsInput = z.infer<typeof SaveSettingsSchema>;

export interface SettingCheckStep {
  label: string;
  /** true passed, false failed, null a warning or information. */
  ok: boolean | null;
  detail?: string;
}
export interface SettingCheckResult {
  ok: boolean;
  steps: SettingCheckStep[];
  checkedAt: string;
}

// ───────────────────────────── Public site configuration ─────────────────────────────

/** What public pages need (GET /public/site-config). Never contains secrets. */
export interface PublicSiteConfig {
  site: Omit<SettingValues['site'], 'logoKey' | 'faviconKey' | 'ogImageKey'> & { logoUrl: string | null; faviconUrl: string | null; ogImageUrl: string | null };
  seo: SettingValues['seo'];
  tracking: SettingValues['tracking'];
  code: { headHtml: string; bodyHtml: string };
  /** Extra Content-Security-Policy sources for public pages (trackers and the code above). */
  csp: { script: string[]; connect: string[]; img: string[]; frame: string[] };
}

/** CSP sources each tracker needs on public pages. */
export function trackerSources(t: SettingValues['tracking']): PublicSiteConfig['csp'] {
  const csp: PublicSiteConfig['csp'] = { script: [], connect: [], img: [], frame: [] };
  const add = (kind: keyof PublicSiteConfig['csp'], ...sources: string[]) => csp[kind].push(...sources);
  if (t.ga4Id || t.gtmId || t.googleAdsId) {
    add('script', 'https://www.googletagmanager.com');
    add('connect', 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com');
    add('img', 'https://www.google-analytics.com', 'https://www.googletagmanager.com');
  }
  if (t.gtmId) add('frame', 'https://www.googletagmanager.com');
  if (t.googleAdsId) {
    add('script', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net');
    add('connect', 'https://www.google.com', 'https://googleads.g.doubleclick.net');
    add('img', 'https://www.google.com', 'https://googleads.g.doubleclick.net');
    add('frame', 'https://td.doubleclick.net');
  }
  if (t.metaPixelId) {
    add('script', 'https://connect.facebook.net');
    add('connect', 'https://www.facebook.com', 'https://connect.facebook.net');
    add('img', 'https://www.facebook.com');
  }
  if (t.clarityId) {
    add('script', 'https://www.clarity.ms', 'https://*.clarity.ms');
    add('connect', 'https://*.clarity.ms');
    add('img', 'https://*.clarity.ms', 'https://c.bing.com');
  }
  if (t.linkedinPartnerId) {
    add('script', 'https://snap.licdn.com');
    add('connect', 'https://px.ads.linkedin.com');
    add('img', 'https://px.ads.linkedin.com');
  }
  if (t.posthogKey) {
    const host = new URL(t.posthogHost ?? 'https://us.i.posthog.com').origin;
    add('script', host.replace('.i.posthog.com', '-assets.i.posthog.com'), host);
    add('connect', host);
  }
  return csp;
}
