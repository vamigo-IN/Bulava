import type { TemplateDefinition } from '@bulava/template-schema';
import type { PublicSitePage, PublicSitePageLink } from '@bulava/validation';

const API = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * Server-side API access for public/marketing pages. Uses Next's data cache
 * (`revalidate` seconds). Returns null instead of throwing so marketing pages
 * degrade gracefully if the API is briefly unavailable.
 *
 * `next build` pre-renders with the fallbacks and never calls the API: inside
 * a Docker image build the API's host name does not exist yet, and waiting on
 * it pushed pages past Next's 60-second limit. The pages fill in when they
 * first revalidate at runtime.
 */
export async function serverApi<T>(path: string, options: { revalidate?: number | false; headers?: Record<string, string> } = {}): Promise<T | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null;
  try {
    const res = await fetch(`${API}/api/v1${path}`, {
      headers: { accept: 'application/json', ...(options.headers ?? {}) },
      ...(options.revalidate === false ? { cache: 'no-store' as const } : { next: { revalidate: options.revalidate ?? 60 } }),
    });
    const body = (await res.json().catch(() => null)) as { success: boolean; data: T } | null;
    return body?.success ? body.data : null;
  } catch {
    return null;
  }
}

/** Published site pages for the footer and sitemap; the built-in ones while the API can't be reached (and at build time). */
export const FALLBACK_SITE_PAGES: PublicSitePageLink[] = [
  { slug: 'about', title: 'About Bulava', footerGroup: 'COMPANY', sortOrder: 0, updatedAt: '2026-10-07T00:00:00.000Z' },
  { slug: 'contact', title: 'Contact us', footerGroup: 'COMPANY', sortOrder: 1, updatedAt: '2026-10-07T00:00:00.000Z' },
  { slug: 'privacy', title: 'Privacy policy', footerGroup: 'LEGAL', sortOrder: 0, updatedAt: '2026-10-07T00:00:00.000Z' },
  { slug: 'terms', title: 'Terms of service', footerGroup: 'LEGAL', sortOrder: 1, updatedAt: '2026-10-07T00:00:00.000Z' },
  { slug: 'refund', title: 'Refund and cancellation policy', footerGroup: 'LEGAL', sortOrder: 2, updatedAt: '2026-10-07T00:00:00.000Z' },
  { slug: 'shipping', title: 'Shipping and delivery policy', footerGroup: 'LEGAL', sortOrder: 3, updatedAt: '2026-10-07T00:00:00.000Z' },
  { slug: 'cookies', title: 'Cookie policy', footerGroup: 'LEGAL', sortOrder: 4, updatedAt: '2026-10-07T00:00:00.000Z' },
  { slug: 'account-deletion', title: 'Account deletion policy', footerGroup: 'LEGAL', sortOrder: 5, updatedAt: '2026-10-07T00:00:00.000Z' },
  { slug: 'grievance-redressal', title: 'Grievance redressal', footerGroup: 'LEGAL', sortOrder: 6, updatedAt: '2026-10-07T00:00:00.000Z' },
];

export const getSitePages = () => serverApi<PublicSitePageLink[]>('/public/pages', { revalidate: 60 }).then((p) => (p?.length ? p : FALLBACK_SITE_PAGES));

/**
 * One published page. Unlike `serverApi`, an unreachable API throws instead of
 * reading as "not found", so a regeneration that fails keeps the last good
 * page rather than caching a 404 for a policy page.
 */
export async function getSitePage(slug: string): Promise<PublicSitePage | null> {
  const res = await fetch(`${API}/api/v1/public/pages/${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' }, next: { revalidate: 60 } });
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => null)) as { success: boolean; data: PublicSitePage } | null;
  if (!res.ok || !body?.success) throw new Error(`Site page ${slug}: API answered ${res.status}`);
  return body.data;
}

export interface TemplateSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  style: string | null;
  tier: 'FREE' | 'STANDARD' | 'PREMIUM';
  badge: 'NEW' | 'POPULAR' | 'BESTSELLER' | null;
  featured: boolean;
  tags: string[];
  eventTypes: string[];
  languages: string[];
  outputs: Array<'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD'>;
  templateVersionId: string;
  definition?: TemplateDefinition;
}

export interface Plan {
  key: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  interval: 'ONE_TIME' | 'YEAR';
  features: Array<{ featureKey: string; enabled: boolean; limit: number | null }>;
}

export interface SiteStats {
  events: number;
  invitationsOpened: number;
  rsvps: number;
  templates: number;
  languages: number;
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  location: string | null;
  eventLabel: string | null;
  rating: number;
}

export const getTemplates = () => serverApi<TemplateSummary[]>('/public/templates?include=definition').then((t) => t ?? []);
export const getTemplate = (key: string) => serverApi<TemplateSummary>(`/public/templates/${encodeURIComponent(key)}`);
export const getPlans = () => serverApi<Plan[]>('/meta/plans', { revalidate: 300 }).then((p) => p ?? []);
export const getStats = () => serverApi<SiteStats>('/public/site-stats', { revalidate: 300 });
export const getTestimonials = () => serverApi<Testimonial[]>('/public/testimonials', { revalidate: 300 }).then((t) => t ?? []);

export function formatInr(minor: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);
}

/** Price label for a template tier, from the admin-managed plans. */
export function tierPrice(tier: TemplateSummary['tier'], plans: Plan[]): string | null {
  if (tier === 'FREE') return null;
  const plan = plans.find((p) => p.key === tier);
  return plan ? formatInr(plan.priceMinor) : null;
}
