import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ find: vi.fn(), detail: vi.fn(), update: vi.fn(), invoice: vi.fn(), sync: vi.fn() }));
vi.mock('@/lib/dao/trialAssessmentsDao', () => ({ findAssessmentByInvoiceId: m.find, getAssessmentWithRelations: m.detail, updateAssessment: m.update }));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceById: m.invoice }));
vi.mock('@/lib/services/payrollTrialSync', () => ({ syncPaidTrialGoalPayroll: m.sync }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('@/lib/services/invoicePublicAccess', () => ({ buildInvoicePublicUrl: vi.fn() }));
import { markTrialConversionPaidFromInvoice } from '@/lib/services/trialConversion';

describe('existing trial invoice confirmation feeds payroll', () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.find.mockResolvedValue({ id: 'a', status: 'PUBLISHED', pricing_id: 'p' });
    m.detail.mockResolvedValue({ trial: { student_name: 'Anak', parent_name: 'Ortu', phone: '0800' }, recommended_level: { name: 'L1' } });
    m.invoice.mockResolvedValue({ status: 'PAID', invoice_number: 'I', total_amount: 1000000 });
    m.update.mockResolvedValue({}); m.sync.mockResolvedValue(undefined);
  });
  it('synchronizes only after payment confirmation is persisted', async () => {
    const r = await markTrialConversionPaidFromInvoice('invoice', '2026-11-25T23:00:00+07:00');
    expect(r.updated).toBe(true); expect(m.sync).toHaveBeenCalledWith('invoice', '2026-11-25T23:00:00+07:00');
    expect(m.update.mock.invocationCallOrder[0]).toBeLessThan(m.sync.mock.invocationCallOrder[0]);
  });
  it('rejects an unpaid invoice before any bonus sync', async () => {
    m.invoice.mockResolvedValue({ status: 'PENDING' });
    await expect(markTrialConversionPaidFromInvoice('invoice', '2026-11-25')).rejects.toThrow(/lunas/);
    expect(m.sync).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it('repeated callbacks reconcile using the original payment date', async () => {
    m.find.mockResolvedValue({ id: 'a', status: 'PAID', payment_confirmed_at: '2026-11-25T23:00:00+07:00' });
    expect((await markTrialConversionPaidFromInvoice('invoice', '2026-11-26')).updated).toBe(false);
    expect(m.sync).toHaveBeenCalledWith('invoice', '2026-11-25T23:00:00+07:00'); expect(m.update).not.toHaveBeenCalled();
  });
  it('keeps successful payment confirmation when payroll is temporarily unavailable', async () => {
    m.sync.mockRejectedValue(new Error('Temporary conflict')); const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { expect((await markTrialConversionPaidFromInvoice('invoice', '2026-11-25')).updated).toBe(true); } finally { log.mockRestore(); }
  });
});
