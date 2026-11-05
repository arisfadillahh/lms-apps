import { describe, expect, it, vi } from 'vitest';
import { getRoleDashboardPath } from '@/lib/routing';
vi.mock('@/lib/auth', () => ({ getServerAuthSession: vi.fn(async () => ({ user: { id: 'lead' } })) }));
vi.mock('@/lib/dao', () => ({ usersDao: { getUserById: vi.fn(async () => ({ role: 'ADMIN', username: 'lead', admin_permissions: { menus: ['coachAttendance'], is_superadmin: false } })) } }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error('NAVIGATE ' + path); } }));
vi.mock('@/app/(public)/login/LoginForm', () => ({ default: () => null }));
import LoginPage from '@/app/(public)/login/page';
describe('first visit for dedicated payroll team accounts', () => {
  const user = (menus: string[]) => ({ username: 'team', adminPermissions: { menus, is_superadmin: false } });
  it('opens the only assigned workspace directly after login', () => {
    expect(getRoleDashboardPath('ADMIN', user(['coachAttendance']))).toBe('/admin/coach-attendance');
    expect(getRoleDashboardPath('ADMIN', user(['dashboard', 'payroll']))).toBe('/admin/payroll');
  });
  it('preserves the normal dashboard for full admins, other duties and ordinary coaches', () => {
    expect(getRoleDashboardPath('ADMIN')).toBe('/admin/dashboard');
    expect(getRoleDashboardPath('ADMIN', { username: 'admin', adminPermissions: user(['payroll']).adminPermissions })).toBe('/admin/dashboard');
    expect(getRoleDashboardPath('ADMIN', user(['payroll', 'classes']))).toBe('/admin/dashboard');
    expect(getRoleDashboardPath('ADMIN', user(['classes']))).toBe('/admin/dashboard');
    expect(getRoleDashboardPath('COACH', user(['coachAttendance']))).toBe('/coach/dashboard');
  });
  it('lets the authenticated login-page redirect propagate instead of rendering the form again', async () => {
    await expect(LoginPage({})).rejects.toThrow('NAVIGATE /admin/coach-attendance');
  });
});
