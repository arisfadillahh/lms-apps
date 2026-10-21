import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInvoiceById, getInvoiceByNumber, getUnpaidInvoicesForMonth, INVOICE_ITEMS_WITH_BILLING_DURATION } from '@/lib/dao/invoicesDao';
import { formatInvoicePeriod } from '@/lib/invoicePeriod';
import { toPublicInvoice } from '@/lib/publicInvoice';

const mock = vi.hoisted(() => ({ data: {} as unknown, select: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({
  getSupabaseAdmin: () => ({ from: () => {
    const query = {
      select: (...args: unknown[]) => { mock.select(...args); return query; },
      eq: () => query, in: () => query,
      single: async () => ({ data: mock.data, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mock.data, error: null }).then(resolve),
    };
    return query;
  } }),
}));

const invoice = {
  id: 'fixture', invoice_type: 'MONTHLY', period_month: 10, period_year: 2026,
  period_start_date: '2026-10-26', period_end_date: '2027-01-25',
  items: [{ coder_id: 'private-coder-id', payment_period_id: 'private-period-id', billing_period: { payment_plans: { duration_months: 3 } } }],
};

beforeEach(() => vi.clearAllMocks());

describe('billing duration is read from existing relationships without writes', () => {
  it.each([['ID', () => getInvoiceById('fixture')], ['number', () => getInvoiceByNumber('INV-QA')]] as const)(
    'preserves the real plan duration through %s lookup and the public DTO', async (_label, read) => {
      mock.data = structuredClone(invoice);
      const loaded = await read();
      expect(mock.select.mock.calls[0][0]).toEqual(expect.stringContaining(INVOICE_ITEMS_WITH_BILLING_DURATION));
      expect(loaded).not.toBeNull();
      const publicInvoice = toPublicInvoice(loaded!);
      expect(formatInvoicePeriod(publicInvoice)).toBe('Oktober 2026 - Januari 2027');
      expect(publicInvoice.items?.[0].billing_period?.payment_plans?.duration_months).toBe(3);
      expect(publicInvoice.items?.[0]).not.toHaveProperty('coder_id');
      expect(publicInvoice.items?.[0]).not.toHaveProperty('payment_period_id');
    },
  );

  it('keeps longer-package ranges in reminder reads as well', async () => {
    mock.data = [structuredClone(invoice)];
    const loaded = await getUnpaidInvoicesForMonth(10, 2026);
    expect(loaded.map(inv => formatInvoicePeriod(inv))).toEqual(['Oktober 2026 - Januari 2027']);
    expect(mock.select.mock.calls[0][0]).toEqual(expect.stringContaining(INVOICE_ITEMS_WITH_BILLING_DURATION));
  });
});
