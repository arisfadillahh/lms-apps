import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPeriod, type PeriodRecord, type PayrollPerson } from '@/lib/payroll/model';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ get: vi.fn(), commit: vi.fn(), config: vi.fn(), db: vi.fn(), notify: vi.fn(), admins: vi.fn(), wa: vi.fn(), text: vi.fn(), pdf: vi.fn() }));
vi.mock('@/lib/dao/payrollDao', () => ({ getPayrollPeriod: mocks.get, commitPayrollPeriod: mocks.commit, getPayrollConfig: mocks.config }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: mocks.db }));
vi.mock('@/lib/dao/notificationsDao', () => ({ createNotification: mocks.notify }));
vi.mock('@/lib/services/payrollNotifications', () => ({ createPayrollAdminNotifications: mocks.admins }));
vi.mock('@/lib/services/whatsappClient', () => ({ sendWhatsAppDocument: mocks.wa, sendWhatsAppMessage: mocks.text }));
vi.mock('@/lib/pdf/generatePayrollPdf', () => ({ generatePayrollPdf: mocks.pdf }));
import { sendPayrollBatch } from '@/lib/services/payrollDelivery';

describe('private payroll delivery, transfer gating and retries', () => {
  let record: PeriodRecord;
  let profile: PayrollPerson;
  let phone: string | null;
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks(); vi.unstubAllEnvs();
    record = { id: '2026-10', revision: 1, document: createPeriod(2026, 10) };
    record.document.calculated_at = '2026-10-26T00:00:00Z';
    record.document.slips = [{ profile_id: 'p1', user_id: 'u1', kind: 'COACH', name: 'Coach', job_title: 'Coach', contract: 'MITRA', total: 100000, lines: [] }];
    profile = { id: 'p1', user_id: 'u1', kind: 'COACH', name: 'Coach', job_title: 'Coach', staff_phone: null, active: true };
    phone = '628123456789';
    mocks.get.mockImplementation(async () => structuredClone(record));
    mocks.commit.mockImplementation(async (_old, document) => { record = { ...record, revision: record.revision + 1, document: structuredClone(document) }; return record; });
    mocks.config.mockImplementation(async () => ({ people: [profile] }));
    mocks.db.mockImplementation(() => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'u1', role: 'COACH', is_active: true, parent_contact_phone: phone } }) }) }) }) }));
    mocks.notify.mockResolvedValue(undefined); mocks.admins.mockResolvedValue(undefined);
    mocks.pdf.mockResolvedValue(Buffer.from('%PDF-test')); mocks.wa.mockResolvedValue({ success: true }); mocks.text.mockResolvedValue({ success: true });
  });
  it('blocks slip before finalization and actual transfer, without notification or WA', async () => {
    expect((await sendPayrollBatch(record.id, ['p1'], 'SLIP', 'admin'))[0].status).toBe('FAILED');
    record.document.status = 'FINAL';
    expect((await sendPayrollBatch(record.id, ['p1'], 'SLIP', 'admin'))[0].status).toBe('FAILED');
    expect(mocks.wa).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });
  it('uses live coach profile phone for text-only recap and deduplicates a repeat without creating a PDF', async () => {
    profile.staff_phone = '629999999999';
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin'))[0].status).toBe('SENT');
    expect(mocks.text).toHaveBeenCalledWith(phone, expect.stringContaining('REKAP ABSENSI'));
    expect(mocks.wa).not.toHaveBeenCalled(); expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith('u1', expect.any(String), expect.stringContaining('17.00'), 'PAYROLL', expect.objectContaining({ actionUrl: '/coach/payroll?period=2026-10' }));
    await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin');
    expect(mocks.text).toHaveBeenCalledTimes(1);
  });
  it('falls back to LMS for coach without profile WA, ignoring any payroll phone', async () => {
    phone = null; profile.staff_phone = '628111111111';
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin'))[0].status).toBe('LMS_ONLY');
    expect(mocks.notify).toHaveBeenCalledTimes(1); expect(mocks.wa).not.toHaveBeenCalled();
  });
  it('keeps an early manual recap independent of the scheduled recap and deduplicates each channel', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T10:00:00+07:00'));
    await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin');
    await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin');
    expect(mocks.text).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-10-25T09:00:00+07:00'));
    await sendPayrollBatch(record.id, ['p1'], 'RECAP', null);
    await sendPayrollBatch(record.id, ['p1'], 'RECAP', null);
    expect(mocks.text).toHaveBeenCalledTimes(2);
    const keys = mocks.notify.mock.calls.map(call => call[4].dedupeKey);
    expect(new Set(keys).size).toBe(2);
    expect(record.document.transfers).toEqual([]);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it.each(['RECAP', 'REMINDER'] as const)('does not let a legacy early %s suppress the scheduled message', async kind => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T16:00:00+07:00'));
    record.document.deliveries[`p1:period:${kind}`] = { token: 'legacy', profile_id: 'p1', kind, version: 1, status: 'SENT', at: '2026-10-20T03:00:00Z' };
    await sendPayrollBatch(record.id, ['p1'], kind, null);
    await sendPayrollBatch(record.id, ['p1'], kind, null);
    expect(mocks.text).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith('u1', expect.any(String), expect.any(String), 'PAYROLL', expect.objectContaining({ dedupeKey: expect.stringContaining('AUTOMATIC') }));
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it.each([{ actor: 'admin', pendingSuffix: '' }, { actor: null, pendingSuffix: ':MANUAL' }])('blocks overlapping recap delivery across manual and scheduled sources: $actor', async ({ actor, pendingSuffix }) => {
    record.document.deliveries[`p1:period:RECAP${pendingSuffix}`] = { token: 'pending', profile_id: 'p1', kind: 'RECAP', version: 1, status: 'SENDING', at: '2026-10-25T02:00:00Z' };
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', actor))[0].status).toBe('FAILED');
    expect(mocks.text).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it('flags staff without contact for admin without pretending LMS delivery', async () => {
    profile.kind = 'STAFF'; profile.user_id = null;
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin'))[0].status).toBe('NO_CONTACT');
    expect(mocks.admins).toHaveBeenCalledTimes(1); expect(mocks.notify).not.toHaveBeenCalled(); expect(mocks.wa).not.toHaveBeenCalled();
  });
  it('rejects group IDs and persists a failed result', async () => {
    phone = '123456@g.us';
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin'))[0].status).toBe('FAILED');
    expect(Object.values(record.document.deliveries)[0].status).toBe('FAILED'); expect(mocks.wa).not.toHaveBeenCalled();
  });
  it('persists WA failures and allows an explicit retry without duplicating transfers', async () => {
    mocks.text.mockResolvedValueOnce({ success: false, error: 'offline' });
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin'))[0].status).toBe('FAILED');
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin', true))[0].status).toBe('SENT');
    expect(record.document.transfers).toHaveLength(0);
  });
  it('simulates text recap locally without a PDF or any WA sender', async () => {
    vi.stubEnv('PAYROLL_LOCAL_PREVIEW', 'true');
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin'))[0].status).toBe('SIMULATED');
    expect(mocks.pdf).not.toHaveBeenCalled(); expect(mocks.wa).not.toHaveBeenCalled(); expect(mocks.text).not.toHaveBeenCalled();
  });
  it('sends a PDF only for a finalized paid slip', async () => {
    record.document.status = 'FINAL';
    record.document.transfers = [{ id: 't1', profile_id: 'p1', amount: 100000, version: 1, at: record.document.ends_at, by: 'admin', reference: '' }];
    expect((await sendPayrollBatch(record.id, ['p1'], 'SLIP', 'admin'))[0].status).toBe('SENT');
    expect(mocks.wa).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber: phone, mimeType: 'application/pdf' }));
    expect(mocks.pdf).toHaveBeenCalled(); expect(mocks.text).not.toHaveBeenCalled();
  });
  it('renders paid slip PDF in local preview without sending it', async () => {
    vi.stubEnv('PAYROLL_LOCAL_PREVIEW', 'true'); record.document.status = 'FINAL';
    record.document.transfers = [{ id: 't1', profile_id: 'p1', amount: 100000, version: 1, at: record.document.ends_at, by: 'admin', reference: '' }];
    expect((await sendPayrollBatch(record.id, ['p1'], 'SLIP', 'admin'))[0].status).toBe('SIMULATED');
    expect(mocks.pdf).toHaveBeenCalled(); expect(mocks.wa).not.toHaveBeenCalled(); expect(mocks.text).not.toHaveBeenCalled();
  });
});
