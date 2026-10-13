import { ImageResponse } from 'next/og';
import { createTranslator } from '@bulava/localization';
import { getTemplate } from '@/lib/server-api';
import { asJpeg, previewAsJpeg } from '@/lib/share-image';
import { getSiteConfig } from '@/lib/site-config';
import { cardPreview, posterPreview } from '@/lib/template-previews';

const t = createTranslator('en');

/** A hex colour mixed with white (0 = unchanged, 1 = white). */
function tint(hex: string | undefined, amount: number, fallback: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return fallback;
  const n = Number.parseInt(m[1]!, 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/**
 * The share image of a template page (WhatsApp, Instagram, Facebook and X previews): the design
 * itself in a phone, its name and occasion on a stage tinted with its own colours, at the size
 * link previews show large (1200 × 630). A template without a pre-rendered preview, or a server
 * without sharp, gets the same card without the phone; an unknown key gets the site's image.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const { key } = await params;
  const [tpl, { site }] = await Promise.all([getTemplate(key), getSiteConfig()]);
  if (!tpl) return Response.redirect(new URL('/og.png', request.url), 302);
  const colors = tpl.preview?.colors ?? tpl.definition?.theme.colors ?? null;
  const video = !tpl.outputs.includes('WEBSITE');
  const source = video ? posterPreview(tpl.key) : cardPreview(tpl.key);
  // The phone's screen: a website's first screen (1 : 2), or a film's poster (11 : 20).
  const screen = video ? { width: 286, height: 520 } : { width: 262, height: 524 };
  const phone = source ? await previewAsJpeg(source, screen.width * 2) : null;
  const host = (() => {
    try {
      return new URL(process.env.WEB_ORIGIN || request.url).host;
    } catch {
      return '';
    }
  })();

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 88px 0 84px',
          background: `linear-gradient(135deg, ${tint(colors?.background, 0.55, '#fbf4ea')}, ${tint(colors?.accent, 0.72, '#f3dfc0')} 60%, ${tint(colors?.primary, 0.82, '#efd6d2')})`,
          color: '#1c1917',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: phone ? 640 : 1000 }}>
          <div style={{ fontSize: 24, letterSpacing: 6, textTransform: 'uppercase', color: '#7a1d27' }}>
            {t(video ? 'share.template.video' : 'share.template.website', { occasion: tpl.category })}
          </div>
          <div style={{ marginTop: 22, fontSize: tpl.name.length > 22 ? 64 : 80, lineHeight: 1.05, letterSpacing: -1 }}>{tpl.name}</div>
          <div style={{ marginTop: 26, fontSize: 30, lineHeight: 1.35, color: '#57534e' }}>{t('share.template.line')}</div>
          <div style={{ marginTop: 44, display: 'flex', alignItems: 'center', fontSize: 26, color: '#7a1d27' }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: '#b8892b', marginRight: 14 }} />
            {host ? `${site.name} · ${host}` : site.name}
          </div>
        </div>
        {phone ? (
          <div
            style={{
              display: 'flex',
              padding: 9,
              borderRadius: 44,
              background: '#1c1917',
              boxShadow: '0 30px 60px -20px rgba(47, 7, 16, 0.55)',
            }}
          >
            <img src={phone} width={screen.width} height={screen.height} style={{ borderRadius: 36 }} />
          </div>
        ) : null}
      </div>
    ),
    { width: 1200, height: 630 },
  );
  const { body, type } = await asJpeg(await png.arrayBuffer());
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': type,
      // Crawlers fetch it once per share; a template's look changes rarely (a new preview image changes its key's file).
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
