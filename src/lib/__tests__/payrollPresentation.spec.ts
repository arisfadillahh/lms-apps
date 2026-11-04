import { describe, expect, it } from 'vitest';
import { createPeriod, recapMessage, type Slip } from '@/lib/payroll/model';
import { renderPayrollHtml, transferSummary } from '@/lib/payroll/presentation';
const slip: Slip = { profile_id: 'p1', user_id: 'u1', name: '<script>alert(1)</script>', job_title: 'Coach & Mentor', kind: 'COACH', contract: 'MITRA', total: 100000, lines: [{ key: 's1', date: '2026-10-25T13:00:00Z', label: '<img src=x onerror=alert(1)>', kind: 'WEEKLY', rate: 100000, amount: 100000, quantity: 1, details: '<iframe>test</iframe>', override_reason: '" onclick="alert(1)' }] };
describe('private PDF presentation', () => {
  it('escapes every untrusted text field and uses the admin navy palette', () => {
    const html = renderPayrollHtml(createPeriod(2026, 10), slip);
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=x'); expect(html).not.toContain('<iframe>');
    expect(html).toContain('alt="Clevio Innovator Camp"');
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Coach &amp; Mentor'); expect(html).toContain('#22367b');
  });
  it('states the deadline in text and distinguishes draft slip preview from final PDF', () => {
    const p = createPeriod(2026, 10); const html = renderPayrollHtml(p, slip);
    expect(recapMessage(p, slip)).toContain('BATAS KOREKSI REGULER'); expect(recapMessage(p, slip)).toContain('17.00'); expect(html).toContain('DRAFT / SEMENTARA');
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
});
