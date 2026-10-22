import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ stored: vi.fn(), intent: vi.fn(), members: vi.fn() }));
vi.mock('@/lib/invoicePaymentStore', () => ({ getStoredInvoicePaymentByInvoiceId: m.stored }));
vi.mock('@/lib/services/invoiceCheckoutServer', () => ({ getCheckoutIntent: m.intent, intentInvoiceIds: m.members }));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceById: async () => invoice }));
vi.mock('@/lib/services/invoicePublicAccess', () => ({ verifyInvoicePublicToken: () => true }));
import { getCurrentStoredInvoicePayment, isLiveSingleInvoiceCheckout } from '@/lib/services/invoicePaymentInstructions';
import { GET as getQr } from '@/app/api/invoices/[id]/payment-qr/route';
import type { Invoice } from '@/lib/types/invoice';

const invoice = { id: 'local-invoice', invoice_number: 'QA-LOCAL', total_amount: 500000, status: 'PENDING' } as Invoice;
beforeEach(() => {
  vi.resetAllMocks();
  m.stored.mockResolvedValue({ invoiceId: invoice.id, orderId: 'LMSB-local', paymentDetails: { vaNumber: 'QA-NOT-PAYABLE' } });
  m.intent.mockResolvedValue({ state: 'PENDING', base_amount: 500000 });
  m.members.mockResolvedValue([invoice.id]);
});

describe('legacy invoice page instructions follow the checkout ledger', () => {
  it('preserves old non-checkout instructions without querying the additive schema', async () => {
    const old = { orderId: 'LMS-old' }; m.stored.mockResolvedValue(old);
    expect(await getCurrentStoredInvoicePayment(invoice)).toEqual(old);
    expect(m.intent).not.toHaveBeenCalled(); expect(m.members).not.toHaveBeenCalled();
  });
  it('shows pending single-invoice instructions, then removes them after cancellation or settlement', async () => {
    expect(await getCurrentStoredInvoicePayment(invoice)).toEqual(expect.objectContaining({ orderId: 'LMSB-local' }));
    for (const state of ['CREATING', 'CANCELLED', 'PAID', 'REVIEW']) {
      m.intent.mockResolvedValue({ state, base_amount: 500000 });
      expect(await getCurrentStoredInvoicePayment(invoice)).toBeNull();
    }
  });
  it('cannot expose grouped payment instructions through a single-invoice token', async () => {
    m.members.mockResolvedValue([invoice.id, 'other-invoice']);
    expect(await getCurrentStoredInvoicePayment(invoice)).toBeNull();
    m.members.mockResolvedValue(['foreign-invoice']);
    expect(await isLiveSingleInvoiceCheckout(invoice, 'LMSB-local')).toBe(false);
  });
  it('withholds stale instructions when an invoice is paid or its amount no longer matches', async () => {
    expect(await getCurrentStoredInvoicePayment({ ...invoice, status: 'PAID' })).toBeNull();
    m.intent.mockResolvedValue({ state: 'PENDING', base_amount: 1 });
    expect(await getCurrentStoredInvoicePayment(invoice)).toBeNull();
  });
  it('fails closed without rendering stale details on missing/unavailable ledger', async () => {
    m.intent.mockResolvedValue(null);
    expect(await getCurrentStoredInvoicePayment(invoice)).toBeNull();
    m.intent.mockRejectedValue(new Error('storage unavailable'));
    expect(await getCurrentStoredInvoicePayment(invoice)).toBeNull();
  });
  it('rejects cancelled and grouped QR requests before accessing the provider', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No live HTTP in tests'));
    try {
      const request = () => new NextRequest('http://localhost/api/invoices/local-invoice/payment-qr?t=local&order=LMSB-local');
      m.intent.mockResolvedValue({ state: 'CANCELLED', base_amount: 500000 });
      expect((await getQr(request(), { params: Promise.resolve({ id: invoice.id }) })).status).toBe(409);
      m.intent.mockResolvedValue({ state: 'PENDING', base_amount: 500000 }); m.members.mockResolvedValue([invoice.id, 'other']);
      expect((await getQr(request(), { params: Promise.resolve({ id: invoice.id }) })).status).toBe(409);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('serves only the current pending single-invoice QR, with no-store headers', async () => {
    m.stored.mockResolvedValue({ orderId: 'LMSB-local', paymentDetails: { method: 'qris', qrCodeUrl: 'https://api.sandbox.midtrans.com/local-qa/qr' } });
    const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
    try {
      const request = new NextRequest('http://localhost/api/invoices/local-invoice/payment-qr?t=local&order=LMSB-local');
      const response = await getQr(request, { params: Promise.resolve({ id: invoice.id }) });
      expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
      expect(network).toHaveBeenCalledTimes(1);
    } finally { network.mockRestore(); }
  });
});
