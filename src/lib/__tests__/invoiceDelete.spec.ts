import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    session: vi.fn(),
    from: vi.fn(),
    result: vi.fn(),
    notify: vi.fn(),
    getInvoice: vi.fn()
}));
vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceById: mocks.getInvoice }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));
vi.mock('@/lib/services/whatsappClient', () => ({}));
vi.mock('@/lib/services/invoiceCheckoutServer', () => ({}));
vi.mock('@/lib/services/eventManagerWebhook', () => ({ notifyEventManagerInvoiceStatus: mocks.notify }));

import { DELETE } from '@/app/api/invoices/[id]/route';

const invoice = { id: 'invoice-id', invoice_number: 'HC-2627-000003' };
const invokeDelete = () => DELETE(
    new NextRequest('https://lms.test/api/invoices/invoice-id', { method: 'DELETE' }),
    { params: Promise.resolve({ id: invoice.id }) }
);

beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { role: 'ADMIN' } });
    mocks.getInvoice.mockResolvedValue(invoice);
    mocks.from.mockReturnValue({
        delete: () => ({
            eq: () => ({
                select: () => ({ maybeSingle: mocks.result })
            })
        })
    });
});

describe('delete invoice', () => {
    it('returns a conflict and does not delete line items or notify on a protected invoice', async () => {
        mocks.result.mockResolvedValue({ data: null, error: { code: '23503' } });
        const response = await invokeDelete();
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: expect.stringContaining('pendaftaran') });
        expect(mocks.from.mock.calls).toEqual([['invoices']]);
        expect(mocks.notify).not.toHaveBeenCalled();
    });

    it('notifies cancellation after the invoice delete succeeds', async () => {
        mocks.result.mockResolvedValue({ data: { id: invoice.id }, error: null });
        expect((await invokeDelete()).status).toBe(200);
        expect(mocks.notify).toHaveBeenCalledWith(invoice, 'cancelled');
    });

    it('does not notify again when the invoice has already been removed', async () => {
        mocks.result.mockResolvedValue({ data: null, error: null });
        expect((await invokeDelete()).status).toBe(200);
        expect(mocks.notify).not.toHaveBeenCalled();
    });
});
