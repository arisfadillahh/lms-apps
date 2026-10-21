import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/invoices/[id]/payment-method/route';

const mock = vi.hoisted(() => ({ getInvoice: vi.fn(), getStored: vi.fn(), save: vi.fn(), getAdmin: vi.fn(), createPayment: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceById: mock.getInvoice }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: mock.getAdmin }));
vi.mock('@/lib/services/invoicePublicAccess', () => ({ verifyInvoicePublicToken: (_invoice: unknown, token: string) => token === 'valid-local-token' }));
vi.mock('@/lib/invoiceMidtransClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/invoiceMidtransClient')>(),
  InvoiceMidtransClient: class { createPayment = mock.createPayment; },
}));
vi.mock('@/lib/invoicePaymentStore', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/invoicePaymentStore')>(),
  getStoredInvoicePaymentByInvoiceId: mock.getStored, saveStoredInvoicePayment: mock.save,
}));

const fixture = { id: 'mock-invoice', invoice_number: 'LOCAL-INV', status: 'PENDING', total_amount: 100000 };
const call = (method: string, token = 'valid-local-token') => POST(new NextRequest('http://127.0.0.1:3005/api/invoices/mock-invoice/payment-method', {
  method: 'POST', body: JSON.stringify({ method, token }), headers: { 'Content-Type': 'application/json' },
}), { params: Promise.resolve({ id: fixture.id }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('MIDTRANS_ADMIN_FEE_FIXED', '2500');
  mock.getInvoice.mockResolvedValue(fixture);
  mock.getStored.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('invoice payment selection API', () => {
  it('rejects direct GoPay before gateway calls or persistence, including old cached clients', async () => {
    const response = await call('gopay');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Metode pembayaran tidak tersedia.' });
    expect(mock.createPayment).not.toHaveBeenCalled();
    expect(mock.getStored).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.getAdmin).not.toHaveBeenCalled();
  });

  it('retains token and already-paid guards before issuing any payment', async () => {
    expect((await call('qris', 'invalid')).status).toBe(404);
    mock.getInvoice.mockResolvedValue({ ...fixture, status: 'PAID' });
    expect((await call('qris')).status).toBe(409);
    expect(mock.createPayment).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('still issues QRIS instructions with correct totals and a protected QR URL', async () => {
    const details = { method: 'qris', label: 'QRIS', baseAmount: 100000, adminFee: 2500, total: 102500, feeLabel: 'Rp2.500', qrCodeUrl: 'https://api.sandbox.midtrans.com/v2/gopay/mock/qr-code', deeplinkUrl: null, bank: null, vaNumber: null, billerCode: null, billKey: null };
    mock.createPayment.mockResolvedValue({ orderId: 'LOCAL-QRIS', paymentDetails: details });
    mock.save.mockResolvedValue({ ...details, invoiceId: fixture.id, orderId: 'LOCAL-QRIS', paymentDetails: details });
    // Existing file fallback is tested in-memory; no Supabase writes are permitted.
    mock.getAdmin.mockImplementation(() => { throw new Error('Mock DB unavailable'); });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await call('qris');
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(mock.createPayment).toHaveBeenCalledWith(fixture, expect.objectContaining({ method: 'qris', total: 102500 }), expect.any(String));
    expect(body.payment).toMatchObject({ method: 'qris', label: 'QRIS', total: 102500 });
    expect(body.payment.qrImageUrl).toBe('/api/invoices/mock-invoice/payment-qr?t=valid-local-token&order=LOCAL-QRIS');
    expect(body.options.some((option: { code: string }) => option.code === 'gopay')).toBe(false);
  });
});
