import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import InvoiceCheckoutView, { type CheckoutViewData } from '@/app/(public)/invoice/checkout/[id]/InvoiceCheckoutView';
import InvoiceSettingsForm from '@/app/(admin)/admin/settings/invoice/InvoiceSettingsForm';
import { getPublicInvoicePaymentOptions } from '@/lib/invoicePaymentMethods';

const invoices: CheckoutViewData['invoices'] = [
  { id: 'september', invoice_number: 'QA-09', periodLabel: 'September 2026', coderNames: ['Coder QA'], total_amount: 500000, status: 'OVERDUE', period_month: 9, period_year: 2026, period_start_date: '2026-09-26', period_end_date: '2026-10-25', invoice_type: 'MONTHLY', due_date: '2026-09-25' },
  { id: 'october', invoice_number: 'QA-10', periodLabel: 'Oktober 2026', coderNames: ['Coder QA'], total_amount: 680000, status: 'PENDING', period_month: 10, period_year: 2026, period_start_date: '2026-10-26', period_end_date: '2026-11-25', invoice_type: 'MONTHLY', due_date: '2026-10-25' },
];
const defaults: CheckoutViewData = { invoices, options: getPublicInvoicePaymentOptions(1180000), active: [], enabled: true, hasOtherActive: false };
const render = (patch: Partial<CheckoutViewData> = {}) => renderToStaticMarkup(<InvoiceCheckoutView id="qa" token="local-only" initialData={{ ...defaults, ...patch }} />);

describe('checkout presentation preserves the payment contract', () => {
  it('renders real invoice values, default-all and one fee with branded accessible controls', () => {
    const html = render();
    expect((html.match(/type="checkbox"[^>]*checked=""/g) || []).length).toBe(2);
    expect(html.includes('1.182.500')).toBe(true);
    expect(html.includes('Biaya admin transaksi')).toBe(true);
    expect(html.includes('QA-09') && html.includes('QA-10')).toBe(true);
    expect(html.includes('aria-label="Langkah pembayaran"')).toBe(true);
    expect(decodeURIComponent(html).includes('/logo/innovator-camp-logo-dark.png')).toBe(true);
    expect(decodeURIComponent(html).includes('/logo/innovator-camp-logo-light.png')).toBe(true);
  });
  it.each([{ enabled: false }, { hasOtherActive: true }])('keeps the payment CTA disabled for the safety guard %j', patch => {
    const html = render(patch);
    expect(/<button[^>]*disabled=""[^>]*>Buat instruksi pembayaran/.test(html)).toBe(true);
    expect(html.includes('role="alert"')).toBe(true);
  });
  it('shows paid completion without new charge controls or selected paid rows', () => {
    const html = render({ invoices: invoices.map(i => ({ ...i, status: 'PAID' })) });
    expect(html.includes('Semua tagihan sudah lunas')).toBe(true);
    expect(html.includes('Buat instruksi pembayaran')).toBe(false);
    expect(html.includes('payment-method')).toBe(false);
    expect((html.match(/type="checkbox"[^>]*checked=""/g) || []).length).toBe(0);
    expect((html.match(/type="checkbox"[^>]*disabled=""/g) || []).length).toBe(2);
  });
  it('locks every row during review and never presents another charge or cancel action', () => {
    const html = render({ active: [{ orderId: 'LMSB-QA', state: 'REVIEW', invoiceIds: ['october'], total: 682500, adminFee: 2500, payment: null }] });
    expect(html.includes('Jangan membayar ulang.')).toBe(true);
    expect(html.includes('Periksa status')).toBe(true);
    expect(html.includes('Buat instruksi pembayaran') || html.includes('Batalkan &amp; ubah pilihan')).toBe(false);
    expect((html.match(/type="checkbox"[^>]*disabled=""/g) || []).length).toBe(2);
    expect((html.match(/type="checkbox"[^>]*checked=""/g) || []).length).toBe(1);
  });
  it('renders issued VA and provider total without recalculating the locked instruction', () => {
    const html = render({ active: [{ orderId: 'LMSB-QA', state: 'PENDING', invoiceIds: ['october'], total: 684000, adminFee: 4000,
      payment: { method: 'bni_va', label: 'BNI Virtual Account', baseAmount: 680000, adminFee: 4000, total: 684000, feeLabel: 'Biaya admin', bank: 'bni', vaNumber: '000011112222', billerCode: null, billKey: null, qrImageUrl: null } }] });
    expect(html.includes('684.000') && html.includes('000011112222')).toBe(true);
    expect(html.includes('aria-label="Salin Nomor Virtual Account"')).toBe(true);
    expect(html.includes('Buat instruksi pembayaran')).toBe(false);
  });
  it('keeps the grouped template conditional and preserves all existing editable settings', () => {
    for (const checkoutEnabled of [false, true]) {
      const html = renderToStaticMarkup(<InvoiceSettingsForm initialSettings={null} checkoutEnabled={checkoutEnabled} />);
      expect(html.includes('id="checkout-template"')).toBe(checkoutEnabled);
      expect((html.match(/<textarea/g) || []).length).toBe(checkoutEnabled ? 5 : 4);
      expect(html.includes('invoice-reminder-template') && html.includes('invoice-registration-template')).toBe(true);
      expect(html.includes('Simpan Pengaturan')).toBe(true);
    }
  });
});
