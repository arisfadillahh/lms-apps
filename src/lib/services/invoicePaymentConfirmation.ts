import type { Invoice, InvoiceSettings } from '@/lib/types/invoice';

type PaymentConfirmationInvoice = Pick<Invoice, 'invoice_number' | 'parent_name' | 'parent_phone' | 'total_amount'>;
type PaymentConfirmationSettings = Pick<InvoiceSettings, 'base_url' | 'payment_confirmation_template'>;

export function resolvePaymentConfirmationTarget(invoice: Pick<Invoice, 'parent_phone'>): string {
  return invoice.parent_phone;
}

export function formatPaymentConfirmationPaidDate(paidAt: string): string {
  return new Date(paidAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function buildPaymentConfirmationMessage(
  invoice: PaymentConfirmationInvoice,
  settings: PaymentConfirmationSettings,
  paidAt: string,
): string {
  const formattedAmount = new Intl.NumberFormat('id-ID').format(invoice.total_amount);
  const paidDate = formatPaymentConfirmationPaidDate(paidAt);
  const invoiceUrl = `${settings.base_url}/invoice/${invoice.invoice_number}`;

  return settings.payment_confirmation_template
    .replace(/{parent_name}/g, invoice.parent_name)
    .replace(/{invoice_number}/g, invoice.invoice_number)
    .replace(/{amount}/g, formattedAmount)
    .replace(/{paid_date}/g, paidDate)
    .replace(/{invoice_url}/g, invoiceUrl);
}
