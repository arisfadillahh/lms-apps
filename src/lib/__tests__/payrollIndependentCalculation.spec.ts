import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegacyPayrollSnapshot } from '@/lib/payroll/legacyImport';
import { createPeriod, DEFAULT_RATES, type PeriodDocument } from '@/lib/payroll/model';
import { payrollCommandSchema } from '@/lib/payroll/validation';

const mocks = vi.hoisted(() => ({ rows: vi.fn(), commit: vi.fn(), config: vi.fn(), period: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock('@/lib/dao/notificationsDao', () => ({ createNotification: vi.fn() }));
vi.mock('@/lib/dao/payrollDao', () => ({
  payrollRows: mocks.rows, getPayrollConfig: mocks.config, commitPayrollPeriod: mocks.commit, getPayrollPeriod: mocks.period,
  getClassMotorTransportRules: async () => new Map(),
}));
vi.mock('@/lib/services/payrollNotifications', () => ({ attendanceAdmins: async () => [] }));

import { calculatePayroll } from '@/lib/services/payroll';
import { executePayrollCommand } from '@/lib/services/payrollCommands';

const snapshot = (period: string): LegacyPayrollSnapshot => ({
  schema: 1, sourceId: 'sheet', sourceName: 'Imported payroll', url: '',
  period, capturedAt: '2026-11-10T00:00:00Z', sourceCreatedAt: '2026-10-01T00:00:00Z',
  sourceModifiedAt: '2026-11-10T00:00:00Z', checksum: 'test', total: 25_000, totalBasis: 'RECORDED_FEES',
  rows: [{ sourceId: 'coach', name: 'Coach', username: 'coach', total: 25_000, sourceTotal: null, extras: [],
    counters: [{ label: 'Transport-Motor', value: 1 }], fees: [{ label: 'Fee Transport-Motor', value: 25_000 }] }],
});

describe('LMS calculation with retained import archives', () => {
  const now = new Date('2026-11-25T18:18:00+07:00');

  beforeEach(() => {
    mocks.commit.mockClear();
    mocks.config.mockResolvedValue({
      settings: { active_from: '2026-10-26' },
      people: [{ id: 'p1', user_id: 'coach', name: 'Coach', kind: 'COACH', active: true }],
      terms: [{ profile_id: 'p1', effective_from: '2026-10-01', contract: 'MITRA', base_salary: 0 }],
      cards: [{ effective_from: '2026-10-01', rates: DEFAULT_RATES }],
    });
    mocks.rows.mockImplementation(async (table: string) => table === 'payroll_activity_requests'
      ? [{ id: 'event', activity_at: '2026-11-06T12:00:00+07:00', coach_id: 'coach', label: 'LMS event', kind: 'EVENT', status: 'APPROVED', mode: 'MITRA' }]
      : []);
    mocks.commit.mockImplementation(async (record, document) => ({ ...record, document }));
  });

  it('updates a late deduction and the total in one commit when another staff member is now inactive', async () => {
    const after = new Date('2026-11-27T00:00:00+07:00');
    const staff = { id: 'p2', user_id: null, name: 'Staf lama', kind: 'STAFF' as const, active: true, job_title: 'Staf', staff_phone: null };
    const term = { profile_id: staff.id, contract: 'FULLTIME' as const, base_salary: 1_000_000, effective_from: '2026-10-26' };
    const doc = createPeriod(2026, 11);
    doc.manual = [
      { id: 'previous-staff', profile_id: staff.id, date: '2026-11-25T12:00:00+07:00', label: 'Potongan staf', amount: -2, reason: 'Koreksi yang telah dicatat' },
      { id: 'edit-me', profile_id: 'p1', date: '2026-11-25T12:00:00+07:00', label: 'Potongan coach', amount: -2000, reason: 'Potongan pertama' },
    ];
    const config = await mocks.config();
    mocks.config.mockResolvedValue({ ...config, people: [...config.people, staff], terms: [...config.terms, term] });
    const calculated = await calculatePayroll({ id: doc.id, revision: 1, document: doc }, after);
    mocks.config.mockResolvedValue({ ...config, people: [...config.people, { ...staff, active: false }], terms: [...config.terms, term] });
    mocks.period.mockResolvedValue(calculated);
    mocks.commit.mockClear();
    await executePayrollCommand({ action: 'component', periodId: doc.id, revision: 1, id: 'edit-me', profileId: 'p1',
      date: '2026-11-25', label: 'Potongan coach', amount: -1000, reason: 'Koreksi potongan' }, 'admin', after);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    const [, saved, , action] = mocks.commit.mock.calls[0];
    expect(action).toBe('COMPONENT');
    expect(saved.status).toBe('DRAFT');
    expect(saved.calculated_at).toBe(after.toISOString());
    expect(saved.slips.find((s: { profile_id: string })=>s.profile_id===staff.id)).toEqual(calculated.document.slips.find(s=>s.profile_id===staff.id));
    expect(saved.slips.find((s: { profile_id: string })=>s.profile_id==='p1')?.total).toBe(179000);
    expect(saved.manual.filter((m: { id: string })=>m.id==='edit-me')).toMatchObject([{ amount: -1000 }]);

    mocks.period.mockResolvedValue({ ...calculated, document: saved });
    mocks.commit.mockClear();
    await executePayrollCommand({ action: 'removeComponent', periodId: doc.id, revision: 1, id: 'edit-me',
      reason: 'Hapus potongan coach' }, 'admin', after);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.commit.mock.calls[0][1].slips.find((s: { profile_id: string })=>s.profile_id==='p1').total).toBe(180000);
  });

  it('does not commit a manual edit if its calculation fails', async () => {
    const doc = createPeriod(2026, 11);
    mocks.period.mockResolvedValue({ id: doc.id, revision: 1, document: doc });
    mocks.config.mockRejectedValueOnce(new Error('Perhitungan tidak tersedia'));
    await expect(executePayrollCommand({ action: 'component', periodId: doc.id, revision: 1, profileId: 'p1',
      date: '2026-11-25', label: 'Potongan', amount: -1000, reason: 'Uji kegagalan' }, 'admin', now)).rejects.toThrow(/tidak tersedia/);
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  function imported(month: number): PeriodDocument {
    const period = createPeriod(2026, month);
    return {
      ...period, legacy_imports: [snapshot(period.id)],
      legacy_links: { coach: { status: 'LINKED', profile_id: 'p1', user_id: 'coach', kind: 'COACH', name: 'Coach', reason: 'Impor awal', confirmed_at: '2026-10-01T00:00:00Z' } },
    };
  }

  it('counts the approved LMS event and manual correction while retaining the unused initial snapshot', async () => {
    const period = imported(11);
    period.manual = [{ id: 'manual', profile_id: 'p1', date: '2026-11-06T12:00:00+07:00', label: 'Transport diverifikasi', amount: 5_000, reason: 'Bukti diterima' }];
    const { document } = await calculatePayroll({ id: period.id, revision: 1, document: period }, now);
    expect(document.legacy_imports).toEqual(period.legacy_imports);
    expect(document.legacy_links).toEqual(period.legacy_links);
    expect(document.class_attendance_from).toBe(period.starts_at);
    expect(document.slips[0].lines.map(line => line.key).sort()).toEqual(['component:manual', 'request:event']);
  });

  it('keeps the frozen imported fee in a pre-November archive', async () => {
    const period = imported(10);
    const { document } = await calculatePayroll({ id: period.id, revision: 1, document: period }, now);
    expect(document.slips[0].lines).toMatchObject([{ kind: 'TRANSPORT', amount: 25_000, summary: true }]);
  });

  it('accepts a scoped opening transport component ID through the admin correction command', () => {
    const correction = { action: 'removeComponent', periodId: '2026-11', revision: 3, reason: 'Koreksi saldo awal transport' };
    expect(payrollCommandSchema.safeParse({ ...correction, id: 'transport-motor-opening:65eb8d3b-f5a5-4a0c-8d4c-6cc8a250c993' }).success).toBe(true);
    expect(payrollCommandSchema.safeParse({ ...correction, id: 'transport-motor-opening:unrecognized' }).success).toBe(false);
  });
});
