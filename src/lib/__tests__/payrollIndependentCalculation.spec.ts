import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegacyPayrollSnapshot } from '@/lib/payroll/legacyImport';
import { createPeriod, DEFAULT_RATES, type PeriodDocument } from '@/lib/payroll/model';
import { payrollCommandSchema } from '@/lib/payroll/validation';

const mocks = vi.hoisted(() => ({ rows: vi.fn(), commit: vi.fn(), config: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/dao/payrollDao', () => ({
  payrollRows: mocks.rows, getPayrollConfig: mocks.config, commitPayrollPeriod: mocks.commit,
}));
vi.mock('@/lib/services/payrollNotifications', () => ({ attendanceAdmins: async () => [] }));

import { calculatePayroll } from '@/lib/services/payroll';

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
