import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    session: vi.fn(),
    from: vi.fn(),
    result: vi.fn(),
    notify: vi.fn(),
    getInvoice: vi.fn(),
    deleteHolidayInvoice: vi.fn()
}));
vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceById: mocks.getInvoice }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));
vi.mock('@/lib/services/whatsappClient', () => ({}));
vi.mock('@/lib/services/invoiceCheckoutServer', () => ({}));
vi.mock('@/lib/services/eventManagerWebhook', () => ({ notifyEventManagerInvoiceStatus: mocks.notify }));
vi.mock('@/lib/services/holidayInvoiceDeletion', () => ({ deleteHolidayInvoice: mocks.deleteHolidayInvoice }));

import { DELETE } from '@/app/api/invoices/[id]/route';

const invoice = { id: 'invoice-id', invoice_number: 'LMS-2026-000003' };
const holidayInvoice = { ...invoice, invoice_number: 'HC-2627-000003' };
const invokeDelete = (deleteRegistration = false, headers?: HeadersInit) => DELETE(
    new NextRequest(`https://lms.test/api/invoices/invoice-id${deleteRegistration ? '?deleteRegistration=true' : ''}`, { method: 'DELETE', headers }),
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

afterEach(() => vi.unstubAllEnvs());

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

    it('requires an explicit confirmation for deleting the Holiday registration', async () => {
        mocks.getInvoice.mockResolvedValue(holidayInvoice);
        expect((await invokeDelete()).status).toBe(409);
        expect(mocks.from).not.toHaveBeenCalled();
        expect(mocks.deleteHolidayInvoice).not.toHaveBeenCalled();
    });

    it('deletes the confirmed Holiday invoice through the guarded service', async () => {
        mocks.getInvoice.mockResolvedValue(holidayInvoice);
        mocks.deleteHolidayInvoice.mockResolvedValue('deleted');
        const response = await invokeDelete(true);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ registrationDeleted: true });
        expect(mocks.deleteHolidayInvoice).toHaveBeenCalledWith(holidayInvoice);
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it('does not allow the integration token to delete a Holiday registration', async () => {
        vi.stubEnv('LMS_CORE_API_TOKEN', 'local-integration-token');
        mocks.session.mockResolvedValue(null);
        mocks.getInvoice.mockResolvedValue(holidayInvoice);
        expect((await invokeDelete(true, { authorization: 'Bearer local-integration-token' })).status).toBe(403);
        expect(mocks.deleteHolidayInvoice).not.toHaveBeenCalled();
    });

    it.each(['paid', 'protected'])('keeps a Holiday invoice and registration when deletion returns %s', async result => {
        mocks.getInvoice.mockResolvedValue(holidayInvoice);
        mocks.deleteHolidayInvoice.mockResolvedValue(result);
        expect((await invokeDelete(true)).status).toBe(409);
        expect(mocks.notify).not.toHaveBeenCalled();
    });
});
