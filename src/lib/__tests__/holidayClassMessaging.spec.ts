import { describe, expect, it, vi } from 'vitest';
import type { Invoice } from '@/lib/types/invoice';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceById: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('@/lib/services/trialClassNotifications', () => ({ trialAdminWhatsAppGroup: vi.fn() }));
vi.mock('@/lib/services/holidayClassPayment', () => ({ holidayInvoiceUrl: () => 'https://example.test/invoice/HC-2627-999999?t=synthetic' }));

import { holidayWhatsAppMessage } from '@/lib/services/holidayClassMessaging';

const one = [{ name: 'Creative Coding', batch: 'Batch 1', time: '09.00–10.30' }];
const two = [...one, { name: 'Game Design', batch: 'Batch 2', time: '13.00–14.30' }];
const invoice = (status: 'PENDING' | 'PAID' = 'PENDING', parent_name = 'Rina Pratama', total_amount = 299000) => ({
  id: 'synthetic-id', invoice_number: 'HC-2627-999999', parent_name, parent_phone: '6280000000000',
  seasonal_student_name: 'Naya', total_amount, due_date: '2026-11-26', status,
}) as Invoice;

describe('Holiday group message baseline', () => {
  for (const kind of ['registration_group', 'paid_group'] as const) {
    for (const status of ['PENDING', 'PAID'] as const) {
      for (const platform of ['none', 'own', 'clevio'] as const) {
        for (const selections of [one, two]) {
          it(`${kind} ${status} ${platform} ${selections.length} selections`, () => {
            expect(holidayWhatsAppMessage(kind, invoice(status, 'Rina Pratama', selections.length === 1 ? 299000 : 598000), {
              invoice_id: 'synthetic-id', platform, selections,
            })).toMatchSnapshot();
          });
        }
      }
    }
  }
});

describe('Holiday parent copy', () => {
  const registration = (selections = one) => ({ invoice_id: 'synthetic-id', platform: 'clevio' as const, selections });
  it.each(['invoice_parent', 'reminder_1', 'reminder_3', 'paid_parent'] as const)('%s uses a trimmed parent name and never includes Open Code', kind => {
    const message = holidayWhatsAppMessage(kind, invoice(kind === 'paid_parent' ? 'PAID' : 'PENDING', '  Rina Pratama  '), registration());
    expect(message).toContain('Ayah/Bunda Rina Pratama');
    expect(message).not.toContain('Open Code');
  });
  it.each(['invoice_parent', 'reminder_1', 'reminder_3', 'paid_parent'] as const)('%s omits a missing parent name cleanly', kind => {
    const message = holidayWhatsAppMessage(kind, invoice('PENDING', '  '), registration());
    expect(message).toContain('Ayah/Bunda');
    expect(message).not.toContain('Ayah/Bunda  ');
  });
  it('renders the date-only due date without shifting the day and formats amount and link', () => {
    const message = holidayWhatsAppMessage('invoice_parent', invoice(), registration());
    expect(message).toContain('26 November 2026 pukul 23.59 WIB');
    expect(message).toContain('Total: Rp299.000');
    expect(message).toContain('https://example.test/invoice/HC-2627-999999?t=synthetic');
    expect(message).toContain('• Creative Coding · Batch 1 · 09.00–10.30 WIB');
    expect(message).not.toContain('perlu daftar ulang');
  });
  it('lists both classes and formats the two-class total', () => {
    const message = holidayWhatsAppMessage('invoice_parent', invoice('PENDING', 'Rina Pratama', 598000), registration(two));
    expect(message).toContain('• Creative Coding · Batch 1 · 09.00–10.30 WIB\n• Game Design · Batch 2 · 13.00–14.30 WIB');
    expect(message).toContain('Total: Rp598.000');
  });
  it.each(['reminder_1', 'reminder_3'] as const)('%s keeps one class inline and lists two classes', kind => {
    const single = holidayWhatsAppMessage(kind, invoice(), registration());
    const multiple = holidayWhatsAppMessage(kind, invoice(), registration(two));
    expect(single).toContain('untuk Naya (program Creative Coding, Batch 1) yang masih menunggu pembayaran.');
    expect(multiple).toContain('untuk Naya yang masih menunggu pembayaran:\n• Creative Coding · Batch 1\n• Game Design · Batch 2');
    expect(single).toContain('26 November 2026 pukul 23.59 WIB');
    expect(multiple).toContain('Link pembayaran: https://example.test/invoice/HC-2627-999999?t=synthetic');
    expect(multiple).not.toContain('Open Code');
  });
  it('uses paid copy for a paid invoice_parent and names Zoom', () => {
    const paid = holidayWhatsAppMessage('paid_parent', invoice('PAID'), registration());
    expect(holidayWhatsAppMessage('invoice_parent', invoice('PAID'), registration())).toBe(paid);
    expect(paid).toContain('link Zoom');
    expect(paid).toContain('• Creative Coding · Batch 1 · 09.00–10.30 WIB');
  });
});
