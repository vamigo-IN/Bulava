import { NextResponse, type NextRequest } from 'next/server';

/**
 * Stores a verified OTP pass as an httpOnly cookie so neither the invitation
 * page nor the RSVP requests need it in JavaScript. The pass itself is an
 * HMAC issued by the API; this handler only persists it.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('x-bulava-csrf') !== '1') return NextResponse.json({ ok: false }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { pass?: unknown } | null;
  const pass = typeof body?.pass === 'string' && /^\d{9,11}\.[A-Za-z0-9_-]{20,64}$/.test(body.pass) ? body.pass : null;
  if (!pass) return NextResponse.json({ ok: false }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('bulava_otp', pass, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 86_400,
  });
  return res;
}
