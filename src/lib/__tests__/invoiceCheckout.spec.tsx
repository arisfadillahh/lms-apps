import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_CHECKOUT_MESSAGE, checkoutSelectedTotal, defaultCheckoutSelection, formatCheckoutMessage, toCheckoutInvoice, validateCheckoutInvoices } from '@/lib/invoiceCheckout';
import { planInvoiceBillingCycle, type BillingCycleInput } from '@/lib/invoiceBillingCycle';
import type { Invoice } from '@/lib/types/invoice';
import InvoiceCheckoutView from '@/app/(public)/invoice/checkout/[id]/InvoiceCheckoutView';
import { getPublicInvoicePaymentOptions } from '@/lib/invoicePaymentMethods';

function invoice(month: number, extra: Partial<Invoice> = {}): Invoice {
  return { id: `00000000-0000-4000-8000-${String(month).padStart(12,'0')}`, invoice_number: `QA-${month}`, ccr_id: 'family-1', parent_phone: '628123456789', parent_name: 'QA Parent',
    period_month: month, period_year: 2026, period_start_date: `2026-${String(month).padStart(2,'0')}-26`, period_end_date: '2026-12-25',
    total_amount: 500000, status: 'PENDING', invoice_type: 'MONTHLY', due_date: '2026-10-25', paid_at: null, paid_notes: null, created_at: '', updated_at: '', items: [], ...extra };
}
const cycle: BillingCycleInput = { anchorEnd:'2026-09-25',durationMonths:1,month:10,year:2026,today:'2026-10-21',enrolledAt:'2026-01-01',classStart:'2026-01-01',classEnd:'2027-12-31',lifecycle:'ACTIVE',periodStatus:'EXPIRED',hasPauseSinceAnchor:false };

describe('selected invoices: real inputs and rendered user view', () => {
  it('selects every unpaid month by default, including old overdue, but never paid', () => {
    const list = [invoice(10), invoice(8,{status:'OVERDUE'}), invoice(9,{status:'PAID'})].map(toCheckoutInvoice);
    expect(defaultCheckoutSelection(list)).toEqual([list[1].id,list[0].id]);
    expect(checkoutSelectedTotal(list,[list[0].id,list[1].id])).toBe(1000000);
    expect(checkoutSelectedTotal(list,[list[1].id])).toBe(500000);
  });
  it('rejects stale paid, duplicate, empty and out-of-scope selections', () => {
    const list = [invoice(9),invoice(10,{status:'PAID'})].map(toCheckoutInvoice);
    for (const ids of [[],[list[0].id,list[0].id],[list[1].id],['other']]) expect(()=>checkoutSelectedTotal(list,ids)).toThrow();
  });
  it('refuses mixed families and non-class invoice types', () => {
    expect(()=>validateCheckoutInvoices([invoice(9),invoice(10,{ccr_id:'family-2'})])).toThrow();
    expect(()=>validateCheckoutInvoices([invoice(9),invoice(10,{invoice_type:'SEASONAL'})])).toThrow();
    expect(()=>validateCheckoutInvoices([invoice(9),invoice(10,{parent_phone:'628999999999'})])).toThrow();
  });
  it('formats actual WA newlines with unpaid items only, without forcing payment of the total', () => {
    const message = formatCheckoutMessage([invoice(9),invoice(10,{status:'PAID'})],'QA $& Parent','https://example.test/checkout');
    expect(message.split('\n').filter(l=>l.startsWith('• '))).toHaveLength(1);
    expect(message.includes('QA $& Parent')).toBe(true);
    expect(message.includes('\\n')).toBe(false);
    expect(message.includes('https://example.test/checkout')).toBe(true);
    expect(()=>formatCheckoutMessage([invoice(9)],'QA','https://example.test','{parent_name}')).toThrow();
    expect(DEFAULT_CHECKOUT_MESSAGE.includes('satu tagihan')).toBe(true);
  });
  it('renders all unpaid checkboxes checked and the real payment total before provider charge', () => {
    const html = renderToStaticMarkup(<InvoiceCheckoutView id="qa" token="local-test" initialData={{ invoices:[invoice(9),invoice(10)].map(toCheckoutInvoice),options:getPublicInvoicePaymentOptions(1000000),active:[],hasOtherActive:false,enabled:true }} />);
    expect((html.match(/type="checkbox"[^>]*checked=""/g)??[]).length).toBe(2);
    expect(html.includes('1.002.500')).toBe(true);
    expect(html.includes('Buat instruksi pembayaran')).toBe(true);
  });
  it('locks only the allocated subset when an issued instruction exists', () => {
    const html = renderToStaticMarkup(<InvoiceCheckoutView id="qa" token="local-test" initialData={{invoices:[invoice(9),invoice(10)].map(toCheckoutInvoice),options:[],hasOtherActive:false,enabled:true,
      active:[{orderId:'LMSB-test',state:'CREATING',invoiceIds:[invoice(9).id],total:502500,adminFee:2500,payment:null}]}} />);
    expect((html.match(/type="checkbox"[^>]*disabled=""/g)??[]).length).toBe(2);
    expect((html.match(/type="checkbox"[^>]*checked=""/g)??[]).length).toBe(1);
    expect(html.includes('Periksa status')).toBe(true);
    expect(html.includes('Buat instruksi pembayaran')).toBe(false);
  });
});

describe('billing eligibility independent of paid access', () => {
  it('can invoice September, October and November without marking the previous bill paid', () => {
    for (const month of [9,10,11]) expect(planInvoiceBillingCycle({...cycle,month,today:'2026-11-01'})).toEqual({start:`2026-${String(month).padStart(2,'0')}-26`,end:month===9?'2026-10-25':month===10?'2026-11-25':'2026-12-25'});
  });
  it('keeps a three-month plan on its original three-month cadence', () => {
    const c = {...cycle,durationMonths:3,today:'2026-12-01'};
    expect(planInvoiceBillingCycle({...c,month:9})).toEqual({start:'2026-09-26',end:'2026-12-25'});
    expect(planInvoiceBillingCycle({...c,month:10})).toBeNull();
    expect(planInvoiceBillingCycle({...c,month:11})).toBeNull();
    expect(planInvoiceBillingCycle({...c,month:12})).toEqual({start:'2026-12-26',end:'2027-03-25'});
  });
  it('does not bill inactive/stopped/paused classes, future months, unknown duration or unreviewed cuti', () => {
    for(const patch of [{lifecycle:'PAUSED'},{lifecycle:'ENDED'},{periodStatus:'STOPPED'},{hasPauseSinceAnchor:true},{durationMonths:0},{durationMonths:NaN},{month:11},{classEnd:'2026-10-01'}]) expect(planInvoiceBillingCycle({...cycle,...patch})).toBeNull();
  });
  it('does not back-bill before reactivation and does not shift/extend the paid period for cuti', () => {
    expect(planInvoiceBillingCycle({...cycle,month:9,enrolledAt:'2026-10-01'})).toBeNull();
    expect(planInvoiceBillingCycle({...cycle,enrolledAt:'2026-10-01'})).toEqual({start:'2026-10-26',end:'2026-11-25'});
    expect(cycle.anchorEnd).toBe('2026-09-25');
  });
  it('checks before/on/after reactivation and month boundaries, including year rollover', () => {
    expect(planInvoiceBillingCycle({...cycle,enrolledAt:'2026-10-25'})).not.toBeNull();
    expect(planInvoiceBillingCycle({...cycle,enrolledAt:'2026-10-26'})).not.toBeNull();
    expect(planInvoiceBillingCycle({...cycle,enrolledAt:'2026-10-27'})).toBeNull();
    expect(planInvoiceBillingCycle({...cycle,month:11,today:'2026-10-31'})).toBeNull();
    expect(planInvoiceBillingCycle({...cycle,month:11,today:'2026-11-01'})).not.toBeNull();
    expect(planInvoiceBillingCycle({...cycle,anchorEnd:'2026-12-25',month:1,year:2027,today:'2027-01-01'})).toEqual({start:'2027-01-26',end:'2027-02-25'});
  });
});
