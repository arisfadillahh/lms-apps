import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPeriod } from '@/lib/payroll/model';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ config: vi.fn(), ensure: vi.fn(), calculate: vi.fn(), notify: vi.fn() }));
vi.mock('@/lib/dao/payrollDao', () => ({ getPayrollConfig: mocks.config, ensurePayrollPeriod: mocks.ensure }));
vi.mock('@/lib/services/payroll', () => ({ calculatePayroll: mocks.calculate }));
vi.mock('@/lib/services/payrollNotifications', () => ({ createPayrollAdminNotifications: mocks.notify }));
import { syncSubmittedTrialPayroll, syncPaidTrialGoalPayroll } from '@/lib/services/payrollTrialSync';
describe('submitted trial assessment immediately reconciles attendance', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.config.mockResolvedValue({ settings: { active_from: '2026-01-01' } }); mocks.ensure.mockResolvedValue({ id: '2026-11', revision: 0, document: createPeriod(2026, 11) }); mocks.calculate.mockResolvedValue(undefined); mocks.notify.mockResolvedValue(undefined); });
  it('does nothing before payroll activation or without a scheduled session', async () => {
    mocks.config.mockResolvedValue({ settings: { active_from: null } });
    await syncSubmittedTrialPayroll('t1', null); await syncSubmittedTrialPayroll('t1', '2026-11-25T20:00:00+07:00');
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it('uses the session date period including late evening of the 25th', async () => {
    await syncSubmittedTrialPayroll('t1', '2026-11-25T20:00:00+07:00');
    expect(mocks.ensure).toHaveBeenCalledWith(2026, 11); expect(mocks.calculate).toHaveBeenCalledTimes(1);
  });
  it('preserves finalized slips and tells authorized admin to review a late assessment', async () => {
    mocks.ensure.mockResolvedValue({ id: '2026-11', revision: 1, document: { ...createPeriod(2026, 11), status: 'FINAL' } });
    await syncSubmittedTrialPayroll('t1', '2026-11-25T20:00:00+07:00');
    expect(mocks.calculate).not.toHaveBeenCalled(); expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ actionUrl: '/admin/payroll?period=2026-11' }));
  });
  it('places paid trial bonus in payment period and repeats a reconciliation safely', async () => {
    await syncPaidTrialGoalPayroll('invoice1', '2026-11-26T00:00:00+07:00');
    await syncPaidTrialGoalPayroll('invoice1', '2026-11-26T00:00:00+07:00');
    expect(mocks.ensure).toHaveBeenCalledWith(2026, 12); expect(mocks.calculate).toHaveBeenCalledTimes(2);
  });
  it('does not mutate final paid periods on a delayed invoice callback', async () => {
    mocks.ensure.mockResolvedValue({ document: { ...createPeriod(2026, 11), status: 'FINAL', pic_id: 'finance' } });
    await syncPaidTrialGoalPayroll('invoice1', '2026-11-25T23:59:59+07:00');
    expect(mocks.calculate).not.toHaveBeenCalled(); expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: 'payroll-late-goal:invoice1:2026-11' }), 'finance');
  });
});
