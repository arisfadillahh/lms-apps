import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { getRoleDashboardPath } from '@/lib/routing';
import type { Role } from '@/types/supabase';

const PUBLIC_PATHS = new Set<string>(['/']);

// Additional public path prefixes (no auth required)
const PUBLIC_PREFIXES = [
  '/invoice',
  '/report',
  '/api/cron',
  '/api/jobs/reminders',
  '/api/invoices/seasonal',
  '/api/whatsapp/send',
];

type AdminMenuId =
  | 'dashboard'
  | 'users'
  | 'classes'
  | 'curriculum'
  | 'lessonReports'
  | 'ekskul'
  | 'evaluations'
  | 'evaluationQuestions'
  | 'reports'
  | 'payments'
  | 'invoices'
  | 'ccr'
  | 'ccrlist'
  | 'whatsapp'
  | 'broadcast'
  | 'software'
  | 'banners'
  | 'leave'
  | 'settings';

type AdminPermissions = {
  menus?: string[];
  is_superadmin?: boolean;
} | null;

type MiddlewareUser = {
  id: string;
  username: string;
  role: Role;
  isActive: boolean;
  adminPermissions: AdminPermissions;
};

type AdminAccessRule = {
  prefix: string;
  menus: AdminMenuId[] | null;
  exact?: boolean;
  methods?: string[];
};

const ADMIN_ACCESS_RULES: AdminAccessRule[] = [
  { prefix: '/admin/profile', menus: null },
  { prefix: '/admin/dashboard', menus: null },
  { prefix: '/admin/users', menus: ['users'] },
  { prefix: '/admin/classes', menus: ['classes'] },
  { prefix: '/admin/curriculum/reports', menus: ['lessonReports'] },
  { prefix: '/admin/curriculum', menus: ['curriculum'] },
  { prefix: '/admin/ekskul', menus: ['ekskul'] },
  { prefix: '/admin/evaluations/questions', menus: ['evaluationQuestions'] },
  { prefix: '/admin/evaluations', menus: ['evaluations'] },
  { prefix: '/admin/reports', menus: ['reports'] },
  { prefix: '/admin/payments/invoices', menus: ['invoices'] },
  { prefix: '/admin/payments/registration', menus: ['payments', 'invoices'] },
  { prefix: '/admin/payments/coders', menus: ['payments', 'invoices'] },
  { prefix: '/admin/payments/expired', menus: ['payments', 'invoices'] },
  { prefix: '/admin/payments/pricing', menus: ['payments'] },
  { prefix: '/admin/payments', menus: ['payments'] },
  { prefix: '/admin/coders/assign-ccr', menus: ['ccr'] },
  { prefix: '/admin/coders/list-ccr', menus: ['ccrlist'] },
  { prefix: '/admin/whatsapp', menus: ['whatsapp'] },
  { prefix: '/admin/broadcast', menus: ['broadcast'] },
  { prefix: '/admin/software', menus: ['software'] },
  { prefix: '/admin/banners', menus: ['banners'] },
  { prefix: '/admin/leave', menus: ['leave'] },
  { prefix: '/admin/settings', menus: ['settings'] },

  { prefix: '/api/admin/banners', menus: ['banners'] },
  { prefix: '/api/admin/broadcast', menus: ['broadcast'] },
  { prefix: '/api/admin/class-lessons', menus: ['classes', 'curriculum'] },
  { prefix: '/api/admin/classes', menus: ['classes', 'invoices'], methods: ['GET'] },
  { prefix: '/api/admin/classes', menus: ['classes'] },
  { prefix: '/api/admin/coders', menus: ['users'] },
  { prefix: '/api/admin/curriculum/levels', menus: ['curriculum', 'users', 'classes'], methods: ['GET'] },
  { prefix: '/api/admin/curriculum/blocks', menus: ['curriculum', 'classes'], methods: ['GET'] },
  { prefix: '/api/admin/curriculum', menus: ['curriculum'] },
  { prefix: '/api/admin/dev', menus: [] },
  { prefix: '/api/admin/ekskul', menus: ['ekskul', 'classes'], methods: ['GET'] },
  { prefix: '/api/admin/ekskul', menus: ['ekskul'] },
  { prefix: '/api/admin/evaluation-templates', menus: ['evaluationQuestions'] },
  { prefix: '/api/admin/evaluations', menus: ['evaluations'] },
  { prefix: '/api/admin/exkul/competencies', menus: ['classes'] },
  { prefix: '/api/admin/invoices', menus: ['invoices'] },
  { prefix: '/api/admin/leave', menus: ['leave'] },
  { prefix: '/api/admin/lesson-reports', menus: ['lessonReports'] },
  { prefix: '/api/admin/migrations', menus: [] },
  { prefix: '/api/admin/payments/plans', menus: ['payments', 'invoices'], methods: ['GET'] },
  { prefix: '/api/admin/payments/periods', menus: ['payments', 'invoices'] },
  { prefix: '/api/admin/payments/registration', menus: ['payments', 'invoices'] },
  { prefix: '/api/admin/payments/send-reminders', menus: ['payments', 'invoices'] },
  { prefix: '/api/admin/payments/stop', menus: ['payments', 'invoices'] },
  { prefix: '/api/admin/payments/pricing', menus: ['payments'] },
  { prefix: '/api/admin/payments', menus: ['payments'] },
  { prefix: '/api/admin/rebalance-all', menus: ['reports'] },
  { prefix: '/api/admin/reports', menus: ['reports'] },
  { prefix: '/api/admin/sessions/today', menus: ['classes', 'whatsapp', 'settings'] },
  { prefix: '/api/admin/sessions', menus: ['classes'] },
  { prefix: '/api/admin/software', menus: ['software', 'curriculum', 'ekskul'], methods: ['GET'] },
  { prefix: '/api/admin/software', menus: ['software'] },
  { prefix: '/api/admin/users', menus: ['users'] },
  { prefix: '/api/admin/whatsapp/send', menus: ['whatsapp', 'invoices'] },
  { prefix: '/api/admin/whatsapp', menus: ['whatsapp', 'settings'] },

  { prefix: '/api/ccr', menus: ['ccr', 'ccrlist'] },
  { prefix: '/api/clean-evals', menus: ['evaluations'] },
  { prefix: '/api/invoices/settings', menus: ['settings', 'invoices', 'whatsapp'] },
  { prefix: '/api/invoices', menus: ['invoices'] },
  { prefix: '/api/whatsapp/send', menus: null, exact: true },
  { prefix: '/api/whatsapp', menus: ['whatsapp', 'settings', 'invoices'] },
];

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

function matchesPathPrefix(pathname: string, prefix: string, exact = false): boolean {
  if (exact) {
    return pathname === prefix;
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/banners') ||
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
  // Check public prefixes (like /invoice/*)
  if (PUBLIC_PREFIXES.some(prefix => matchesPathPrefix(pathname, prefix))) {
    return true;
  }
  return PUBLIC_PATHS.has(pathname);
}

function normalizeRole(role: unknown): Role | null {
  if (typeof role !== 'string') {
    return null;
  }
  const upper = role.toUpperCase();
  if (upper === 'ADMIN' || upper === 'COACH' || upper === 'CODER') {
    return upper as Role;
  }
  if (role.toLowerCase() === 'superadmin') {
    return 'ADMIN';
  }
  return null;
}

function parseAdminPermissions(value: unknown): AdminPermissions {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const permissions = value as { menus?: unknown; is_superadmin?: unknown };
  return {
    menus: Array.isArray(permissions.menus)
      ? permissions.menus.filter((menu): menu is string => typeof menu === 'string')
      : [],
    is_superadmin: permissions.is_superadmin === true,
  };
}

function isSuperAdmin(username: string, permissions: AdminPermissions): boolean {
  return username === 'admin' || permissions === null || permissions?.is_superadmin === true;
}

function getAdminAccessMenus(pathname: string, method: string): AdminMenuId[] | null | undefined {
  const rule = ADMIN_ACCESS_RULES.find((candidate) => {
    const methodAllowed = !candidate.methods || candidate.methods.includes(method);
    return methodAllowed && matchesPathPrefix(pathname, candidate.prefix, candidate.exact);
  });
  if (rule) {
    return rule.menus;
  }
  if (pathname === '/admin' || pathname === '/api/admin') {
    return null;
  }
  if (matchesPathPrefix(pathname, '/admin') || matchesPathPrefix(pathname, '/api/admin')) {
    return [];
  }
  return undefined;
}

function canAccessAdminMenus(user: MiddlewareUser, menus: AdminMenuId[] | null): boolean {
  if (menus === null) {
    return true;
  }
  if (isSuperAdmin(user.username, user.adminPermissions)) {
    return true;
  }
  if (menus.length === 0) {
    return false;
  }
  const allowedMenus = user.adminPermissions?.menus ?? [];
  return menus.some((menu) => allowedMenus.includes(menu));
}

async function fetchMiddlewareUser(token: Record<string, unknown>): Promise<MiddlewareUser | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[middleware] Supabase credentials missing; refusing protected request.');
    return null;
  }

  const userId = typeof token.userId === 'string'
    ? token.userId
    : typeof token.sub === 'string'
      ? token.sub
      : null;
  const username = typeof token.username === 'string' ? token.username : null;
  const lookup = userId
    ? `id=eq.${encodeURIComponent(userId)}`
    : username
      ? `username=eq.${encodeURIComponent(username)}`
      : null;

  if (!lookup) {
    return null;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/users?select=id,username,role,is_active,admin_permissions&${lookup}&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    console.error('[middleware] Failed to refresh auth user', response.status);
    return null;
  }

  const rows = (await response.json()) as Array<{
    id?: unknown;
    username?: unknown;
    role?: unknown;
    is_active?: unknown;
    admin_permissions?: unknown;
  }>;
  const user = rows[0];
  const role = normalizeRole(user?.role);

  if (!user || typeof user.id !== 'string' || typeof user.username !== 'string' || !role) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role,
    isActive: user.is_active === true,
    adminPermissions: parseAdminPermissions(user.admin_permissions),
  };
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

  if (isPublicPath(pathname) && pathname !== '/login') {
    return NextResponse.next();
  }

  const user = await fetchMiddlewareUser(token as Record<string, unknown>);
  if (!user || !user.isActive) {
    return buildUnauthorizedResponse(request);
  }

  const role = user.role;

  for (const guard of ROLE_GUARDS) {
    if (guard.test(pathname) && (!role || !guard.roles.includes(role))) {
      return buildForbiddenResponse(request, role);
    }
  }

  const requiredAdminMenus = getAdminAccessMenus(pathname, request.method);
  if (requiredAdminMenus !== undefined) {
    if (role !== 'ADMIN' || !canAccessAdminMenus(user, requiredAdminMenus)) {
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
