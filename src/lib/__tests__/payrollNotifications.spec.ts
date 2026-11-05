import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ db: vi.fn(), notify: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: mocks.db }));
vi.mock('@/lib/dao/notificationsDao', () => ({ createNotification: mocks.notify }));
import { createPayrollAdminNotifications, createAttendanceAdminNotifications, attendanceAdmins } from '@/lib/services/payrollNotifications';
describe('payroll admin notification permissions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('excludes limited admins without payroll access from correction details', async () => {
    mocks.db.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [
      { id: 'a1', username: 'admin', admin_permissions: null },
      { id: 'a2', username: 'academic', admin_permissions: { menus: ['classes'], is_superadmin: false } },
      { id: 'a3', username: 'finance', admin_permissions: { menus: ['payroll'], is_superadmin: false } },
    ] }) }) }) }) });
    expect(await createPayrollAdminNotifications({ title: 'Koreksi gaji', message: 'Private correction' })).toBe(2);
    expect(mocks.notify.mock.calls.map(c => c[0])).toEqual(['a1', 'a3']);
  });
  it('routes attendance to admin/coach lead PICs, while finance remains outside the default operational queue', async () => {
    mocks.db.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [
      { id: 'admin', username: 'admin', admin_permissions: null },
      { id: 'lead', username: 'lead', admin_permissions: { menus: ['coachAttendance'], is_superadmin: false } },
      { id: 'finance', username: 'finance', admin_permissions: { menus: ['payroll'], is_superadmin: false } },
    ] }) }) }) }) });
    expect((await attendanceAdmins()).map(a => a.id)).toEqual(['admin', 'lead']);
    await createAttendanceAdminNotifications({ title: 'Koreksi absensi', message: 'Aktivitas belum tercatat' }, 'lead');
    expect(mocks.notify.mock.calls.map(c => c[0])).toEqual(['lead']); mocks.notify.mockClear();
    await createAttendanceAdminNotifications({ title: 'Koreksi absensi', message: 'Perlu PIC operasional' }, 'finance');
    expect(mocks.notify.mock.calls.map(c => c[0])).toEqual(['admin', 'lead']);
  });
});
