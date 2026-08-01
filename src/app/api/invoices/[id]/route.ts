/**
 * DELETE /api/invoices/[id] - Delete an invoice
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getInvoiceById, markInvoiceAsPaid, getInvoiceSettings, extendPaymentPeriodsForInvoice, updateExternalInvoiceMetadata } from '@/lib/dao/invoicesDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';
import { buildPaymentConfirmationMessage, resolvePaymentConfirmationTarget } from '@/lib/services/invoicePaymentConfirmation';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';
import { getShortInvoiceUrlOrOriginal } from '@/lib/services/shortLinks';
import { notifyEventManagerInvoiceStatus, resolveExternalReference } from '@/lib/services/eventManagerWebhook';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const coreApiTokenAuthorized = isCoreApiTokenAuthorized(request);

        // Check authentication
        const session = await getServerSession(authOptions);
        if (!coreApiTokenAuthorized && (!session || session.user.role !== 'ADMIN')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const invoice = await getInvoiceById(id);

        if (!invoice) {
            return NextResponse.json(
                { error: 'Invoice not found' },
                { status: 404 }
            );
        }

        if (coreApiTokenAuthorized && (!session || session.user.role !== 'ADMIN')) {
            return NextResponse.json(await toExternalInvoiceResponse(invoice));
        }

        return NextResponse.json(invoice);

    } catch (error) {
        console.error('[API] Get invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

function isCoreApiTokenAuthorized(request: NextRequest) {
    const expectedToken = process.env.LMS_CORE_API_TOKEN?.trim();
    if (!expectedToken) return false;

    const authorization = request.headers.get('authorization') || '';
    const actualToken = authorization.replace(/^Bearer\s+/i, '').trim();
    return actualToken === expectedToken;
}

async function toExternalInvoiceResponse(invoice: { id: string; invoice_number: string; status: string; due_date: string | null; paid_at?: string | null; total_amount: number; parent_phone: string }) {
    const paymentLink = buildInvoicePublicUrl(process.env.NEXTAUTH_URL || 'https://lms.clev.io', invoice);
    const shortPaymentLink = await getShortInvoiceUrlOrOriginal(paymentLink, invoice);
    return {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_link: paymentLink,
        short_payment_link: shortPaymentLink,
        status: mapExternalInvoiceStatus(invoice.status),
        expired_at: invoice.due_date,
        paid_at: invoice.paid_at || null,
        amount: invoice.total_amount
    };
}

function mapExternalInvoiceStatus(status: string) {
    if (status === 'PAID') return 'paid';
    if (status === 'OVERDUE') return 'expired';
    return 'waiting_payment';
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const coreApiTokenAuthorized = isCoreApiTokenAuthorized(request);
        const session = await getServerSession(authOptions);
        if (!coreApiTokenAuthorized && (!session || session.user.role !== 'ADMIN')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const { paid_at, paid_notes, action } = body;

        if (action === 'update_metadata') {
            const updated = await updateExternalInvoiceMetadata(id, {
                parent_name: readNestedString(body, 'customer', 'name') ?? readNonEmptyString(body, 'parent_name'),
                parent_phone: readNestedString(body, 'customer', 'whatsapp') ?? readNonEmptyString(body, 'parent_phone'),
                student_name: readNestedString(body, 'student', 'name') ?? readNonEmptyString(body, 'student_name'),
                student_phone: readNestedString(body, 'student', 'whatsapp') ?? readNestedString(body, 'customer', 'whatsapp') ?? readNonEmptyString(body, 'student_phone')
            });

            if (!updated) {
                return NextResponse.json({ error: 'Invoice not found or metadata update failed' }, { status: 404 });
            }

            if (coreApiTokenAuthorized && (!session || session.user.role !== 'ADMIN')) {
                return NextResponse.json(await toExternalInvoiceResponse(updated));
            }

            return NextResponse.json(updated);
        }

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Handle unmark paid action
        if (action === 'unmark_paid') {
            const { data, error } = await supabase
                .from('invoices' as any)
                .update({
                    status: 'PENDING',
                    paid_at: null,
                    paid_notes: null
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('[API] Unmark paid error:', error);
                return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
            }

            return NextResponse.json(data);
        }

        // Default: Mark as paid
        if (!paid_at) {
            return NextResponse.json(
                { error: 'paid_at is required' },
                { status: 400 }
            );
        }

        const invoice = await markInvoiceAsPaid(id, paid_at, paid_notes);

        if (!invoice) {
            return NextResponse.json(
                { error: 'Failed to update invoice' },
                { status: 500 }
            );
        }

        // Extend payment periods for this invoice
        await extendPaymentPeriodsForInvoice(id);

        // Send Payment Confirmation WhatsApp
        let waStatus: { sent: boolean; error?: string; skipped?: boolean } = { sent: false };
        const eventManagerExternalReference = resolveExternalReference(invoice);
        if (eventManagerExternalReference) {
            waStatus = { sent: false, skipped: true, error: 'Skipped LMS generic payment confirmation for Event Manager invoice' };
        } else {
            try {
                const settings = await getInvoiceSettings();
                if (settings?.payment_confirmation_template) {
                    const longInvoiceUrl = buildInvoicePublicUrl(settings.base_url || process.env.NEXTAUTH_URL || 'https://lms.clev.io', invoice);
                    const invoiceUrl = await getShortInvoiceUrlOrOriginal(longInvoiceUrl, invoice, settings.base_url);
                    const message = buildPaymentConfirmationMessage(invoice, settings, paid_at, invoiceUrl);
                    const targetPhone = resolvePaymentConfirmationTarget(invoice);
                    const waResult = await sendWhatsAppMessage(targetPhone, message);
                    if (waResult.success) {
                        console.log('[API] Payment confirmation sent to', targetPhone);
                        waStatus = { sent: true };
                    } else {
                        console.error('[API] Failed to send payment confirmation:', waResult.error);
                        waStatus = { sent: false, error: waResult.error };
                    }
                } else {
                    waStatus = { sent: false, error: 'Template konfirmasi pembayaran belum diatur di Settings' };
                }
            } catch (waError) {
                console.error('[API] Error sending payment confirmation:', waError);
                waStatus = { sent: false, error: String(waError) };
            }
        }

        const invoiceForWebhook = await getInvoiceById(id);
        const eventManagerWebhookStatus = invoiceForWebhook
            ? await notifyEventManagerInvoiceStatus(invoiceForWebhook, 'paid')
            : { sent: false, reason: 'invoice_not_found_after_paid' };

        return NextResponse.json({ ...invoice, waStatus, eventManagerWebhookStatus });

    } catch (error) {
        console.error('[API] Update invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

function readNestedString(value: unknown, objectKey: string, fieldKey: string) {
    if (!value || typeof value !== 'object') return null;
    const nested = (value as Record<string, unknown>)[objectKey];
    if (!nested || typeof nested !== 'object') return null;
    return readNonEmptyString(nested, fieldKey);
}

function readNonEmptyString(value: unknown, key: string) {
    if (!value || typeof value !== 'object') return null;
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const coreApiTokenAuthorized = isCoreApiTokenAuthorized(request);

        // Check authentication
        const session = await getServerSession(authOptions);
        if (!coreApiTokenAuthorized && (!session || session.user.role !== 'ADMIN')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const invoiceForWebhook = await getInvoiceById(id);
        const supabase = getSupabaseAdmin();

        // First delete invoice items
        await supabase
            .from('invoice_items' as any)
            .delete()
            .eq('invoice_id', id);

        // Then delete the invoice
        const { error } = await supabase
            .from('invoices' as any)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[API] Delete invoice error:', error);
            return NextResponse.json(
                { error: 'Failed to delete invoice' },
                { status: 500 }
            );
        }

        const eventManagerWebhookStatus = invoiceForWebhook
            ? await notifyEventManagerInvoiceStatus(invoiceForWebhook, 'cancelled')
            : { sent: false, reason: 'invoice_not_found_before_delete' };

        return NextResponse.json({ success: true, eventManagerWebhookStatus });

    } catch (error) {
        console.error('[API] Delete invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
