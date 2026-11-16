import 'server-only';

import { withInvoiceIssuance } from '@/lib/invoiceIssuanceJournal';
import { assertPaymentIdentity, InvoiceMidtransClient } from '@/lib/invoiceMidtransClient';
import { getHistoricalInvoicePayments, getStoredInvoicePaymentByInvoiceId } from '@/lib/invoicePaymentStore';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Invoice } from '@/lib/types/invoice';

const closedStatuses = new Set(['cancel', 'deny', 'expire']);

async function deleteRegistrationInvoice(id: string, remove: boolean) {
    const { data, error } = await getSupabaseAdmin().rpc('delete_holiday_registration_invoice' as never, {
        p_invoice_id: id, p_delete: remove,
    } as never);
    if (error?.code === '23503' || error?.code === '23001') return 'protected';
    if (error) throw error;
    return data;
}

export async function deleteHolidayInvoice(invoice: Invoice) {
    return withInvoiceIssuance(invoice.id, async journal => {
        const eligibility = await deleteRegistrationInvoice(invoice.id, false);
        if (eligibility !== 'ready') return eligibility;

        const state = await journal.read();
        if (state && (state.phase === 'CREATING' || state.phase === 'SNAP_READY')) return 'protected';

        try {
            const [payments, latest] = await Promise.all([
                getHistoricalInvoicePayments([invoice.id]),
                getStoredInvoicePaymentByInvoiceId(invoice.id),
            ]);
            const orders = new Map(payments.map(payment => [payment.orderId, payment.total]));
            if (latest) orders.set(latest.orderId, latest.total);
            if (invoice.midtrans_order_id) {
                orders.set(invoice.midtrans_order_id, invoice.payment_total_amount ?? invoice.total_amount);
            }
            if (state?.phase === 'READY') orders.set(state.orderId, state.total);

            const gateway = new InvoiceMidtransClient();
            const statuses = await Promise.all(Array.from(orders, async ([orderId, total]) => {
                const status = await gateway.getTransactionStatus(orderId);
                assertPaymentIdentity(status, orderId, total);
                return { orderId, total, status: status.transaction_status };
            }));

            if (statuses.some(order => order.status === 'settlement' || order.status === 'capture')) {
                return 'paid';
            }
            if (statuses.some(order => !closedStatuses.has(order.status ?? '') && order.status !== 'pending')) {
                return 'protected';
            }
            for (const order of statuses.filter(order => order.status === 'pending')) {
                await gateway.cancelTransaction(order.orderId);
                const status = await gateway.getTransactionStatus(order.orderId);
                assertPaymentIdentity(status, order.orderId, order.total);
                if (!closedStatuses.has(status.transaction_status ?? '')) return 'protected';
            }
        } catch {
            return 'protected';
        }

        return deleteRegistrationInvoice(invoice.id, true);
    });
}
