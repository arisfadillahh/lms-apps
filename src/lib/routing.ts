import type { Role } from '@/types/supabase';

export function getRoleDashboardPath(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'COACH':
      return '/coach/dashboard';
    case 'CODER':
      return '/coder/dashboard';
    default:
      return '/login';
  }
}
