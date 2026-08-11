import { NextRequest, NextResponse } from 'next/server';
import {
    extendPaymentPeriodsForInvoice,
    getInvoiceById,
    getInvoiceSettings,
    markInvoiceAsPaid
} from '@/lib/dao/invoicesDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import {
    getMidtransPaidAt,
    mapMidtransStatus,
    type MidtransNotificationPayload,
    verifyMidtransSignature
} from '@/lib/invoiceMidtransClient';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';
import { getShortInvoiceUrlOrOriginal } from '@/lib/services/shortLinks';
import { buildPaymentConfirmationMessage, resolvePaymentConfirmationTarget } from '@/lib/services/invoicePaymentConfirmation';
import { markTrialConversionPaidFromInvoice } from '@/lib/services/trialConversion';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';
import { getStoredInvoicePaymentByOrderId, updateStoredInvoicePaymentStatus } from '@/lib/invoicePaymentStore';

export async function POST(request: NextRequest) {
    const payload = (await request.json().catch(() => null)) as MidtransNotificationPayload | null;
    if (!payload) {
        return NextResponse.json({ ok: false, message: 'Invalid JSON payload' }, { status: 400 });
    }

    const orderId = String(payload.order_id ?? '');
    if (!orderId) {
        return NextResponse.json({ ok: false, message: 'Missing order_id' }, { status: 400 });
    }

    if (!verifyMidtransSignature(payload)) {
        console.error('[Midtrans] Invalid signature for order', orderId);
        return NextResponse.json({ ok: false, message: 'Invalid Midtrans signature' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: attempt, error: attemptError } = await supabase
        .from('invoice_payment_attempts' as any)
        .select('*')
        .eq('order_id', orderId)
        .single();

    const mappedStatus = mapMidtransStatus(payload);
    const paidAt = mappedStatus === 'paid' ? getMidtransPaidAt(payload) : null;
    const storedAttempt = attempt ? null : await getStoredInvoicePaymentByOrderId(orderId);

    if (attemptError || !attempt) {
        if (!storedAttempt) {
            console.warn('[Midtrans] Payment attempt not found for order', orderId);
            return NextResponse.json({ ok: true, updated: false, reason: 'payment_attempt_not_found' });
        }

        await updateStoredInvoicePaymentStatus(orderId, payload, paidAt);
        const invoice = await getInvoiceById(storedAttempt.invoiceId);
        if (!invoice) {
            return NextResponse.json({ ok: true, updated: false, reason: 'invoice_not_found' });
        }

        if (mappedStatus === 'paid' && invoice.status !== 'PAID') {
            const paidInvoice = await markInvoiceAsPaid(invoice.id, paidAt ?? new Date().toISOString(), `Dibayar via Midtrans ${orderId}`);
            if (!paidInvoice) {
                return NextResponse.json({ ok: false, message: 'Failed to mark invoice paid' }, { status: 500 });
            }

            await extendPaymentPeriodsForInvoice(invoice.id);
            await markTrialConversionPaidFromInvoice(invoice.id, paidAt ?? new Date().toISOString()).catch((error) => {
                console.error('[Midtrans] Trial conversion paid hook failed:', error);
            });
            await sendPaymentConfirmationWhatsApp(paidInvoice, paidAt ?? new Date().toISOString());
        } else if (mappedStatus === 'paid') {
            await markTrialConversionPaidFromInvoice(invoice.id, paidAt ?? new Date().toISOString()).catch((error) => {
                console.error('[Midtrans] Trial conversion paid hook failed:', error);
            });
        }

        return NextResponse.json({ ok: true, updated: true, status: mappedStatus, store: 'file' });
    }

    await supabase
        .from('invoice_payment_attempts' as any)
        .update({
            midtrans_transaction_id: payload.transaction_id ?? (attempt as any).midtrans_transaction_id ?? null,
            midtrans_payment_type: payload.payment_type ?? (attempt as any).midtrans_payment_type ?? null,
            midtrans_transaction_status: payload.transaction_status ?? null,
            notification_payload: payload,
            paid_at: paidAt
        })
        .eq('id', (attempt as any).id);

    const invoice = await getInvoiceById((attempt as any).invoice_id);
    if (!invoice) {
        return NextResponse.json({ ok: true, updated: false, reason: 'invoice_not_found' });
    }

    await supabase
        .from('invoices' as any)
        .update({
            payment_method: (attempt as any).payment_method,
            payment_method_label: (attempt as any).payment_method_label,
            payment_base_amount: (attempt as any).base_amount,
            payment_admin_fee: (attempt as any).admin_fee,
            payment_total_amount: (attempt as any).total_amount,
            selected_payment_attempt_id: (attempt as any).id,
            midtrans_order_id: orderId,
            midtrans_transaction_id: payload.transaction_id ?? (attempt as any).midtrans_transaction_id ?? null,
            midtrans_payment_type: payload.payment_type ?? (attempt as any).midtrans_payment_type ?? null,
            midtrans_transaction_status: payload.transaction_status ?? null,
            midtrans_payment_details: (attempt as any).payment_details ?? {},
            midtrans_raw_response: payload,
            midtrans_expires_at: (attempt as any).expires_at ?? null
        })
        .eq('id', invoice.id);

    if (mappedStatus !== 'paid') {
        return NextResponse.json({ ok: true, updated: true, status: mappedStatus });
    }

    if (invoice.status !== 'PAID') {
        const paidInvoice = await markInvoiceAsPaid(invoice.id, paidAt ?? new Date().toISOString(), `Dibayar via Midtrans ${orderId}`);
        if (!paidInvoice) {
            return NextResponse.json({ ok: false, message: 'Failed to mark invoice paid' }, { status: 500 });
        }

        await extendPaymentPeriodsForInvoice(invoice.id);
        await markTrialConversionPaidFromInvoice(invoice.id, paidAt ?? new Date().toISOString()).catch((error) => {
            console.error('[Midtrans] Trial conversion paid hook failed:', error);
        });
        await sendPaymentConfirmationWhatsApp(paidInvoice, paidAt ?? new Date().toISOString());
    } else {
        await markTrialConversionPaidFromInvoice(invoice.id, paidAt ?? new Date().toISOString()).catch((error) => {
            console.error('[Midtrans] Trial conversion paid hook failed:', error);
        });
    }

    return NextResponse.json({ ok: true, updated: true, status: mappedStatus });
}

async function sendPaymentConfirmationWhatsApp(invoice: Awaited<ReturnType<typeof markInvoiceAsPaid>>, paidAt: string) {
    if (!invoice) return;

    try {
        const settings = await getInvoiceSettings();
        if (!settings?.payment_confirmation_template) return;

        const longInvoiceUrl = buildInvoicePublicUrl(settings.base_url || process.env.NEXTAUTH_URL || 'https://lms.clev.io', invoice);
        const invoiceUrl = await getShortInvoiceUrlOrOriginal(longInvoiceUrl, invoice, settings.base_url);
        const message = buildPaymentConfirmationMessage(invoice, settings, paidAt, invoiceUrl);
        const targetPhone = resolvePaymentConfirmationTarget(invoice);
        const result = await sendWhatsAppMessage(targetPhone, message);
        if (!result.success) {
            console.error('[Midtrans] Failed to send paid confirmation WA:', result.error);
        }
    } catch (error) {
        console.error('[Midtrans] Payment confirmation WA error:', error);
    }
}
