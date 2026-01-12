import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifyPassword } from '@/lib/passwords';
import { normalizeLocalhostUrl } from '@/lib/runtimeUrl';
import type { TablesRow } from '@/types/supabase';
import type { Role } from '@/types/supabase';

type UserRecord = Pick<
  TablesRow<'users'>,
  'id' | 'username' | 'password_hash' | 'full_name' | 'role' | 'is_active'
>;

const normalizedNextAuthUrl = normalizeLocalhostUrl(process.env.NEXTAUTH_URL);
if (normalizedNextAuthUrl) {
  process.env.NEXTAUTH_URL = normalizedNextAuthUrl;
}

const normalizedPublicAppUrl = normalizeLocalhostUrl(process.env.NEXT_PUBLIC_APP_URL);
if (normalizedPublicAppUrl) {
  process.env.NEXT_PUBLIC_APP_URL = normalizedPublicAppUrl;
}

const nextAuthSecret = process.env.NEXTAUTH_SECRET;
if (!nextAuthSecret) {
  throw new Error('Missing NEXTAUTH_SECRET environment variable');
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password ?? '';

        if (!username || !password) {
          return null;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
          const fallback = findDevFallbackUser(username, password);
          if (fallback) {
            return fallback;
          }
          console.warn(
            '[auth] Supabase credentials missing; rejected login for user',
            username,
          );
          return null;
        }

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from('users')
          .select('id, username, password_hash, full_name, role, is_active')
          .eq('username', username)
          .maybeSingle();

        if (error) {
          console.error('Failed to fetch user during authorize', error);
          throw new Error('Unable to sign in');
        }

        const user = (data ?? null) as UserRecord | null;
        if (!user) {
          const fallback = findDevFallbackUser(username, password);
          if (fallback) {
            return fallback;
          }
          return null;
        }

        if (!user.is_active) {
          throw new Error('Account inactive. Contact administrator.');
        }

        const passwordValid = await verifyPassword(password, user.password_hash);
        if (!passwordValid) {
          return null;
        }

        const normalizedRole = normalizeRole(user.role);
        if (!normalizedRole) {
          console.warn(
            '[auth] User role is not supported',
            user.role,
            'for user',
            user.username,
          );
          return null;
        }

        return {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: normalizedRole,
          isActive: user.is_active,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const typedUser = user as {
          id: string;
          username: string;
          fullName: string;
          role: Role;
          isActive: boolean;
        };
        token.userId = typedUser.id;
        token.username = typedUser.username;
        token.role = typedUser.role;
        token.fullName = typedUser.fullName;
        token.isActive = typedUser.isActive;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) {
        session.user = {} as typeof session.user;
      }

      session.user.id = (token.userId as string) ?? '';
      session.user.username = (token.username as string) ?? '';
      session.user.role = token.role as Role;
      session.user.fullName = (token.fullName as string) ?? '';
      session.user.isActive = Boolean(token.isActive);

      return session;
    },
  },
  secret: nextAuthSecret,
};

type FallbackUser = {
  id: string;
  username: string;
  password: string;
  role: Role;
  fullName: string;
  isActive?: boolean;
};

const FALLBACK_USERS: FallbackUser[] = [
  {
    id: 'dev-admin',
    username: process.env.DEV_ADMIN_USERNAME ?? 'admin',
    password: process.env.DEV_ADMIN_PASSWORD ?? 'admin123',
    role: 'ADMIN',
    fullName: 'Demo Admin',
  },
  {
    id: 'e52e909d-0925-460d-88f6-592a8325d70f',
    username: process.env.DEV_COACH_USERNAME ?? 'coach',
    password: process.env.DEV_COACH_PASSWORD ?? 'coach123',
    role: 'COACH',
    fullName: 'Demo Coach',
  },
  {
    id: 'dev-coder',
    username: process.env.DEV_CODER_USERNAME ?? 'coder',
    password: process.env.DEV_CODER_PASSWORD ?? 'coder123',
    role: 'CODER',
    fullName: 'Demo Coder',
  },
];

function findFallbackUser(username: string, password: string) {
  const user = FALLBACK_USERS.find(
    (entry) => entry.username === username && entry.password === password,
  );
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive ?? true,
  };
}

const ROLE_ALIASES: Record<string, Role> = {
  superadmin: 'ADMIN',
};

function normalizeRole(role: string): Role | null {
  if (!role) {
    return null;
  }
  if (typeof role !== 'string') {
    return null;
  }
  const upper = role.toUpperCase();
  if (upper === 'ADMIN' || upper === 'COACH' || upper === 'CODER') {
    return upper as Role;
  }
  const alias = ROLE_ALIASES[role.toLowerCase()];
  return alias ?? null;
}

function findDevFallbackUser(username: string, password: string) {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return findFallbackUser(username, password);
}
