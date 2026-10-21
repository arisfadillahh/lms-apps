import { describe, expect, it, vi } from 'vitest';
import { formatInvoiceMessage } from '@/lib/services/whatsappClient';
import type { Invoice } from '@/lib/types/invoice';

// No DB, WhatsApp session, short-link write or message delivery in these tests.
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: vi.fn(() => { throw new Error('Unexpected DB access'); }) }));
vi.mock('@/lib/dao/invoicesDao', () => ({ getWhatsAppSession: vi.fn(), getInvoiceSettings: vi.fn(), getUnpaidInvoicesForMonth: vi.fn() }));
vi.mock('@/lib/dao/reportsDao', () => ({ hasWhatsappLogWithIdempotencyKey: vi.fn(), logWhatsappEvent: vi.fn(), updateWhatsappLogStatus: vi.fn() }));
vi.mock('@/lib/dao/notificationsDao', () => ({ createAdminNotifications: vi.fn() }));
vi.mock('@/lib/services/invoicePublicAccess', () => ({ buildInvoicePublicUrl: () => 'https://example.test/invoice/fixture' }));
vi.mock('@/lib/services/shortLinks', () => ({ getShortInvoiceUrlOrOriginal: async (url: string) => url }));
vi.mock('@whiskeysockets/baileys', () => ({ default: vi.fn(), useMultiFileAuthState: vi.fn(), DisconnectReason: {}, fetchLatestBaileysVersion: vi.fn(), makeCacheableSignalKeyStore: vi.fn() }));

const fixture: Invoice = {
  id: 'invoice-fixture', invoice_number: 'INV-QA-102026', ccr_id: null,
  parent_name: 'Orang Tua QA', parent_phone: '', invoice_type: 'MONTHLY',
  period_month: 10, period_year: 2026, period_start_date: '2026-10-26', period_end_date: '2026-11-25',
  total_amount: 300000, status: 'PENDING', due_date: '2026-10-25', paid_at: null, paid_notes: null,
  created_at: '2026-10-21T00:00:00Z', updated_at: '2026-10-21T00:00:00Z', items: [],
};
const settings = { base_url: 'https://example.test', invoice_message_template: 'Halo {parent_name}\nPeriode: {period_month_year}\nTotal: Rp {total_amount}\n{invoice_url}' };

describe('invoice WhatsApp template period', () => {
  it('renders the actual template with one billing month and real newlines', async () => {
    expect(await formatInvoiceMessage(fixture, settings)).toBe(
      'Halo Orang Tua QA\nPeriode: Oktober 2026\nTotal: Rp 300.000\nhttps://example.test/invoice/fixture',
    );
  });

  it('preserves a non-monthly range', async () => {
    expect(await formatInvoiceMessage({ ...fixture, invoice_type: 'SEASONAL' }, {
      ...settings, invoice_message_template: '{period_month_year}',
    })).toBe('Oktober - November 2026');
  });

  it('leaves the weekly registration template unchanged', async () => {
    expect(await formatInvoiceMessage({ ...fixture, invoice_type: 'REGISTRATION', invoice_number: 'REG-QA' }, {
      ...settings, weekly_invoice_message_template: 'Pendaftaran {invoice_number}\n{invoice_url}',
    })).toBe('Pendaftaran REG-QA\nhttps://example.test/invoice/fixture');
  });
});
