import { getSiteConfig } from '@/lib/site-config';
import { getTemplates } from '@/lib/server-api';

export const revalidate = 300;

/**
 * /llms.txt (https://llmstxt.org): a plain summary of the site for AI
 * assistants. The Super Admin can replace it with their own text
 * (Site settings > SEO); otherwise it is generated from the settings and the
 * published templates. Not served while search indexing is switched off.
 */
export async function GET(): Promise<Response> {
  const origin = (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
  const { site, seo } = await getSiteConfig();
  if (!seo.indexing) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  let body = seo.llmsTxt.trim();
  if (!body) {
    const templates = (await getTemplates()).slice(0, 40);
    const line = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    const contact = [
      site.supportEmail ? `- Email: ${site.supportEmail}` : null,
      site.supportPhone ? `- Phone: ${site.supportPhone}` : null,
      site.whatsappNumber ? `- WhatsApp: https://wa.me/${site.whatsappNumber.replace(/[^\d]/g, '')}` : null,
      `- Contact page: ${origin}/contact`,
    ].filter(Boolean);
    body = [
      `# ${site.name}`,
      '',
      `> ${line(seo.description)}`,
      '',
      line(site.tagline),
      '',
      '## Main pages',
      `- [Home](${origin}/): what ${site.name} does and how it works`,
      `- [Templates](${origin}/templates): invitation website and video templates by occasion, community and style`,
      `- [Pricing](${origin}/pricing): plans and what each includes`,
      `- [About](${origin}/about)`,
      `- [Privacy policy](${origin}/privacy)`,
      `- [Terms](${origin}/terms)`,
      `- [Refunds](${origin}/refund)`,
      '',
      ...(templates.length
        ? ['## Templates', ...templates.map((t) => `- [${line(t.name)}](${origin}/templates/${t.key}): ${line(t.description) || `${t.category} invitation template`}`), '']
        : []),
      '## Contact',
      ...contact,
      '',
    ].join('\n');
  }
  return new Response(`${body}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
