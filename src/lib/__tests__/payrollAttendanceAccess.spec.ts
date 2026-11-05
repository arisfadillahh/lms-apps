import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '@/lib/auth';
import { createPeriod, type PeriodRecord, type Slip } from '@/lib/payroll/model';
import { attendancePeriodView } from '@/lib/payroll/attendanceView';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ config: vi.fn(), period: vi.fn(), command: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getServerAuthSession: vi.fn() }));
vi.mock('@/lib/dao/payrollDao', () => ({ getPayrollConfig: m.config, getPayrollPeriod: m.period }));
vi.mock('@/lib/services/payrollCommands', () => ({ executePayrollCommand: m.command }));
vi.mock('@/lib/services/payrollNotifications', () => ({ attendanceAdmins: vi.fn() }));
import { isAttendanceAdmin, isPayrollAdmin, canReadSlip } from '@/lib/payroll/access';
import { parseAttendanceCommand, executeAttendanceCommand } from '@/lib/services/payrollAttendance';

const id = '20000000-0000-4000-8000-000000000001';
const session = (menus: string[] | null, role: 'ADMIN' | 'COACH' = 'ADMIN'): AppSession => ({ expires: '2099-01-01', user: { id: 'lead', username: 'limited', fullName: 'Lead', role, isActive: true, adminPermissions: menus ? { menus, is_superadmin: false } : null } });
const slip: Slip = { profile_id: id, user_id: 'coach', name: 'Coach', job_title: '', kind: 'COACH', contract: 'MITRA', total: 999999, lines: [{ key: 'session:s', date: '2026-11-03', kind: 'WEEKLY', label: 'Kelas', quantity: 1, rate: 70000, amount: 999999, details: 'Private rate 999999' }, { key: 'goal', date: '2026-11-03', kind: 'GOAL', label: 'Goal', quantity: 1, rate: 100000, amount: 100000, details: '' }] };
const record = (): PeriodRecord => ({ id: '2026-11', revision: 3, document: { ...createPeriod(2026, 11), slips: [slip], overrides: { 'session:s': { amount: 999999, reason: 'Financial override' } } } });
describe('attendance responsibility and finance exception access', () => {
  beforeEach(() => { vi.clearAllMocks(); m.config.mockResolvedValue({ people: [{ id, user_id: 'coach', kind: 'COACH', active: true }] }); m.period.mockResolvedValue(record()); m.command.mockResolvedValue({ secretSalary: 999999 }); });
  it('allows admin and coach lead to correct attendance; finance keeps exception access', () => {
    for (const s of [session(null), session(['coachAttendance']), session(['payroll'])]) expect(isAttendanceAdmin(s)).toBe(true);
    expect(isAttendanceAdmin(session(['classes']))).toBe(false); expect(isAttendanceAdmin(session(['coachAttendance'], 'COACH'))).toBe(false);
    expect(isPayrollAdmin(session(['coachAttendance']))).toBe(false); expect(canReadSlip(session(['coachAttendance']), slip)).toBe(false);
    expect(isPayrollAdmin(session(['payroll']))).toBe(true);
  });
  it('allowlists operational read fields without leaking salary, goals or transfer history', () => {
    const p = record(); p.document.manual = [{ id: 'private', profile_id: id, date: '2026-11-02', label: 'Salary adjustment', amount: 1234567, reason: 'Secret' }];
    const view = attendancePeriodView(p), encoded = JSON.stringify(view);
    expect(view.activities).toHaveLength(1); expect(encoded).not.toMatch(/999999|1234567|amount|rate|total|salary|transfers|history|GOAL|Financial|Private/);
  });
  it('blocks financial actions and amount injection through the attendance endpoint', () => {
    for (const raw of [
      { action: 'transfer', profileIds: [id] }, { action: 'finalize' }, { action: 'component', profileId: id, date: '2026-11-03', label: 'Extra', amount: 100, reason: 'Bypass check' },
      { action: 'override', sourceKey: 'session:s', amount: 100, reason: 'Bypass check' },
    ]) expect(() => parseAttendanceCommand({ periodId: '2026-11', revision: 3, ...raw })).toThrow(/hanya untuk aktivitas/);
  });
  it('preserves an existing financial override during operational corrections and never returns command salary data', async () => {
    const result = await executeAttendanceCommand({ action: 'override', periodId: '2026-11', revision: 3, sourceKey: 'session:s', profileId: id, excluded: false, reason: 'Pengganti sudah dikonfirmasi' }, 'lead');
    expect(m.command).toHaveBeenCalledWith(expect.objectContaining({ amount: 999999, profileId: id }), 'lead'); expect(result).toEqual({ success: true });
  });
  it('rejects bonus and non-coach sources before invoking any mutation', async () => {
    await expect(executeAttendanceCommand({ action: 'override', periodId: '2026-11', revision: 3, sourceKey: 'goal', reason: 'Attempt bonus change' }, 'lead')).rejects.toThrow(/Aktivitas coach/);
    await expect(executeAttendanceCommand({ action: 'activity', periodId: '2026-11', revision: 3, profileId: '20000000-0000-4000-8000-000000000004', date: '2026-11-03', kind: 'EVENT', mode: 'MITRA', label: 'Staff activity', reason: 'Attempt staff change' }, 'lead')).rejects.toThrow(/coach aktif/);
    expect(m.command).not.toHaveBeenCalled();
  });
});
