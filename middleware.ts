import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { getRoleDashboardPath } from '@/lib/routing';
import type { Role } from '@/types/supabase';

const PUBLIC_PATHS = new Set<string>(['/']);

type Guard = {
  test: (pathname: string) => boolean;
  roles: Role[];
};

const ROLE_GUARDS: Guard[] = [
  { test: (pathname) => pathname.startsWith('/admin'), roles: ['ADMIN'] },
  { test: (pathname) => pathname.startsWith('/api/admin'), roles: ['ADMIN'] },
  { test: (pathname) => pathname.startsWith('/coach'), roles: ['COACH'] },
  { test: (pathname) => pathname.startsWith('/api/coach'), roles: ['COACH'] },
  { test: (pathname) => pathname.startsWith('/coder'), roles: ['CODER'] },
  { test: (pathname) => pathname.startsWith('/api/coder'), roles: ['CODER'] },
];

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith('/api');
}

function isAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/banners') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/favicon.ico') ||
    !!pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)
  );
}

function isPublicPath(pathname: string): boolean {
  if (isAsset(pathname)) {
    return true;
  }
  if (pathname.startsWith('/api/auth')) {
    return true;
  }
  return PUBLIC_PATHS.has(pathname);
}

function buildUnauthorizedResponse(request: NextRequest) {
  if (isApiRequest(request.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

function buildForbiddenResponse(request: NextRequest, role: Role | undefined) {
  if (isApiRequest(request.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const redirectTarget = role ? getRoleDashboardPath(role) : '/login';
  return NextResponse.redirect(new URL(redirectTarget, request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (pathname === '/login' || isPublicPath(pathname)) {
      return NextResponse.next();
    }
    return buildUnauthorizedResponse(request);
  }

  const role = token.role as Role | undefined;

  for (const guard of ROLE_GUARDS) {
    if (guard.test(pathname) && (!role || !guard.roles.includes(role))) {
      return buildForbiddenResponse(request, role);
    }
  }

  if (pathname === '/login') {
    if (role) {
      const url = new URL(getRoleDashboardPath(role), request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
