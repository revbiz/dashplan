import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getAuthCookieName, getExpectedCookieValue } from '@/lib/auth';

const ALWAYS_ALLOW_PREFIXES = ['/login', '/logout', '/api/auth/logout'];

const PROTECTED_PREFIXES = [
  '/test',
  '/preferences',
  '/dashboard',
  '/charts',
  '/reports-notetype',
  '/api/fm',
  '/api/dashboard',
  '/api/reports',
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ALWAYS_ALLOW_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const expected = getExpectedCookieValue();
  const cookieName = getAuthCookieName();
  const cookieValue = req.cookies.get(cookieName)?.value;

  if (!expected || cookieValue !== expected) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/test/:path*',
    '/preferences/:path*',
    '/dashboard/:path*',
    '/charts/:path*',
    '/reports-notetype/:path*',
    '/api/fm/:path*',
    '/api/dashboard/:path*',
    '/api/reports/:path*',
  ],
};
