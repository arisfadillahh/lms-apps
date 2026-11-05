import { describe, expect, it } from 'vitest';
import { createPeriod, correctionOpen, finalize, isPaid, markTransferred, paidAmount, reverseTransfer, reviewCorrection, submitCorrection, recapMessage, type Slip } from '@/lib/payroll/model';
import { coachPeriodView } from '@/lib/payroll/coachView';

const slip: Slip = { profile_id: 'p', user_id: 'u', name: 'Coach', kind: 'COACH', job_title: 'Coach', contract: 'MITRA', total: 125000, lines: [
  { key: 's', kind: 'WEEKLY', date: '2026-11-25T20:00:00+07:00', label: 'Kelas', quantity: 1, rate: 125000, amount: 125000, students: 3, details: 'Fee rahasia 125000', override_reason: 'Koreksi nominal rahasia' },
  { key: 'goal', kind: 'GOAL', date: '2026-11-20', label: 'Bonus', quantity: 1, rate: 100000, amount: 100000, details: '' },
] };
const draft = () => ({ ...createPeriod(2026, 11), slips: [structuredClone(slip)], calculated_at: '2026-11-26T00:00:00Z' });
const before = new Date('2026-11-25T16:59:59+07:00'), after = new Date('2026-11-26T00:00:00Z');

describe('payroll corrections, privacy and transfer recording', () => {
  it('uses a firm 17:00 deadline while preserving the complete activity period', () => {
    const p = draft(); expect(correctionOpen(p, before)).toBe(true);
    expect(correctionOpen(p, new Date('2026-11-25T17:00:00+07:00'))).toBe(false);
    expect(p.ends_at).toBe('2026-11-25T17:00:00.000Z');
    expect(recapMessage(p, slip, before)).not.toMatch(/pengecualian|force majeure|revisi hanya/);
  });
  it('persists idempotent owned requests and prevents unresolved finalization', () => {
    const input = { id: 'r', user_id: 'u', message: 'Kelas tanggal 20 belum tercatat' };
    const p = submitCorrection(draft(), input, before);
    expect(submitCorrection(p, input, after)).toBe(p);
    expect(() => submitCorrection(p, { ...input, user_id: 'other' }, before)).toThrow();
    expect(() => submitCorrection(draft(), input, after)).toThrow(/17.00/);
    expect(() => finalize(p, 'admin', after)).toThrow(/pengajuan koreksi/);
    const working = reviewCorrection(p, 'r', 'IN_PROGRESS', 'finance', 'Sedang dicek', after);
    const done = reviewCorrection(working, 'r', 'DONE', 'finance', 'Kelas sudah dikoreksi', after);
    expect(done.corrections?.[0].reviewed_by).toBe('finance');
    expect(finalize(done, 'finance', after).status).toBe('FINAL');
    expect(() => reviewCorrection(done, 'r', 'REJECTED', 'admin', 'Ditolak ulang', after)).toThrow(/diselesaikan/);
  });
  it('reverses only the marking, revokes paid access and supports a fresh unique marking', () => {
    const paid = markTransferred(finalize(draft(), 'admin', after), ['p'], 'finance', 'BANK', after);
    const reversed = reverseTransfer(paid, paid.transfers[0].id, 'finance', 'Salah penerima', after);
    expect(reversed.transfers).toEqual(paid.transfers); expect(reversed.history).toEqual(paid.history);
    expect(paidAmount(reversed, 'p')).toBe(0); expect(isPaid(reversed, 'p')).toBe(false);
    expect(coachPeriodView(reversed, 'u')?.slipUrl).toBeNull();
    expect(() => reverseTransfer(reversed, paid.transfers[0].id, 'admin', 'Alasan ulang')).toThrow(/sudah dibatalkan/);
    const repaid = markTransferred(reversed, ['p'], 'finance', 'BANK BENAR', after);
    expect(new Set(repaid.transfers.map(t => t.id)).size).toBe(2); expect(paidAmount(repaid, 'p')).toBe(slip.total);
    expect(isPaid(repaid, 'p')).toBe(true);
  });
  it('never exposes financial data or another coach through the attendance DTO', () => {
    const p = submitCorrection(draft(), { id: 'r', user_id: 'u', message: 'Tanggal kelas salah' }, before);
    p.corrections!.push({ id: 'other', user_id: 'other', message: 'private', at: before.toISOString(), status: 'WAITING' });
    const view = coachPeriodView(p, 'u')!, encoded = JSON.stringify(view);
    expect(view.activities).toHaveLength(1); expect(view.corrections).toHaveLength(1);
    expect(encoded).not.toMatch(/125000|100000|amount|rate|total|salary|transfers|override_reason|rahasia|private/);
    expect(coachPeriodView(p, 'other')).toBeNull(); expect(view.slipUrl).toBeNull();
  });
});
