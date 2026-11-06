import { describe, expect, it } from 'vitest';
import { createPeriod, recapMessage, type Slip } from '@/lib/payroll/model';
import { payrollSlipRows, renderPayrollHtml, transferSummary } from '@/lib/payroll/presentation';
const slip: Slip = { profile_id: 'p1', user_id: 'u1', name: '<script>alert(1)</script>', job_title: 'Coach & Mentor', kind: 'COACH', contract: 'MITRA', total: 100000, lines: [{ key: 's1', date: '2026-10-25T13:00:00Z', label: '<img src=x onerror=alert(1)>', kind: 'WEEKLY', rate: 100000, amount: 100000, quantity: 1, details: '<iframe>test</iframe>', override_reason: '" onclick="alert(1)' }] };
describe('private PDF presentation', () => {
  it('escapes every untrusted text field and uses the admin navy palette', () => {
    const html = renderPayrollHtml(createPeriod(2026, 10), { ...slip, lines: [{ ...slip.lines[0], kind: 'ADJUSTMENT' }] });
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=x'); expect(html).not.toContain('<iframe>');
    expect(html).toContain('alt="Clevio Innovator Camp"');
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Coach &amp; Mentor'); expect(html).toContain('#22367b');
  });
  it('states the deadline in text and distinguishes draft slip preview from final PDF', () => {
    const p = createPeriod(2026, 10); const html = renderPayrollHtml(p, slip);
    expect(recapMessage(p, slip)).toContain('BATAS KOREKSI:'); expect(recapMessage(p, slip)).toContain('17.00'); expect(recapMessage(p, slip)).not.toContain('pengecualian'); expect(html).toContain('DRAFT / SEMENTARA');
    p.history = [{ version: 1, finalized_at: p.ends_at, finalized_by: 'admin', slips: [slip] }];
    expect(renderPayrollHtml(p, slip)).toContain('>FINAL</span>');
  });
  it('recaps activity details without salary, fee rates, bonuses, adjustments or totals', () => {
    const p = createPeriod(2026, 10);
    const s = { ...slip, name: 'Coach', total: 4275000, lines: [
      { ...slip.lines[0], label: 'Weekly kelas A', details: 'Coach pengganti', amount: 80000, students: 2 },
      { ...slip.lines[0], key: 'salary', kind: 'SALARY', label: 'Gaji tetap', amount: 4000000 },
      { ...slip.lines[0], key: 'bonus', kind: 'GOAL', label: 'Bonus goal', amount: 100000 },
      { ...slip.lines[0], key: 'transport', kind: 'ADJUSTMENT', label: 'Transport manual', amount: 95000 },
    ] };
    const text = recapMessage(p, s);
    expect(text).toContain('Weekly kelas A'); expect(text).toContain('2 anak'); expect(text).toContain('Coach pengganti');
    for (const forbidden of ['Rp', '80000', '4.000.000', '4275000', 'Gaji tetap', 'Bonus goal', 'Transport manual']) expect(text).not.toContain(forbidden);
    expect(text).toContain('PUKUL 17.00 WIB');
  });
  it('shows additional transfer needed and overpayment without deleting history', () => {
    const p = createPeriod(2026, 10);
    p.transfers = [{ id: 't1', profile_id: 'p1', amount: 120000, at: p.ends_at, by: 'admin', reference: '', version: 1 }];
    expect(transferSummary(p, slip)).toEqual({ paid: 120000, remaining: 0, overpaid: 20000 });
  });
  it('summarizes mixed class fees without changing amounts or exposing session details', () => {
    const lines = [
      { ...slip.lines[0], key: 'a', label: 'Kelas rahasia Senin', amount: 70000 },
      { ...slip.lines[0], key: 'b', label: 'Kelas rahasia Selasa', kind: 'EKSKUL', amount: 105000 },
      { ...slip.lines[0], key: 'c', amount: 0, details: 'Aktivitas dibatalkan' },
      { ...slip.lines[0], key: 'd', kind: 'TRIAL', amount: 25000 },
      { ...slip.lines[0], key: 'e', kind: 'GOAL', amount: 100000 },
      { ...slip.lines[0], key: 'f', kind: 'GOAL', amount: 100000 },
    ];
    const summary = { ...slip, total: 400000, lines };
    const snapshot = JSON.stringify(summary);
    expect(payrollSlipRows(summary)).toEqual([
      { label: 'Fee mengajar kelas', quantity: '2 sesi', amount: 175000 },
      { label: 'Fee trial', quantity: '1 sesi', amount: 25000 },
      { label: 'Bonus goal', quantity: '2 anak', amount: 200000 },
    ]);
    const html = renderPayrollHtml(createPeriod(2026, 10), summary);
    for (const hidden of ['Kelas rahasia', '25 Okt 2026, 20.00', 'Aktivitas dibatalkan', 'onclick=', '<th style="width:20%">Tanggal']) expect(html).not.toContain(hidden);
    expect(html).toContain('Rp400.000');
    expect(JSON.stringify(summary)).toBe(snapshot);
  });
  it('keeps salary, each allowance, monthly deductions and other activities as named components', () => {
    const components = [
      ['SALARY', 'Gaji pokok', 3000000], ['ALLOWANCE', 'Tunjangan jabatan', 500000],
      ['ALLOWANCE', 'Tunjangan komunikasi', 100000], ['ADJUSTMENT', 'Transport November', 50000],
      ['ADJUSTMENT', 'Potongan November', -25000], ['EVENT', 'Event sekolah', 180000],
    ] as const;
    const summary = { ...slip, lines: components.map(([kind, label, amount], i) => ({ ...slip.lines[0], key: String(i), kind, label, amount })) };
    const rows = payrollSlipRows(summary);
    expect(rows.map(row => [row.label, row.amount])).toEqual(components.map(([, label, amount]) => [label, amount]));
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(3805000);
    const html = renderPayrollHtml(createPeriod(2026, 10), summary);
    expect(html).toContain('Rp-25.000'); expect(html).not.toContain('Koreksi admin:');
  });
  it('omits zero additional class/trial fees for fulltime while keeping a goal bonus', () => {
    const summary = { ...slip, lines: [
      { ...slip.lines[0], amount: 0 }, { ...slip.lines[0], key: 'trial', kind: 'TRIAL', amount: 0 },
      { ...slip.lines[0], key: 'goal', kind: 'GOAL', amount: 100000 },
    ] };
    expect(payrollSlipRows(summary)).toEqual([{ label: 'Bonus goal', quantity: '1 anak', amount: 100000 }]);
  });
});
