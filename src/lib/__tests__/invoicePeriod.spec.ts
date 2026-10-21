import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatInvoicePeriod } from '@/lib/invoicePeriod';
import type { Invoice } from '@/lib/types/invoice';

const monthly = {
  invoice_type: 'MONTHLY' as const,
  period_month: 10,
  period_year: 2026,
  period_start_date: '2026-10-26',
  period_end_date: '2026-11-25',
};

afterEach(() => vi.useRealTimers());

describe('invoice billing period presentation', () => {
  it('shows the billing month, not two calendar months of learning', () => {
    expect(formatInvoicePeriod(monthly)).toBe('Oktober 2026');
    expect(formatInvoicePeriod(monthly, true)).toBe('Okt 2026');
  });

  it.each([
    [1, 'Januari'], [2, 'Februari'], [3, 'Maret'], [4, 'April'],
    [5, 'Mei'], [6, 'Juni'], [7, 'Juli'], [8, 'Agustus'],
    [9, 'September'], [10, 'Oktober'], [11, 'November'], [12, 'Desember'],
  ])('formats billing month %i independently of learning dates', (month, name) => {
    expect(formatInvoicePeriod({ ...monthly, period_month: month })).toBe(`${name} 2026`);
  });

  it.each([
    '2026-12-31T16:59:59Z', '2026-12-31T17:00:00Z', '2026-12-31T17:00:01Z',
  ])('does not relabel a December invoice when the current month changes: %s', (now) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    expect(formatInvoicePeriod({
      ...monthly, period_month: 12, period_start_date: '2026-12-26', period_end_date: '2027-01-25',
    })).toBe('Desember 2026');
  });

  it.each(['PENDING', 'OVERDUE', 'PAID'] as const)('keeps the billing month when status is %s', (status) => {
    const invoice = { ...monthly, status, paid_at: status === 'PAID' ? '2027-01-05T00:00:00Z' : null };
    expect(formatInvoicePeriod(invoice)).toBe('Oktober 2026');
  });

  it('does not change package dates, amount or paid state, including longer packages', () => {
    const invoice = Object.freeze({ ...monthly, period_end_date: '2027-01-25', total_amount: 900000, status: 'PAID' });
    expect(formatInvoicePeriod(invoice)).toBe('Oktober 2026');
    expect(invoice).toEqual({ ...monthly, period_end_date: '2027-01-25', total_amount: 900000, status: 'PAID' });
  });

  it.each(['REGISTRATION', 'SEASONAL'] as Invoice['invoice_type'][])('preserves the date range for %s', (type) => {
    expect(formatInvoicePeriod({ ...monthly, invoice_type: type })).toBe('Oktober - November 2026');
    expect(formatInvoicePeriod({ ...monthly, invoice_type: type, period_start_date: '2026-12-26', period_end_date: '2027-01-25' }, true))
      .toBe('Des 2026 - Jan 2027');
  });

  it('keeps date-only seasonal boundaries in the stored month', () => {
    expect(formatInvoicePeriod({ ...monthly, invoice_type: 'SEASONAL', period_start_date: '2026-10-01', period_end_date: '2026-10-31' }))
      .toBe('Oktober 2026');
  });

  it('handles legacy missing dates and invalid billing metadata without inventing a month', () => {
    expect(formatInvoicePeriod({ ...monthly, period_start_date: '', period_end_date: '' })).toBe('Oktober 2026');
    expect(formatInvoicePeriod({ ...monthly, invoice_type: 'SEASONAL', period_start_date: 'invalid' })).toBe('Oktober 2026');
    for (const month of [0, 13, 1.5, NaN]) expect(formatInvoicePeriod({ ...monthly, period_month: month })).toBe('-');
  });
});
