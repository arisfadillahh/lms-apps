import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildInvoicePaymentBreakdown, getInvoicePaymentOption, getPublicInvoicePaymentOptions } from '@/lib/invoicePaymentMethods';
import { InvoiceMidtransClient, mapMidtransStatus } from '@/lib/invoiceMidtransClient';
import type { Invoice } from '@/lib/types/invoice';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('direct GoPay disabled, interoperable QRIS retained', () => {
  it('exposes QRIS and existing bank methods, but not direct GoPay or BCA', () => {
    expect(getPublicInvoicePaymentOptions(100000).map(option => option.code)).toEqual([
      'qris', 'bsi_va', 'bni_va', 'bri_va', 'permata_va', 'cimb_va', 'mandiri_bill', 'other_va',
    ]);
    expect(getInvoicePaymentOption('gopay')).toBeNull();
    expect(buildInvoicePaymentBreakdown('gopay', 100000)).toBeNull();
    expect(getInvoicePaymentOption('bca_va')).toBeNull();
  });

  it('labels QRIS clearly and preserves the configured amount/fee calculation', () => {
    vi.stubEnv('MIDTRANS_ADMIN_FEE_FIXED', '2500');
    expect(buildInvoicePaymentBreakdown('qris', 100000)).toMatchObject({
      method: 'qris', label: 'QRIS', baseAmount: 100000, adminFee: 2500, total: 102500,
    });
    expect(getInvoicePaymentOption('qris')?.description).toMatch(/mobile banking.*QRIS/);
  });

  it('keeps the gateway GoPay mapping needed to issue QRIS, using mocked transport only', async () => {
    vi.stubEnv('MIDTRANS_SERVER_KEY', 'SB-Mid-server-LOCAL-MOCK-NOT-A-CREDENTIAL');
    vi.stubEnv('MIDTRANS_IS_PRODUCTION', 'false');
    vi.stubEnv('NEXTAUTH_URL', 'http://127.0.0.1:3005');
    vi.stubEnv('MIDTRANS_ADMIN_FEE_FIXED', '2500');
    const transport = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'mock-snap', redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-snap' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status_code: '201', transaction_status: 'pending', payment_type: 'gopay',
        actions: [{ name: 'generate-qr-code', url: 'https://api.sandbox.midtrans.com/v2/gopay/mock/qr-code' }],
      }), { status: 201 }));
    vi.stubGlobal('fetch', transport);
    const invoice = { id: 'mock-invoice', invoice_number: 'QA-QRIS', parent_name: 'Synthetic QA', parent_phone: '', total_amount: 100000, items: [] } as unknown as Invoice;
    const payment = buildInvoicePaymentBreakdown('qris', 100000)!;
    const result = await new InvoiceMidtransClient().createPayment(invoice, payment, 'QA-QRIS-MOCK');
    expect(transport).toHaveBeenCalledTimes(2);
    const [snapUrl, snapOptions] = transport.mock.calls[0];
    const [chargeUrl, chargeOptions] = transport.mock.calls[1];
    expect(new URL(snapUrl).origin).toBe('https://app.sandbox.midtrans.com');
    expect(new URL(chargeUrl).origin).toBe('https://app.sandbox.midtrans.com');
    expect(JSON.parse(snapOptions.body)).toMatchObject({ enabled_payments: ['gopay'], transaction_details: { gross_amount: 102500 } });
    expect(snapOptions.headers['X-Override-Notification']).toBe('http://127.0.0.1:3005/api/midtrans/notification');
    expect(JSON.parse(chargeOptions.body)).toEqual({ payment_type: 'gopay' });
    expect(result.paymentDetails).toMatchObject({ method: 'qris', label: 'QRIS', total: 102500, qrCodeUrl: 'https://api.sandbox.midtrans.com/v2/gopay/mock/qr-code' });
  });

  it.each(['gopay', 'qris'])('still recognizes settlement for issued %s transactions', (payment_type) => {
    expect(mapMidtransStatus({ payment_type, transaction_status: 'settlement', status_code: '200' })).toBe('paid');
    expect(mapMidtransStatus({ payment_type, transaction_status: 'pending', status_code: '201' })).toBe('waiting_payment');
    expect(mapMidtransStatus({ payment_type, transaction_status: 'expire', status_code: '407' })).toBe('expired');
  });
});
