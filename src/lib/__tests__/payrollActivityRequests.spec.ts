import { beforeEach, describe, expect, it, vi } from 'vitest';
import { approvedRequestActivities, type ActivityRequest } from '@/lib/payroll/activityRequests';
import { calculatePeriod, createPeriod, DEFAULT_RATES } from '@/lib/payroll/model';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ db: vi.fn(), insert: vi.fn(), config: vi.fn(), rows: vi.fn(), notify: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: mocks.db }));
vi.mock('@/lib/dao/payrollDao', () => ({ getPayrollConfig: mocks.config, payrollRows: mocks.rows, ensurePayrollPeriod: vi.fn() }));
vi.mock('@/lib/services/payrollNotifications', () => ({ createAttendanceAdminNotifications: mocks.notify }));
vi.mock('@/lib/dao/notificationsDao', () => ({ createNotification: vi.fn() }));
import { submitActivityRequest } from '@/lib/services/payrollActivityRequests';
const submitted = { id: '40000000-0000-4000-8000-000000000001', activityAt: '2026-11-03T12:00:00+07:00', kind: 'EVENT', label: 'Event pengujian', notes: 'Lokasi dan bukti kegiatan tersedia' };
const now = new Date('2026-11-04T12:00:00+07:00');
describe('coach supplemental activity approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null }); mocks.db.mockReturnValue({ from: () => ({ insert: mocks.insert }) });
    mocks.config.mockResolvedValue({ settings: { active_from: '2020-01-01' }, people: [{ id: 'p1', user_id: 'u1', kind: 'COACH', active: true, name: 'Coach' }] });
    mocks.rows.mockResolvedValue([]); mocks.notify.mockResolvedValue(undefined);
  });
  it('binds identity to signed-in coach and strips a forged approval or another coach ID', async () => {
    await submitActivityRequest({ ...submitted, coach_id: 'another-user', status: 'APPROVED' }, 'u1', now);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ coach_id: 'u1' }));
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('status');
  });
  it('rejects future activities and submissions after the period correction deadline', async () => {
    await expect(submitActivityRequest({ ...submitted, activityAt: '2026-11-05T10:00:00+07:00' }, 'u1', now)).rejects.toThrow(/sudah berlangsung/);
    await expect(submitActivityRequest(submitted, 'u1', new Date('2026-11-25T17:00:00+07:00'))).rejects.toThrow(/17.00/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('rejects duplicate submission instead of creating another payable source', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505' } });
    await expect(submitActivityRequest(submitted, 'u1', now)).rejects.toThrow(/sudah diajukan/);
  });
  it('blocks coach manual trial requests: the submitted trial assessment is the only automatic source', async () => {
    await expect(submitActivityRequest({ ...submitted, kind: 'TRIAL' }, 'u1', now)).rejects.toThrow(/dicatat otomatis/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('never pays pending/rejected activities; approved observation online/offline uses dated tariffs', () => {
    const request = { id: 'r1', coach_id: 'u1', activity_at: submitted.activityAt, kind: 'EVENT', label: submitted.label, mode: 'MITRA', review_reason: 'Disetujui setelah diperiksa' } as ActivityRequest;
    const activities = approvedRequestActivities([{ ...request, status: 'PENDING' }, { ...request, id: 'r2', status: 'REJECTED' }, { ...request, id: 'r3', status: 'APPROVED' }, { ...request, id: 'r4', kind: 'OBSERVATION_ONLINE', status: 'APPROVED' }, { ...request, id: 'r5', kind: 'OBSERVATION_OFFLINE', status: 'APPROVED' }]);
    expect(activities).toHaveLength(3);
    const period = calculatePeriod({ period: createPeriod(2026, 11), people: [{ id: 'p1', user_id: 'u1', kind: 'COACH', name: 'Coach', job_title: 'Coach', staff_phone: null, active: true }], terms: [{ profile_id: 'p1', effective_from: '2020-01-01', contract: 'MITRA', base_salary: 0 }], cards: [{ effective_from: '2020-01-01', rates: DEFAULT_RATES }], activities, now });
    expect(period.slips[0].total).toBe(255000); expect(period.slips[0].lines.find(l => l.kind === 'OBSERVATION_ONLINE')?.amount).toBe(25000); expect(period.slips[0].lines.find(l => l.kind === 'OBSERVATION_OFFLINE')?.amount).toBe(50000);
  });
  it('uses new observation rates only on/after the admin effective date', () => {
    const activities = approvedRequestActivities([
      { id: 'r1', coach_id: 'u1', activity_at: '2026-10-31T12:00:00+07:00', kind: 'OBSERVATION_ONLINE', label: 'Observasi sebelum tarif baru', mode: 'MITRA', status: 'APPROVED', review_reason: 'Disetujui' },
      { id: 'r2', coach_id: 'u1', activity_at: '2026-11-03T12:00:00+07:00', kind: 'OBSERVATION_ONLINE', label: 'Observasi setelah tarif baru', mode: 'MITRA', status: 'APPROVED', review_reason: 'Disetujui' },
    ] as ActivityRequest[]);
    const period = calculatePeriod({ period: createPeriod(2026, 11), people: [{ id: 'p1', user_id: 'u1', kind: 'COACH', name: 'Coach', job_title: 'Coach', staff_phone: null, active: true }], terms: [{ profile_id: 'p1', effective_from: '2020-01-01', contract: 'MITRA', base_salary: 0 }], cards: [{ effective_from: '2020-01-01', rates: DEFAULT_RATES }, { effective_from: '2026-11-01', rates: { ...DEFAULT_RATES, OBSERVATION_ONLINE: 30000, OBSERVATION_OFFLINE: 60000 } }], activities, now });
    expect(period.slips[0].lines.map(l => l.amount)).toEqual([25000, 30000]);
    expect(period.slips[0].total).toBe(55000);
  });
});
