
import type { AppSession } from '@/lib/auth';
import type { Role } from '@/types/supabase';

export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

function normalizeRoles(allowed: Role | Role[]): Role[] {
  return Array.isArray(allowed) ? allowed : [allowed];
}

export async function assertRole(session: AppSession | null, allowed: Role | Role[]): Promise<AppSession> {
  if (!session) {
    throw new AuthorizationError('Unauthenticated');
  }
  const allowedRoles = normalizeRoles(allowed);
  if (!allowedRoles.includes(session.user.role)) {
    throw new AuthorizationError(
      `Role ${session.user.role} is not permitted. Allowed: ${allowedRoles.join(', ')}`,
    );
  }
  return session;
}

export async function assertActive(session: AppSession | null): Promise<AppSession> {
  if (!session) {
    throw new AuthorizationError('Unauthenticated');
  }
  if (!session.user.isActive) {
    throw new AuthorizationError('Account inactive');
  }
  return session;
}

export { assertRole, assertActive };
