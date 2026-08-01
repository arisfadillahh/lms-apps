import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceById } from '@/lib/dao/invoicesDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifyInvoicePublicToken } from '@/lib/services/invoicePublicAccess';
import { buildInvoicePaymentBreakdown, getInvoicePaymentOption, getPublicInvoicePaymentOptions } from '@/lib/invoicePaymentMethods';
import { createLmsInvoiceMidtransOrderId, InvoiceMidtransClient } from '@/lib/invoiceMidtransClient';
import { getStoredInvoicePaymentByInvoiceId, saveStoredInvoicePayment, toPublicStoredInvoicePayment } from '@/lib/invoicePaymentStore';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const token = readString(body, 'token');
        const method = readString(body, 'method');

        const invoice = await getInvoiceById(id);
        if (!invoice || !token || !verifyInvoicePublicToken(invoice, token)) {
            return NextResponse.json({ error: 'Invoice tidak valid atau link sudah salah.' }, { status: 404 });
        }

        if (invoice.status === 'PAID') {
            return NextResponse.json({ error: 'Invoice ini sudah lunas.' }, { status: 409 });
        }

        const option = getInvoicePaymentOption(method);
        const payment = buildInvoicePaymentBreakdown(method, invoice.total_amount);
        if (!option || !payment) {
            return NextResponse.json({ error: 'Metode pembayaran tidak tersedia.' }, { status: 400 });
        }

        const existingPayment = await getReusableInvoicePayment(invoice, token);
        if (existingPayment && existingPayment.method === payment.method) {
            return NextResponse.json({
                ok: true,
                reused: true,
                payment: existingPayment,
                options: getPublicInvoicePaymentOptions(invoice.total_amount)
            });
        }

        const orderId = createLmsInvoiceMidtransOrderId(invoice, payment.method);
        const midtrans = await new InvoiceMidtransClient().createPayment(invoice, payment, orderId);
        const storedPayment = await saveStoredInvoicePayment({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            payment: midtrans
        });

        await tryStorePaymentInDatabase(invoice.id, payment, midtrans);

        return NextResponse.json({
            ok: true,
            payment: toPublicStoredInvoicePayment(storedPayment, token),
            options: getPublicInvoicePaymentOptions(invoice.total_amount)
        });
    } catch (error) {
        console.error('[InvoicePayment] Create payment method error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Gagal membuat instruksi pembayaran.'
        }, { status: 500 });
    }
}

async function tryStorePaymentInDatabase(
    invoiceId: string,
    payment: NonNullable<ReturnType<typeof buildInvoicePaymentBreakdown>>,
    midtrans: Awaited<ReturnType<InvoiceMidtransClient['createPayment']>>
) {
    try {
        const supabase = getSupabaseAdmin();
        const { data: attempt, error: attemptError } = await supabase
            .from('invoice_payment_attempts' as any)
            .insert({
                invoice_id: invoiceId,
                order_id: midtrans.orderId,
                payment_method: payment.method,
                payment_method_label: payment.label,
                base_amount: payment.baseAmount,
                admin_fee: payment.adminFee,
                total_amount: payment.total,
                midtrans_transaction_id: midtrans.transactionId,
                midtrans_payment_type: midtrans.paymentType,
                midtrans_transaction_status: midtrans.transactionStatus,
                payment_details: midtrans.paymentDetails,
                raw_response: midtrans.rawResponse,
                expires_at: midtrans.expiresAt
            })
            .select('id')
            .single();

        if (attemptError || !attempt) {
            console.warn('[InvoicePayment] DB payment attempt unavailable, using file store:', attemptError?.message ?? 'no_attempt');
            return;
        }

        const { error: invoiceUpdateError } = await supabase
            .from('invoices' as any)
            .update({
                payment_method: payment.method,
                payment_method_label: payment.label,
                payment_base_amount: payment.baseAmount,
                payment_admin_fee: payment.adminFee,
                payment_total_amount: payment.total,
                selected_payment_attempt_id: (attempt as any).id,
                midtrans_order_id: midtrans.orderId,
                midtrans_transaction_id: midtrans.transactionId,
                midtrans_payment_type: midtrans.paymentType,
                midtrans_transaction_status: midtrans.transactionStatus,
                midtrans_payment_details: midtrans.paymentDetails,
                midtrans_raw_response: midtrans.rawResponse,
                midtrans_expires_at: midtrans.expiresAt
            })
            .eq('id', invoiceId);

        if (invoiceUpdateError) {
            console.warn('[InvoicePayment] Invoice payment metadata columns unavailable, using file store:', invoiceUpdateError.message);
        }
    } catch (error) {
        console.warn('[InvoicePayment] DB payment storage skipped:', error);
    }
}

async function getReusableInvoicePayment(invoice: Awaited<ReturnType<typeof getInvoiceById>>, token: string | null) {
    if (!invoice || !token) return null;
    const stored = await getStoredInvoicePaymentByInvoiceId(invoice.id);
    if (!invoice.payment_method || !invoice.midtrans_order_id) {
        return stored ? toPublicStoredInvoicePayment(stored, token) : null;
    }
    const details = invoice.midtrans_payment_details;
    if (!details || typeof details !== 'object') {
        return stored ? toPublicStoredInvoicePayment(stored, token) : null;
    }

    const expiresAt = invoice.midtrans_expires_at ? new Date(invoice.midtrans_expires_at).getTime() : null;
    if (expiresAt && Number.isFinite(expiresAt) && expiresAt < Date.now()) return null;

    return toPublicPayment(details as Record<string, unknown>, token, invoice.id, invoice.midtrans_order_id);
}

function toPublicPayment(details: Record<string, unknown>, token: string, invoiceId: string, orderId: string) {
    const method = String(details.method ?? '');
    return {
        method,
        label: String(details.label ?? 'Metode pembayaran'),
        baseAmount: Number(details.baseAmount ?? 0),
        adminFee: Number(details.adminFee ?? 0),
        total: Number(details.total ?? 0),
        feeLabel: String(details.feeLabel ?? ''),
        bank: readNullableString(details, 'bank'),
        vaNumber: readNullableString(details, 'vaNumber'),
        billerCode: readNullableString(details, 'billerCode'),
        billKey: readNullableString(details, 'billKey'),
        deeplinkUrl: readNullableString(details, 'deeplinkUrl'),
        qrImageUrl: method === 'qris'
            ? `/api/invoices/${encodeURIComponent(invoiceId)}/payment-qr?t=${encodeURIComponent(token)}&order=${encodeURIComponent(orderId)}`
            : null
    };
}

function readString(value: unknown, key: string) {
    if (!value || typeof value !== 'object') return null;
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function readNullableString(value: Record<string, unknown>, key: string) {
    const candidate = value[key];
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}
