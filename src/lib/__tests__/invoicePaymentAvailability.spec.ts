import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildInvoicePaymentBreakdown, getInvoicePaymentOption, getPublicInvoicePaymentOptions } from '@/lib/invoicePaymentMethods';
import { InvoiceMidtransClient, mapMidtransStatus } from '@/lib/invoiceMidtransClient';
import type { Invoice } from '@/lib/types/invoice';
import { testQr } from './fixtures/paymentQr';
vi.mock('server-only',()=>({}));
const browser=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/invoiceSnapBrowser',()=>({issueSnapInBrowser:browser}));
vi.mock('@/lib/invoicePaymentStore',()=>({getStoredInvoicePaymentByInvoiceId:async()=>null}));
vi.mock('@/lib/invoiceIssuanceJournal',()=>({getIssuanceByOrder:async()=>null,withInvoiceIssuance:async(_id:string,run:(j:unknown)=>Promise<unknown>)=>run({read:async()=>null,write:async()=>{}})}));

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

  it('charges exactly Rp2,500 for every available method regardless of stale environment settings', () => {
    vi.stubEnv('MIDTRANS_ADMIN_FEE_FIXED', '7000');
    for (const amount of [10000, 350000, 1500000]) {
      for (const option of getPublicInvoicePaymentOptions(amount)) {
        expect(option.adminFee).toBe(2500);
        expect(option.total).toBe(amount + 2500);
        expect(buildInvoicePaymentBreakdown(option.code, amount)?.adminFee).toBe(2500);
      }
    }
  });

  it('keeps the GoPay QRIS mapping and issues through normal Snap without a direct unsigned charge', async () => {
    vi.stubEnv('MIDTRANS_SERVER_KEY', 'SB-Mid-server-LOCAL-MOCK-NOT-A-CREDENTIAL');
    vi.stubEnv('MIDTRANS_IS_PRODUCTION', 'false');
    vi.stubEnv('NEXTAUTH_URL', 'http://127.0.0.1:3005');
    vi.stubEnv('MIDTRANS_ADMIN_FEE_FIXED', '2500');
    const transport = vi.fn().mockResolvedValueOnce(Response.json({ token: 'mock-snap' }, { status: 201 }));
    browser.mockResolvedValue({order_id:'QA-QRIS-MOCK',gross_amount:'102500.00',transaction_id:'local-transaction',
      status_code:'201',transaction_status:'pending',payment_type:'qris',qr_string:testQr(102500)});
    vi.stubGlobal('fetch', transport);
    const invoice = { id: 'mock-invoice', invoice_number: 'QA-QRIS', parent_name: 'Synthetic QA', parent_phone: '', total_amount: 100000, items: [] } as unknown as Invoice;
    const payment = buildInvoicePaymentBreakdown('qris', 100000)!;
    const result = await new InvoiceMidtransClient().createPayment(invoice, payment, 'QA-QRIS-MOCK');
    expect(transport).toHaveBeenCalledTimes(1);
    const [snapUrl, snapOptions] = transport.mock.calls[0];
    expect(new URL(snapUrl).origin).toBe('https://app.sandbox.midtrans.com');
    expect(JSON.parse(snapOptions.body)).toMatchObject({ enabled_payments: ['gopay'], transaction_details: { gross_amount: 102500 } });
    expect(snapOptions.headers['X-Override-Notification']).toBe('http://127.0.0.1:3005/api/midtrans/notification');
    expect(browser).toHaveBeenCalledWith('mock-snap',false);
    expect(result.paymentDetails).toMatchObject({ method:'qris',label:'QRIS',total:102500,qrString:testQr(102500),deeplinkUrl:null });
  });

  it.each(['gopay', 'qris'])('still recognizes settlement for issued %s transactions', (payment_type) => {
    expect(mapMidtransStatus({ payment_type, transaction_status: 'settlement', status_code: '200' })).toBe('paid');
    expect(mapMidtransStatus({ payment_type, transaction_status: 'pending', status_code: '201' })).toBe('waiting_payment');
    expect(mapMidtransStatus({ payment_type, transaction_status: 'expire', status_code: '407' })).toBe('expired');
  });
});
