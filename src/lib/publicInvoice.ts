import type { Invoice, InvoiceItem } from '@/lib/types/invoice';

export type PublicInvoiceItem = Omit<InvoiceItem, 'coder_id' | 'payment_period_id'>;
export type PublicInvoice = Omit<
  Invoice,
  'paid_notes' | 'selected_payment_attempt_id' | 'midtrans_transaction_id' | 'midtrans_raw_response' | 'items' | 'ccr'
> & {
  items?: PublicInvoiceItem[];
  ccr?: { ccr_code: string };
};

export function toPublicInvoice(invoice: Invoice): PublicInvoice {
  const {
    paid_notes: _paidNotes,
    selected_payment_attempt_id: _selectedAttempt,
    midtrans_transaction_id: _transactionId,
    midtrans_raw_response: _rawResponse,
    items,
    ccr,
    ...safeInvoice
  } = invoice;

  return {
    ...safeInvoice,
    items: items?.map(({ coder_id: _coderId, payment_period_id: _periodId, ...item }) => item),
    ccr: ccr ? { ccr_code: ccr.ccr_code } : undefined,
  };
}
