import type { Invoice, InvoiceItem } from '@/lib/types/invoice';

type InvoicePeriod = Pick<Invoice,
  'invoice_type' | 'period_month' | 'period_year' | 'period_start_date' | 'period_end_date'
> & { items?: ReadonlyArray<Pick<InvoiceItem, 'billing_period' | 'billing_duration_months'>> };

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Unknown or mixed durations keep their original range, never assume one month. */
export function isSingleMonthInvoice(invoice: InvoicePeriod): boolean {
  const items = invoice.items;
  return invoice.invoice_type === 'MONTHLY'
    && items !== undefined && items.length > 0
    && items.every((item) => (item.billing_duration_months ?? item.billing_period?.payment_plans?.duration_months) === 1);
}

/** One-month billing label is independent of learning dates or settlement date. */
export function formatInvoicePeriod(invoice: InvoicePeriod, short = false): string {
  const months = short ? SHORT_MONTHS : MONTHS;
  const billingMonth = Number.isInteger(invoice.period_month)
    && invoice.period_month >= 1 && invoice.period_month <= 12
    && Number.isInteger(invoice.period_year) && invoice.period_year >= 1
    ? `${months[invoice.period_month - 1]} ${invoice.period_year}`
    : '-';

  if (isSingleMonthInvoice(invoice)) return billingMonth;

  // Longer, mixed, unknown, registration and seasonal invoices retain the range.
  if (!invoice.period_start_date || !invoice.period_end_date) return '-';
  const start = new Date(invoice.period_start_date);
  const end = new Date(invoice.period_end_date);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '-';

  // Stored SQL DATE values must not move months in the visitor's timezone.
  const startMonth = months[start.getUTCMonth()];
  const endMonth = months[end.getUTCMonth()];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear === endYear && start.getUTCMonth() === end.getUTCMonth()) {
    return `${startMonth} ${startYear}`;
  }
  if (startYear === endYear) return `${startMonth} - ${endMonth} ${startYear}`;
  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
}
