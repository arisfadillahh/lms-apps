import type { Invoice } from '@/lib/types/invoice';

type InvoicePeriod = Pick<Invoice,
  'invoice_type' | 'period_month' | 'period_year' | 'period_start_date' | 'period_end_date'
>;

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Billing month is independent of learning dates and when a parent settles. */
export function formatInvoicePeriod(invoice: InvoicePeriod, short = false): string {
  const months = short ? SHORT_MONTHS : MONTHS;
  const billingMonth = Number.isInteger(invoice.period_month)
    && invoice.period_month >= 1 && invoice.period_month <= 12
    && Number.isInteger(invoice.period_year) && invoice.period_year >= 1
    ? `${months[invoice.period_month - 1]} ${invoice.period_year}`
    : '-';

  if (invoice.invoice_type === 'MONTHLY') return billingMonth;

  // Registration/seasonal invoices retain their learning-period range.
  if (!invoice.period_start_date || !invoice.period_end_date) return billingMonth;
  const start = new Date(invoice.period_start_date);
  const end = new Date(invoice.period_end_date);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return billingMonth;

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
