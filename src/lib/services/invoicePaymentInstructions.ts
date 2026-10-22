import 'server-only';

import { getStoredInvoicePaymentByInvoiceId } from '@/lib/invoicePaymentStore';
import { getCheckoutIntent, intentInvoiceIds } from '@/lib/services/invoiceCheckoutServer';
import type { Invoice } from '@/lib/types/invoice';

/** Old invoice tokens must never expose a grouped order or cancelled instructions. */
export async function isLiveSingleInvoiceCheckout(invoice: Invoice, orderId: string) {
  if (invoice.status === 'PAID') return false;
  try {
    const intent = await getCheckoutIntent(orderId);
    if (intent?.state !== 'PENDING' || intent.base_amount !== invoice.total_amount) return false;
    const ids = await intentInvoiceIds(orderId);
    return ids.length === 1 && ids[0] === invoice.id;
  } catch {
    // Reconciliation may continue while creation is disabled or storage is unavailable.
    // A stale QR/VA is never a safe fallback when the authoritative check fails.
    console.warn('[InvoiceCheckout] Payment instructions withheld pending ledger verification');
    return false;
  }
}

export async function getCurrentStoredInvoicePayment(invoice: Invoice) {
  const stored = await getStoredInvoicePaymentByInvoiceId(invoice.id);
  if (!stored || !stored.orderId.startsWith('LMSB-')) return stored;
  return await isLiveSingleInvoiceCheckout(invoice, stored.orderId) ? stored : null;
}
