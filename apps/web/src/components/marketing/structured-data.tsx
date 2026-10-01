import type { PublicSiteConfig } from '@bulava/validation';

/**
 * schema.org Organization + WebSite for search engines and AI answers, from
 * the site settings (Branding and SEO > Organization). A JSON-LD data block,
 * which browsers never execute; "<" is escaped so no text can close the tag.
 */
export function SiteStructuredData({ config, origin }: { config: PublicSiteConfig; origin: string }) {
  const { site, seo } = config;
  const org = seo.organization;
  const base = origin.replace(/\/$/, '');
  const sameAs = Object.values(site.social).filter((url): url is string => Boolean(url));
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: site.name,
        url: `${base}/`,
        logo: site.logoUrl ? new URL(site.logoUrl, base).href : `${base}/brand-icon.svg`,
        ...(org.legalName ? { legalName: org.legalName } : {}),
        ...(org.email ?? site.supportEmail ? { email: org.email ?? site.supportEmail } : {}),
        ...(org.phone ?? site.supportPhone ? { telephone: org.phone ?? site.supportPhone } : {}),
        ...(org.address ? { address: org.address } : {}),
        ...(org.foundingYear ? { foundingDate: String(org.foundingYear) } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: `${base}/`,
        name: site.name,
        description: seo.description,
        inLanguage: 'en-IN',
        publisher: { '@id': `${base}/#organization` },
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
