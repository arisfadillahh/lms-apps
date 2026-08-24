import { NextRequest, NextResponse } from 'next/server';

import { extendPaymentPeriodsForInvoice, getInvoiceById, markInvoiceAsPaid } from '@/lib/dao/invoicesDao';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';
import { getShortInvoiceUrlOrOriginal } from '@/lib/services/shortLinks';
import { notifyEventManagerInvoiceStatus } from '@/lib/services/eventManagerWebhook';
import { validateBearerToken } from '@/lib/apiTokenAuth';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
    const unauthorized = assertCoreApiToken(request);
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const paidAt = readNonEmptyString(body, 'paid_at') ?? new Date().toISOString();
    const paidNotes = readNonEmptyString(body, 'paid_notes') ?? readNonEmptyString(body, 'reason') ?? 'Marked paid by external LMS Core API client';
    const notifyEventManager = body && typeof body === 'object' && (body as Record<string, unknown>).notify_event_manager === true;

    const existingInvoice = await getInvoiceById(id);
    if (!existingInvoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = await markInvoiceAsPaid(id, paidAt, paidNotes);
    if (!invoice) {
        return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }

    await extendPaymentPeriodsForInvoice(id);

    const invoiceForResponse = await getInvoiceById(id) ?? invoice;
    const eventManagerWebhookStatus = notifyEventManager
        ? await notifyEventManagerInvoiceStatus(invoiceForResponse, 'paid')
        : { sent: false, reason: 'skipped_by_request_origin' };
    const paymentLink = buildInvoicePublicUrl(process.env.NEXTAUTH_URL || 'https://lms.clev.io', invoiceForResponse);
    const shortPaymentLink = await getShortInvoiceUrlOrOriginal(paymentLink, invoiceForResponse);

    return NextResponse.json({
        invoice_id: invoiceForResponse.id,
        invoice_number: invoiceForResponse.invoice_number,
        payment_link: paymentLink,
        short_payment_link: shortPaymentLink,
        status: 'paid',
        paid_at: invoiceForResponse.paid_at || paidAt,
        amount: invoiceForResponse.total_amount,
        eventManagerWebhookStatus
    });
}

function assertCoreApiToken(request: NextRequest) {
    const result = validateBearerToken(request, [process.env.LMS_CORE_API_TOKEN]);
    if (result === 'UNCONFIGURED') return NextResponse.json({ error: 'Integration token is not configured' }, { status: 503 });
    return result === 'INVALID' ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) : null;
}

function readNonEmptyString(value: unknown, key: string) {
    if (!value || typeof value !== 'object') return null;
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}
