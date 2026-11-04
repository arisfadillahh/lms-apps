import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ db: vi.fn(), notify: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: mocks.db }));
vi.mock('@/lib/dao/notificationsDao', () => ({ createNotification: mocks.notify }));
import { createPayrollAdminNotifications } from '@/lib/services/payrollNotifications';
describe('payroll admin notification permissions', () => {
  it('excludes limited admins without payroll access from correction details', async () => {
    mocks.db.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [
      { id: 'a1', username: 'admin', admin_permissions: null },
      { id: 'a2', username: 'academic', admin_permissions: { menus: ['classes'], is_superadmin: false } },
      { id: 'a3', username: 'finance', admin_permissions: { menus: ['payroll'], is_superadmin: false } },
    ] }) }) }) }) });
    expect(await createPayrollAdminNotifications({ title: 'Koreksi gaji', message: 'Private correction' })).toBe(2);
    expect(mocks.notify.mock.calls.map(c => c[0])).toEqual(['a1', 'a3']);
  });
});
