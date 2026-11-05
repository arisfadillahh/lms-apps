import type { Role } from '@/types/supabase';

export function getRoleDashboardPath(role: Role, user?: { username?: string; adminPermissions?: { menus?: string[]; is_superadmin?: boolean } | null }): string {
  const permissions = user?.adminPermissions;
  if (role === 'ADMIN' && user?.username !== 'admin' && permissions && !permissions.is_superadmin) {
    const menus = [...new Set((permissions.menus ?? []).filter(m => m !== 'dashboard'))];
    if (menus.length === 1 && menus[0] === 'coachAttendance') return '/admin/coach-attendance';
    if (menus.length === 1 && menus[0] === 'payroll') return '/admin/payroll';
  }
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
