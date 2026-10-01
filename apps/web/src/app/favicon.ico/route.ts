import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export function GET(request: Request): Response {
  return NextResponse.redirect(new URL('/brand-icon.svg', request.url), 307);
}
