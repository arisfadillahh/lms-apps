import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), command: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.session }));
vi.mock('@/lib/services/payrollCommands', () => ({ executePayrollCommand: mocks.command }));
import { PATCH } from '@/app/api/admin/classes/[id]/payroll-mode/route';

const id = '20000000-0000-4000-8000-000000000001';
const request = (mode = 'MITRA', classId = id) => PATCH(new Request('http://localhost/api/admin/classes/placeholder/payroll-mode', { method: 'PATCH', body: JSON.stringify({ mode, classId: 'injected' }) }), { params: Promise.resolve({ id: classId }) });
describe('class-owned teaching mode', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'actor', username: 'operator', role: 'ADMIN', isActive: true, adminPermissions: { is_superadmin: false, menus: ['classes'] } } }); });
  it('uses the immutable route ID and the audited command for class operators', async () => {
    expect((await request('FULLTIME')).status).toBe(200);
    expect(mocks.command).toHaveBeenCalledWith({ action: 'classMode', classId: id, mode: 'FULLTIME' }, 'actor');
  });
  it('rejects invalid mode and IDs before writing', async () => {
    expect((await request('INVALID')).status).toBe(400); expect((await request('MITRA', 'other')).status).toBe(400); expect(mocks.command).not.toHaveBeenCalled();
  });
  it('denies unauthenticated, inactive, coach and admins without class access', async () => {
    for (const user of [null, { role: 'ADMIN', isActive: false }, { role: 'COACH', isActive: true }, { role: 'ADMIN', isActive: true, username: 'finance', adminPermissions: { is_superadmin: false, menus: ['payroll'] } }]) {
      mocks.session.mockResolvedValue(user ? { user } : null); expect([401, 403]).toContain((await request()).status);
    }
    expect(mocks.command).not.toHaveBeenCalled();
  });
});
