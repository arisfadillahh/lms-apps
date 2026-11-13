import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  getInvoice: vi.fn(), markPaid: vi.fn(), extend: vi.fn(), settle: vi.fn(), deliver: vi.fn(),
  stored: vi.fn(), updateStored: vi.fn(), claim: vi.fn(), finish: vi.fn(), from: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async original => ({ ...await original<typeof import('next/server')>(), after: (fn: () => void) => fn() }));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceById: m.getInvoice, markInvoiceAsPaid: m.markPaid, extendPaymentPeriodsForInvoice: m.extend, getInvoiceSettings: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({ from: m.from }) }));
vi.mock('@/lib/invoicePaymentStore', () => ({ getStoredInvoicePaymentByOrderId: m.stored, updateStoredInvoicePaymentStatus: m.updateStored }));
vi.mock('@/lib/services/holidayClassPayment', () => ({ settleHolidayPayment: m.settle }));
vi.mock('@/lib/services/holidayClassMessaging', () => ({ deliverHolidayWhatsApp: m.deliver }));
vi.mock('@/lib/invoiceMidtransClient', async original => ({ ...await original<typeof import('@/lib/invoiceMidtransClient')>(), verifyMidtransSignature: () => true }));
vi.mock('@/lib/midtransWebhookSecurity', () => ({ buildMidtransWebhookEventKey: () => 'qa-event', claimMidtransWebhookEvent: m.claim, finishMidtransWebhookEvent: m.finish, sanitizeMidtransNotificationPayload: (p: unknown) => p }));
vi.mock('@/lib/services/trialConversion', () => ({ markTrialConversionPaidFromInvoice: vi.fn() }));
vi.mock('@/lib/dao/notificationsDao', () => ({ createAdminNotifications: vi.fn() }));
vi.mock('@/lib/services/trialClassNotifications', () => ({ sendTrialConversionAdminWhatsAppNotification: vi.fn() }));
vi.mock('@/lib/services/whatsappClient', () => ({ sendWhatsAppMessage: vi.fn() }));
vi.mock('@/lib/services/shortLinks', () => ({ getShortInvoiceUrlOrOriginal: vi.fn() }));
vi.mock('@/lib/services/invoiceCheckoutServer', () => ({ getCheckoutIntent: vi.fn(), finishCheckoutFromProvider: vi.fn() }));
vi.mock('@/lib/services/invoiceCheckoutMessaging', () => ({ sendCheckoutPaidConfirmation: vi.fn() }));

import { POST } from '@/app/api/midtrans/notification/route';

const invoice = { id: 'holiday-invoice', invoice_number: 'HC-2627-000001', total_amount: 350000, status: 'PENDING', invoice_type: 'SEASONAL' };
const payload = { order_id: 'LMS-holiday-qris', gross_amount: '352500.00', status_code: '200', transaction_status: 'settlement' };
const request = (p = payload) => new NextRequest('http://localhost/api/midtrans/notification', { method: 'POST', body: JSON.stringify(p) });

beforeEach(() => {
  vi.resetAllMocks();
  m.claim.mockResolvedValue('CLAIMED');
  m.getInvoice.mockResolvedValue(invoice);
  m.settle.mockResolvedValue('registration-qa');
  m.deliver.mockResolvedValue(undefined);
});

describe('Holiday standard invoice payment notifications', () => {
  it('keeps the new selected method when an older cancelled order notifies late',async()=>{
    m.getInvoice.mockResolvedValue({...invoice,midtrans_order_id:'LMS-new-active'});
    const updates:string[]=[];
    m.from.mockImplementation((table:string)=>({
      select:()=>({eq:()=>({single:async()=>({data:{id:'old-attempt',invoice_id:invoice.id,base_amount:350000,total_amount:352500},error:null})})}),
      update:()=>{updates.push(table);return {eq:async()=>({error:null})};},
    }));
    const response=await POST(request({...payload,status_code:'200',transaction_status:'cancel'}));
    expect(await response.json()).toMatchObject({historical:true,status:'cancelled'});
    expect(updates).toEqual(['invoice_payment_attempts']);expect(m.settle).not.toHaveBeenCalled();expect(m.deliver).not.toHaveBeenCalled();
  });
  it('settles a stored bank payment and schedules Holiday confirmations without altering regular tuition access', async () => {
    const attempt = { id: 'attempt', invoice_id: invoice.id, payment_method: 'bni_va', base_amount: 350000, total_amount: 352500 };
    m.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: attempt, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }));
    expect((await POST(request())).status).toBe(200);
    expect(m.settle).toHaveBeenCalledWith(payload, invoice, 352500);
    expect(m.deliver).toHaveBeenCalledWith('registration-qa');
    expect(m.markPaid).not.toHaveBeenCalled();
    expect(m.extend).not.toHaveBeenCalled();
  });

  it('also delivers confirmations when the original payment used the file persistence fallback', async () => {
    m.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: {} }) }) }) });
    m.stored.mockResolvedValue({ invoiceId: invoice.id, baseAmount: 350000, total: 352500 });
    expect((await POST(request())).status).toBe(200);
    expect(m.settle).toHaveBeenCalledWith(payload, invoice, 352500);
    expect(m.deliver).toHaveBeenCalledWith('registration-qa');
  });

  it('does not settle or send a paid notification while the payment is pending', async () => {
    m.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: {} }) }) }) });
    m.stored.mockResolvedValue({ invoiceId: invoice.id, baseAmount: 350000, total: 352500 });
    expect((await POST(request({ ...payload, status_code: '201', transaction_status: 'pending' }))).status).toBe(200);
    expect(m.settle).not.toHaveBeenCalled();
    expect(m.deliver).not.toHaveBeenCalled();
  });
});
