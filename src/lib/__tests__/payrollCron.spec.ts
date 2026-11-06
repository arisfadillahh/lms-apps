import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPeriod } from '@/lib/payroll/model';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ config: vi.fn(), ensure: vi.fn(), calculate: vi.fn(), send: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/dao/payrollDao', () => ({ getPayrollConfig: mocks.config, ensurePayrollPeriod: mocks.ensure }));
vi.mock('@/lib/services/payroll', () => ({ calculatePayroll: mocks.calculate }));
vi.mock('@/lib/services/payrollDelivery', () => ({ sendPayrollBatch: mocks.send }));
vi.mock('@/lib/services/payrollSourceSync', () => ({ refreshPayrollSource: mocks.refresh }));
import { runPayrollCron } from '@/lib/services/payrollCron';
describe('payroll cutoff automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.mockResolvedValue({ settings: { automation_enabled: true, active_from: '2026-01-01' }, people: [{ id: 'p1', kind: 'COACH', active: true }, { id: 'p2', kind: 'STAFF', active: true }] });
    mocks.ensure.mockImplementation(async (y, m) => ({ id: createPeriod(y, m).id, revision: 1, document: { ...createPeriod(y, m), slips: [{ kind: 'COACH', profile_id: 'p1' }, { kind: 'STAFF', profile_id: 'p2' }] } }));
    mocks.calculate.mockImplementation(async r => r); mocks.refresh.mockImplementation(async r => r); mocks.send.mockResolvedValue([]);
  });
  it('does nothing until admin enables automation', async () => {
    mocks.config.mockResolvedValue({ settings: { automation_enabled: false }, people: [] });
    await runPayrollCron(new Date('2026-11-25T09:00:00+07:00'));
    expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('calculates before 09:00 WIB without sending a premature recap', async () => {
    await runPayrollCron(new Date('2026-11-25T08:59:00+07:00'));
    expect(mocks.calculate).toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('sends coach recap at 09:00 WIB using profile IDs', async () => {
    await runPayrollCron(new Date('2026-11-25T09:00:00+07:00'));
    expect(mocks.send).toHaveBeenCalledWith('2026-11', ['p1'], 'RECAP', null);
    expect(mocks.send).toHaveBeenCalledWith('2026-11', ['p2'], 'REIMBURSEMENT', null);
  });
  it('adds the firm deadline reminder at 16:00 WIB', async () => {
    await runPayrollCron(new Date('2026-11-25T16:00:00+07:00'));
    expect(mocks.send).toHaveBeenCalledWith('2026-11', ['p1'], 'REMINDER', null);
  });
  it('still calculates the 25th after 17:00 without reopening coach corrections', async () => {
    await runPayrollCron(new Date('2026-11-25T23:59:00+07:00'));
    expect(mocks.ensure).toHaveBeenCalledWith(2026, 11); expect(mocks.calculate).toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('starts a separate December period on November 26 without resetting history', async () => {
    await runPayrollCron(new Date('2026-11-26T00:00:00+07:00'));
    expect(mocks.ensure).toHaveBeenCalledWith(2026, 12); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('excludes inactive or removed coach profiles and staff from automatic attendance messages', async () => {
    mocks.config.mockResolvedValue({ settings: { automation_enabled: true, active_from: '2026-01-01' }, people: [{ id: 'p1', kind: 'COACH', active: false }, { id: 'p2', kind: 'STAFF', active: true }] });
    await runPayrollCron(new Date('2026-11-25T16:00:00+07:00'));
    expect(mocks.send).toHaveBeenCalledWith('2026-11', [], 'RECAP', null);
    expect(mocks.send).toHaveBeenCalledWith('2026-11', [], 'REMINDER', null);
  });
  it('does not begin automation before its configured activation date', async () => {
    mocks.config.mockResolvedValue({ settings: { automation_enabled: true, active_from: '2026-11-26' }, people: [{ id: 'p1', kind: 'COACH', active: true }] });
    await runPayrollCron(new Date('2026-11-25T09:00:00+07:00'));
    expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('still sends reimbursement to coach whose meeting dates need completion, without fabricating an attendance recap',async()=>{
    mocks.send.mockImplementation(async(_p,_ids,kind)=>kind==='RECAP'?[{profileId:'p1',status:'FAILED',error:'Rekap belum dapat dikirim: 2 aktivitas belum memiliki tanggal dan nama kelas.'}]:[]);
    await runPayrollCron(new Date('2026-11-25T09:00:00+07:00'));
    expect(mocks.send).toHaveBeenCalledWith('2026-11',['p2','p1'],'REIMBURSEMENT',null);
  });
  it('refreshes current synchronized numbers before delivery, at most hourly, and never sends when refresh fails',async()=>{
    const p=createPeriod(2026,11);const record={id:p.id,revision:1,document:{...p,legacy_imports:[{}],slips:[]}};
    mocks.ensure.mockResolvedValue(record);
    await runPayrollCron(new Date('2026-11-25T09:00:00+07:00'));expect(mocks.refresh).toHaveBeenCalledWith(record,null,expect.any(Date));
    vi.clearAllMocks();mocks.ensure.mockResolvedValue({...record,document:{...record.document,source_refreshed_at:'2026-11-25T08:50:00+07:00'}});
    await runPayrollCron(new Date('2026-11-25T09:00:00+07:00'));expect(mocks.refresh).not.toHaveBeenCalled();expect(mocks.calculate).toHaveBeenCalled();
    vi.clearAllMocks();mocks.ensure.mockResolvedValue(record);mocks.refresh.mockRejectedValue(new Error('Refresh failed'));
    await expect(runPayrollCron(new Date('2026-11-25T09:00:00+07:00'))).rejects.toThrow('Refresh failed');expect(mocks.send).not.toHaveBeenCalled();
  });
});
