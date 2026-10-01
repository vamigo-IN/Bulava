import { NextResponse, type NextRequest } from 'next/server';

/** Persist a verified PIN pass (HMAC issued by the API) as an httpOnly cookie for this event only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (req.headers.get('x-bulava-csrf') !== '1' || !/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { pass?: unknown } | null;
  const pass = typeof body?.pass === 'string' && /^\d{9,11}\.[A-Za-z0-9_-]{20,64}$/.test(body.pass) ? body.pass : null;
  if (!pass) return NextResponse.json({ ok: false }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(`bulava_pin_${slug}`, pass, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 3600,
  });
  return res;
}
