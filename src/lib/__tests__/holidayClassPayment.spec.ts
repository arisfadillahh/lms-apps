import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settleHolidayPayment } from '@/lib/services/holidayClassPayment';
import type { Invoice } from '@/lib/types/invoice';

const mock = vi.hoisted(() => ({ status: vi.fn(), rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({ rpc: mock.rpc }) }));
vi.mock('@/lib/invoiceMidtransClient', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/invoiceMidtransClient')>(),
  InvoiceMidtransClient: class { getTransactionStatus = mock.status; },
}));

const invoice = { id: 'holiday-invoice', invoice_number: 'HC-2627-000001', total_amount: 350000 } as Invoice;
const payload = { order_id: 'LMS-abc-qris-123', gross_amount: '352500.00', status_code: '200', transaction_status: 'settlement', settlement_time: '2026-11-12 16:00:00' };
beforeEach(() => {
  vi.resetAllMocks();
  mock.status.mockResolvedValue(payload);
  mock.rpc.mockResolvedValue({ data: 'holiday-registration-id', error: null });
});
afterEach(() => vi.restoreAllMocks());

describe('Holiday invoice settlement using standard QRIS or VA instructions', () => {
  it('verifies the fee-inclusive provider total and settles the original invoice base amount', async () => {
    expect(await settleHolidayPayment(payload, invoice, 352500)).toBe('holiday-registration-id');
    expect(mock.status).toHaveBeenCalledWith(payload.order_id);
    expect(mock.rpc).toHaveBeenCalledWith('settle_holiday_class_invoice', {
      p_order: invoice.invoice_number, p_amount: 350000, p_paid_at: '2026-11-12T09:00:00.000Z',
    });
  });

  it('rejects wrong totals or a pending provider status before settling an invoice', async () => {
    await expect(settleHolidayPayment(payload, invoice, 350000)).rejects.toThrow(/mismatch/);
    mock.status.mockResolvedValue({ ...payload, transaction_status: 'pending', status_code: '201' });
    await expect(settleHolidayPayment(payload, invoice, 352500)).rejects.toThrow(/not yet confirmed/);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('continues to recognize previously issued hosted invoice orders', async () => {
    const legacy = { ...payload, order_id: invoice.invoice_number, gross_amount: '350000.00' };
    mock.status.mockResolvedValue(legacy);
    await settleHolidayPayment(legacy);
    expect(mock.rpc).toHaveBeenCalledWith('settle_holiday_class_invoice', expect.objectContaining({
      p_order: invoice.invoice_number, p_amount: 350000,
    }));
  });
});
