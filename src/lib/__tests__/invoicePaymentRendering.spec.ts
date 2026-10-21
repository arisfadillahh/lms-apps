import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import InvoiceView from '@/app/(public)/invoice/[invoiceNumber]/InvoiceView';
import { getPublicInvoicePaymentOptions, type PublicInvoicePaymentInstruction } from '@/lib/invoicePaymentMethods';
import type { Invoice } from '@/lib/types/invoice';

vi.stubGlobal('React', React);
vi.mock('next/image', () => ({ default: ({ priority: _priority, unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; unoptimized?: boolean }) => React.createElement('img', props) }));
const invoice: Invoice = {
  id: 'invoice-qa', invoice_number: 'INV-QA', ccr_id: null, parent_name: 'Synthetic QA', parent_phone: '',
  invoice_type: 'MONTHLY', period_month: 10, period_year: 2026, period_start_date: '2026-10-26', period_end_date: '2026-11-25',
  total_amount: 100000, status: 'PENDING', due_date: '2026-10-25', paid_at: null, paid_notes: null,
  created_at: '2026-10-21T00:00:00Z', updated_at: '2026-10-21T00:00:00Z', items: [],
};
const base: PublicInvoicePaymentInstruction = {
  method: 'qris', label: 'QR GoPay', baseAmount: 100000, adminFee: 2500, total: 102500, feeLabel: 'Rp2.500',
  bank: null, vaNumber: null, billerCode: null, billKey: null, deeplinkUrl: null,
  qrImageUrl: '/api/invoices/invoice-qa/payment-qr?t=mock-token&order=mock-order',
};
const render = (payment: PublicInvoicePaymentInstruction) => renderToStaticMarkup(React.createElement(InvoiceView, {
  invoice, paymentOptions: getPublicInvoicePaymentOptions(100000), initialPayment: payment, bankInfo: null,
}));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('invoice payment instructions remain compatible', () => {
  it('renders issued QR GoPay instructions as QRIS without losing the protected QR', () => {
    const html = render(base);
    expect(text(html)).toMatch(/QRIS/);
    expect(text(html)).toMatch(/mobile banking.*dompet digital.*QRIS/);
    expect(text(html)).not.toMatch(/QR GoPay/);
    expect(html).toMatch(/payment-qr\?t=mock-token&amp;order=mock-order/);
    expect(text(html)).toMatch(/102\.500/);
  });

  it('preserves the valid link for a previously issued direct GoPay transaction', () => {
    const html = render({ ...base, method: 'gopay', label: 'GoPay', qrImageUrl: null, deeplinkUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/issued-mock' });
    expect(text(html)).toMatch(/Bayar via GoPay/);
    expect(html).toMatch(/href="https:\/\/app\.sandbox\.midtrans\.com\/snap\/v2\/vtweb\/issued-mock"/);
    expect(html).not.toMatch(/payment-qr\?/);
  });
});
