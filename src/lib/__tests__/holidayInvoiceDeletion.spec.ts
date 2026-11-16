import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice } from '@/lib/types/invoice';

const mocks = vi.hoisted(() => ({
    cancel: vi.fn(), status: vi.fn(), rpc: vi.fn(), read: vi.fn(),
    historical: vi.fn(), latest: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/invoiceIssuanceJournal', () => ({
    withInvoiceIssuance: (_: string, run: (journal: { read: typeof mocks.read }) => unknown) => run({ read: mocks.read }),
}));
vi.mock('@/lib/invoiceMidtransClient', async importOriginal => ({
    ...await importOriginal<typeof import('@/lib/invoiceMidtransClient')>(),
    InvoiceMidtransClient: class { getTransactionStatus = mocks.status; cancelTransaction = mocks.cancel; },
}));
vi.mock('@/lib/invoicePaymentStore', () => ({
    getHistoricalInvoicePayments: mocks.historical, getStoredInvoicePaymentByInvoiceId: mocks.latest,
}));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));

import { deleteHolidayInvoice } from '@/lib/services/holidayInvoiceDeletion';

const invoice = { id: 'invoice-id', total_amount: 350000 } as Invoice;
const state = { phase: 'READY', orderId: 'order-id', total: 352500 };
const payment = (status: string) => ({ order_id: state.orderId, gross_amount: '352500.00', transaction_status: status });

beforeEach(() => {
    vi.resetAllMocks();
    mocks.read.mockResolvedValue(state);
    mocks.historical.mockResolvedValue([]);
    mocks.latest.mockResolvedValue(null);
    mocks.rpc.mockResolvedValueOnce({ data: 'ready', error: null }).mockResolvedValueOnce({ data: 'deleted', error: null });
});

describe('Holiday deletion payment checks', () => {
    it('cancels an active instruction and verifies cancellation before deleting', async () => {
        mocks.status.mockResolvedValueOnce(payment('pending')).mockResolvedValueOnce(payment('cancel'));
        expect(await deleteHolidayInvoice(invoice)).toBe('deleted');
        expect(mocks.cancel).toHaveBeenCalledWith(state.orderId);
        expect(mocks.status).toHaveBeenCalledTimes(2);
        expect(mocks.rpc).toHaveBeenLastCalledWith('delete_holiday_registration_invoice', {
            p_invoice_id: invoice.id, p_delete: true,
        });
        expect(mocks.status.mock.invocationCallOrder[1]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[1]);
    });

    it('keeps an invoice that settled before the delete request', async () => {
        mocks.status.mockResolvedValue(payment('settlement'));
        expect(await deleteHolidayInvoice(invoice)).toBe('paid');
        expect(mocks.cancel).not.toHaveBeenCalled();
        expect(mocks.rpc).toHaveBeenCalledTimes(1);
    });

    it('keeps the invoice if payment settles during cancellation', async () => {
        mocks.status.mockResolvedValueOnce(payment('pending')).mockResolvedValueOnce(payment('settlement'));
        expect(await deleteHolidayInvoice(invoice)).toBe('protected');
        expect(mocks.rpc).toHaveBeenCalledTimes(1);
    });

    it('keeps an invoice when issuance has an unresolved outcome', async () => {
        mocks.read.mockResolvedValue({ ...state, phase: 'SNAP_READY' });
        expect(await deleteHolidayInvoice(invoice)).toBe('protected');
        expect(mocks.status).not.toHaveBeenCalled();
        expect(mocks.rpc).toHaveBeenCalledTimes(1);
    });
});
