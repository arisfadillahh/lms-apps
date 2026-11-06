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
vi.mock('@/lib/services/payrollReimbursements', () => ({ createReimbursementLink: (_p:unknown,id:string) => `https://lms.example/payroll/reimbursement?token=scoped-${id}` }));
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
    mocks.config.mockImplementation(async () => ({ people: [profile], settings: { automation_enabled: true, active_from: '2026-01-01' } }));
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
  it('sends the staff period form without an LMS account, attendance recap, salary or PDF',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-25T09:00:00+07:00'));
    profile.kind='STAFF';profile.user_id=null;profile.staff_phone='628111111111';record.document.slips=[];
    expect((await sendPayrollBatch(record.id,['p1'],'REIMBURSEMENT',null))[0].status).toBe('SENT');
    expect(mocks.text).toHaveBeenCalledWith('628111111111',expect.stringContaining('/payroll/reimbursement?token=scoped-p1'));
    const text=mocks.text.mock.calls[0][1];expect(text).not.toMatch(/Rp|100000|Gaji tetap/);expect(mocks.pdf).not.toHaveBeenCalled();expect(mocks.notify).not.toHaveBeenCalled();
    await sendPayrollBatch(record.id,['p1'],'REIMBURSEMENT',null);expect(mocks.text).toHaveBeenCalledTimes(1);
  });
  it('includes the personal form in the scheduled coach recap and uses LMS when WA is absent',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-25T09:00:00+07:00'));phone=null;
    expect((await sendPayrollBatch(record.id,['p1'],'RECAP',null))[0].status).toBe('LMS_ONLY');
    expect(mocks.notify).toHaveBeenCalledWith('u1',expect.anything(),expect.stringContaining('token=scoped-p1'),'PAYROLL',expect.anything());expect(mocks.text).not.toHaveBeenCalled();
  });
  it('uses live coach profile phone for text-only recap and deduplicates a repeat without creating a PDF', async () => {
    profile.staff_phone = '629999999999';
    expect((await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin'))[0].status).toBe('SENT');
    expect(mocks.text).toHaveBeenCalledWith(phone, expect.stringContaining('Rekap mengajar'));
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
  it('flags a paid staff slip without contact for admin without pretending LMS delivery', async () => {
    profile.kind = 'STAFF'; profile.user_id = null;
    record.document.slips[0].kind = 'STAFF'; record.document.slips[0].user_id = null;
    record.document.status = 'FINAL';
    record.document.transfers = [{ id: 't1', profile_id: 'p1', amount: 100000, version: 1, at: record.document.ends_at, by: 'admin', reference: '' }];
    expect((await sendPayrollBatch(record.id, ['p1'], 'SLIP', 'admin'))[0].status).toBe('NO_CONTACT');
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

  it('blocks cumulative attendance without dated meetings before claiming delivery or notifying the coach', async () => {
    record.document.slips[0].unresolved_attendance = 3;
    const result = await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin');
    expect(result[0]).toMatchObject({ status: 'FAILED', error: expect.stringContaining('3 aktivitas belum memiliki tanggal dan nama kelas') });
    expect(mocks.commit).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled(); expect(mocks.text).not.toHaveBeenCalled();
    expect((await sendPayrollBatch(record.id, ['p1'], 'REMINDER', 'admin'))[0].status).toBe('FAILED');
  });

  it('warns admin about incomplete scheduled attendance and continues delivering valid coaches', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T09:00:00+07:00'));
    record.document.slips[0].unresolved_attendance = 3;
    record.document.slips.push({ ...record.document.slips[0], profile_id: 'p2', user_id: 'u2', name: 'Coach Lengkap', unresolved_attendance: 0, attendance_details: [] });
    mocks.config.mockResolvedValue({ people: [profile, { ...profile, id: 'p2', user_id: 'u2', name: 'Coach Lengkap' }], settings: { automation_enabled: true, active_from: '2026-01-01' } });
    const result = await sendPayrollBatch(record.id, ['p1', 'p2'], 'RECAP', null);
    expect(result.map(item => item.status)).toEqual(['FAILED', 'SENT']);
    expect(mocks.admins).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('3 aktivitas belum memiliki tanggal dan nama kelas'), dedupeKey: 'payroll-attendance-incomplete:2026-10:p1' }));
    expect(mocks.notify).toHaveBeenCalledTimes(1); expect(mocks.notify.mock.calls[0][0]).toBe('u2');
    expect(mocks.text).toHaveBeenCalledTimes(1); expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it.each(['RECAP', 'REMINDER'] as const)('does not send %s to staff or inactive payroll profiles', async kind => {
    profile.kind = 'STAFF';
    expect((await sendPayrollBatch(record.id, ['p1'], kind, 'admin'))[0].status).toBe('FAILED');
    profile.kind = 'COACH'; profile.active = false;
    expect((await sendPayrollBatch(record.id, ['p1'], kind, 'admin'))[0].status).toBe('FAILED');
    expect(mocks.commit).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled(); expect(mocks.text).not.toHaveBeenCalled();
  });

  it('keeps reminders short rather than resending the complete dated recap', async () => {
    record.document.slips[0].lines = [{ key: 's1', date: '2026-10-20T08:00:00Z', kind: 'WEEKLY', label: 'Weekly Robotik', quantity: 1, rate: 100000, amount: 100000, details: '' }];
    await sendPayrollBatch(record.id, ['p1'], 'REMINDER', 'admin');
    const message = mocks.text.mock.calls[0][1];
    expect(message).toContain('Pengingat rekap mengajar');
    expect(message).toContain('25 Oktober 2026 pukul 17.00 WIB');
    expect(message).not.toMatch(/Weekly Robotik|Rp|100000/);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it('adds a coach link from the trusted configured site URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lms.clev.io');
    await sendPayrollBatch(record.id, ['p1'], 'RECAP', 'admin');
    expect(mocks.text.mock.calls[0][1]).toContain('https://lms.clev.io/coach/payroll?period=2026-10');
  });

  it.each(['2026-10-25T08:59:00+07:00', '2026-10-25T17:00:00+07:00', '2026-10-26T09:00:00+07:00'])('prevents a direct automatic recap outside its schedule: %s', now => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now));
    return sendPayrollBatch(record.id, ['p1'], 'RECAP', null).then(result => {
      expect(result[0].status).toBe('FAILED'); expect(mocks.text).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
    });
  });

  it('prevents a direct automatic reminder before 16:00 and respects disabled automation', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T15:59:00+07:00'));
    expect((await sendPayrollBatch(record.id, ['p1'], 'REMINDER', null))[0].status).toBe('FAILED');
    vi.setSystemTime(new Date('2026-10-25T16:00:00+07:00'));
    mocks.config.mockResolvedValue({ people: [profile], settings: { automation_enabled: false, active_from: '2026-01-01' } });
    expect((await sendPayrollBatch(record.id, ['p1'], 'REMINDER', null))[0].status).toBe('FAILED');
    expect(mocks.text).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('prevents automatic slip delivery even after transfer', async () => {
    record.document.status = 'FINAL';
    record.document.transfers = [{ id: 't1', profile_id: 'p1', amount: 100000, version: 1, at: record.document.ends_at, by: 'admin', reference: '' }];
    expect((await sendPayrollBatch(record.id, ['p1'], 'SLIP', null))[0].status).toBe('FAILED');
    expect(mocks.wa).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });
});
