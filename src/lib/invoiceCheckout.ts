import type { Invoice } from '@/lib/types/invoice';
import { formatInvoicePeriod } from '@/lib/invoicePeriod';

export const DEFAULT_CHECKOUT_MESSAGE = [
  'Halo Bapak/Ibu {parent_name},', '',
  'Berikut tagihan kelas Clevio yang belum dibayar:', '{invoice_list}', '',
  'Semua tagihan terpilih secara default. Bapak/Ibu boleh memilih satu tagihan terlebih dahulu atau beberapa sekaligus.',
  'Silakan cek rincian dan pilih tagihan sebelum memilih metode pembayaran:', '{payment_url}', '',
  'Biaya admin pembayaran ditampilkan sebelum QR/VA dibuat.', 'Terima kasih 🙏',
].join('\n');

export type CheckoutInvoice = Pick<Invoice,
  'id' | 'invoice_number' | 'period_month' | 'period_year' | 'period_start_date' |
  'period_end_date' | 'invoice_type' | 'status' | 'total_amount' | 'due_date'
> & { periodLabel: string; coderNames: string[] };

export function normalizedParentPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

export function validateCheckoutInvoices(invoices: Invoice[], allowPaid = false): void {
  if (!invoices.length || invoices.length > 24 || new Set(invoices.map(i => i.id)).size !== invoices.length) {
    throw new Error('Pilih 1–24 invoice yang berbeda.');
  }
  const first = invoices[0];
  if (new Set(invoices.map(i => `${i.period_year}-${i.period_month}`)).size !== invoices.length) {
    throw new Error('Ada invoice bulanan ganda pada periode yang sama. Minta admin memeriksanya sebelum membayar.');
  }
  const phone = normalizedParentPhone(first.parent_phone);
  if (!first.ccr_id || !/^62\d{8,13}$/.test(phone)) throw new Error('Identitas keluarga invoice belum lengkap. Hubungi admin.');
  for (const invoice of invoices) {
    if (invoice.ccr_id !== first.ccr_id || normalizedParentPhone(invoice.parent_phone) !== phone) {
      throw new Error('Invoice harus milik keluarga/CCR yang sama.');
    }
    if (invoice.invoice_type !== 'MONTHLY') throw new Error('Pilihan ini hanya untuk invoice kelas bulanan, bukan pendaftaran atau event.');
    if (!allowPaid && invoice.status === 'PAID') throw new Error('Ada invoice yang sudah lunas. Muat ulang pilihan.');
    if (!Number.isSafeInteger(invoice.total_amount) || invoice.total_amount <= 0) throw new Error('Nominal invoice tidak valid.');
  }
}

export function toCheckoutInvoice(invoice: Invoice): CheckoutInvoice {
  return {
    id: invoice.id, invoice_number: invoice.invoice_number, period_month: invoice.period_month,
    period_year: invoice.period_year, period_start_date: invoice.period_start_date,
    period_end_date: invoice.period_end_date, invoice_type: invoice.invoice_type,
    status: invoice.status, total_amount: invoice.total_amount, due_date: invoice.due_date,
    periodLabel: formatInvoicePeriod(invoice),
    coderNames: [...new Set(invoice.items?.map(i => i.coder_name).filter(Boolean) ?? [])],
  };
}

export function sortCheckoutInvoices<T extends Pick<Invoice, 'id' | 'period_year' | 'period_month'>>(invoices: T[]): T[] {
  return [...invoices].sort((a, b) => a.period_year - b.period_year || a.period_month - b.period_month || a.id.localeCompare(b.id));
}

/** All unpaid invoices are selected initially; a parent may then deselect any of them. */
export function defaultCheckoutSelection(invoices: CheckoutInvoice[]): string[] {
  return sortCheckoutInvoices(invoices).filter(i => i.status !== 'PAID').map(i => i.id);
}

export function checkoutSelectedTotal(invoices: CheckoutInvoice[], selected: string[]): number {
  const ids = new Set(selected);
  if (!ids.size || ids.size !== selected.length || selected.some(id => !invoices.some(i => i.id === id && i.status !== 'PAID'))) {
    throw new Error('Pilihan tagihan berubah atau sudah lunas. Muat ulang halaman.');
  }
  const total = invoices.filter(i => ids.has(i.id)).reduce((sum, i) => sum + i.total_amount, 0);
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('Total tagihan tidak valid.');
  return total;
}

export function formatCheckoutMessage(invoices: Invoice[], parentName: string, paymentUrl: string, template?: string | null): string {
  const unpaid = sortCheckoutInvoices(invoices).filter(i => i.status !== 'PAID');
  if (!unpaid.length) throw new Error('Semua tagihan sudah lunas. Tidak ada reminder untuk dikirim.');
  const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const values: Record<string, string> = {
    parent_name: parentName.replace(/[\r\n]/g, ' '), payment_url: paymentUrl,
    invoice_list: unpaid.map(i => `• ${formatInvoicePeriod(i)} (${i.invoice_number}): ${rupiah(i.total_amount)}`).join('\n'),
    total_unpaid: rupiah(unpaid.reduce((s, i) => s + i.total_amount, 0)),
  };
  const source = template?.trim() || DEFAULT_CHECKOUT_MESSAGE;
  if (!source.includes('{payment_url}') || !source.includes('{invoice_list}')) throw new Error('Template wajib memuat {payment_url} dan {invoice_list}.');
  // Replacement callbacks preserve literal $ and actual WhatsApp newlines in values.
  return source.replace(/\{(parent_name|payment_url|invoice_list|total_unpaid)\}/g, (_, key: string) => values[key]);
}
