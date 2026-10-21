import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import InvoiceView from '@/app/(public)/invoice/[invoiceNumber]/InvoiceView';
import InvoiceManagement from '@/app/(admin)/admin/payments/invoices/InvoiceManagement';
import type { Invoice } from '@/lib/types/invoice';
import { toPublicInvoice } from '@/lib/publicInvoice';

vi.stubGlobal('React', React);
vi.mock('next/image', () => ({ default: ({ priority: _priority, unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; unoptimized?: boolean }) => React.createElement('img', props) }));
vi.mock('@/contexts/ReminderContext', () => ({ useReminder: () => ({ startReminder: vi.fn(), isProcessing: false }) }));

const fixture: Invoice = {
  id: 'invoice-fixture', invoice_number: 'INV-QA-102026', ccr_id: null,
  parent_name: 'Orang Tua QA', parent_phone: '', invoice_type: 'MONTHLY',
  period_month: 10, period_year: 2026, period_start_date: '2026-10-26', period_end_date: '2026-11-25',
  total_amount: 300000, status: 'PENDING', due_date: '2026-10-25', paid_at: null, paid_notes: null,
  created_at: '2026-10-21T00:00:00Z', updated_at: '2026-10-21T00:00:00Z',
  items: [{ id: 'item-qa', invoice_id: 'invoice-fixture', coder_id: null, coder_name: 'Coder QA', class_name: 'Weekly QA', level_name: 'XPLORER', base_price: 300000, discount_amount: 0, final_price: 300000, payment_period_id: null, created_at: '2026-10-21T00:00:00Z', billing_period: { payment_plans: { duration_months: 1 } } }],
};
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const renderPublic = (invoice: Invoice) => textOf(renderToStaticMarkup(React.createElement(InvoiceView, {
  invoice: toPublicInvoice(invoice), paymentOptions: [], bankInfo: null,
})));

describe('real invoice screens use billing month for monthly invoices', () => {
  it.each(['PENDING', 'PAID'] as const)('renders a single billing month on the public %s invoice', (status) => {
    const text = renderPublic({ ...fixture, status, paid_at: status === 'PAID' ? '2026-11-04T00:00:00Z' : null });
    expect(text).toMatch(/Bulan Pembayaran:\s*Oktober 2026/);
    expect(text).not.toMatch(/Oktober\s*-\s*November/);
    expect(text).toMatch(/300\.000/);
  });

  it('retains the seasonal range and registration-specific layout', () => {
    expect(renderPublic({ ...fixture, invoice_type: 'SEASONAL' })).toMatch(/Periode:\s*Oktober - November 2026/);
    expect(renderPublic({ ...fixture, invoice_type: 'REGISTRATION' })).not.toMatch(/Bulan Pembayaran:/);
  });

  it('renders the same billing month in the admin table', () => {
    const text = textOf(renderToStaticMarkup(React.createElement(InvoiceManagement, {
      initialInvoices: [fixture], initialStats: { pending: 1, paid: 0, overdue: 0, totalAmount: 300000 },
      initialMonth: 10, initialYear: 2026,
    })));
    expect(text).toMatch(/Okt 2026/);
    expect(text).not.toMatch(/Okt\s*-\s*Nov/);
  });

  it('keeps a three-month range on both screens, even though its invoice type is MONTHLY', () => {
    const invoice: Invoice = { ...fixture, period_end_date: '2027-01-25', items: fixture.items!.map(item => ({ ...item, billing_period: { payment_plans: { duration_months: 3 } } })) };
    expect(renderPublic(invoice)).toMatch(/Periode:\s*Oktober 2026 - Januari 2027/);
    expect(renderPublic(invoice)).not.toMatch(/Bulan Pembayaran:/);
    const text = textOf(renderToStaticMarkup(React.createElement(InvoiceManagement, {
      initialInvoices: [invoice], initialStats: { pending: 1, paid: 0, overdue: 0, totalAmount: 300000 },
      initialMonth: 10, initialYear: 2026,
    })));
    expect(text).toMatch(/Okt 2026 - Jan 2027/);
  });
});
