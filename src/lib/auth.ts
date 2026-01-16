import 'server-only';

import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/authOptions';
import type { Role } from '@/types/supabase';
import type { Session } from 'next-auth';

export type AppSession = Session & {
  user: {
    id: string;
    username: string;
    fullName: string;
    role: Role;
    isActive: boolean;
    adminPermissions?: { menus: string[]; is_superadmin: boolean } | null;
  };
};

export { hashPassword, verifyPassword } from '@/lib/passwords';

const VALID_ROLES: Role[] = ['ADMIN', 'COACH', 'CODER'];

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && (VALID_ROLES as string[]).includes(value);
}

export async function getServerAuthSession(): Promise<AppSession | null> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return null;
  }

  const role = (session.user as Record<string, unknown> | undefined)?.role;
  if (!isValidRole(role)) {
    return null;
  }

  return session as AppSession;
}

export async function getSessionOrThrow(): Promise<AppSession> {
  const session = await getServerAuthSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  if (!session.user.isActive) {
    throw new Error('Inactive account');
  }
  return session;
}

export function getSessionRole(session: AppSession | null): Role | null {
  return session?.user?.role ?? null;
}

export async function getServerSessionRole(): Promise<Role | null> {
  const session = await getServerAuthSession();
  return session?.user.role ?? null;
}
