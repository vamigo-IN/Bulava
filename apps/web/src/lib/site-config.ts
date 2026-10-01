import { SeoSettingsSchema, SiteSettingsSchema, TrackingSettingsSchema, type PublicSiteConfig } from '@bulava/validation';
import { serverApi } from './server-api';

function defaults(): PublicSiteConfig {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { logoKey, faviconKey, ogImageKey, ...site } = SiteSettingsSchema.parse({});
  return {
    site: { ...site, logoUrl: null, faviconUrl: null, ogImageUrl: null },
    seo: SeoSettingsSchema.parse({}),
    tracking: TrackingSettingsSchema.parse({}),
    code: { headHtml: '', bodyHtml: '' },
    csp: { script: [], connect: [], img: [], frame: [] },
  };
}

/** What the site looks like before the Super Admin changes anything (and while the API is unreachable). */
export const DEFAULT_SITE_CONFIG: PublicSiteConfig = defaults();

/**
 * Branding, SEO, trackers and code snippets from the admin console
 * (Site settings). Cached for a minute, so a change shows up on the public
 * site within about a minute; falls back to the defaults if the API is down.
 */
export async function getSiteConfig(): Promise<PublicSiteConfig> {
  return (await serverApi<PublicSiteConfig>('/public/site-config', { revalidate: 60 })) ?? DEFAULT_SITE_CONFIG;
}

/** Generated share image, used until the Super Admin uploads one. */
export const DEFAULT_SHARE_IMAGE = '/og.png';

/** Open Graph / Twitter images: the uploaded share image, or the generated default. */
export function shareImages(config: PublicSiteConfig) {
  const alt = `${config.site.name}: ${config.site.tagline}`;
  return config.site.ogImageUrl ? [{ url: config.site.ogImageUrl, alt }] : [{ url: DEFAULT_SHARE_IMAGE, width: 1200, height: 630, alt }];
}

/** https://wa.me link for the site's click-to-chat button. */
export function whatsappChatUrl(number: string, message: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
