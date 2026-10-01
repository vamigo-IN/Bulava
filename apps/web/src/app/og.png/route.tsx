import { ImageResponse } from 'next/og';
import { getSiteConfig } from '@/lib/site-config';

export const revalidate = 300;

/**
 * Default share image (also used for private pages, which never get
 * event-specific previews). Replaced by the image the Super Admin uploads in
 * Site settings > Branding.
 */
export async function GET(): Promise<Response> {
  const { site } = await getSiteConfig();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #5b0e1b, #2f0710)',
          color: '#fbf7f0',
          fontFamily: 'serif',
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 12, color: '#e3c585', textTransform: 'uppercase' }}>{site.name}</div>
        <div style={{ marginTop: 28, fontSize: 72, textAlign: 'center', maxWidth: 980, lineHeight: 1.1 }}>Invitations that feel like the occasion itself</div>
        <div style={{ marginTop: 28, fontSize: 30, color: '#efdcb4', textAlign: 'center', maxWidth: 1000 }}>{site.tagline}</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=300' } },
  );
}
