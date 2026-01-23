/**
 * DELETE /api/invoices/[id] - Delete an invoice
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getInvoiceById, markInvoiceAsPaid, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
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

        return NextResponse.json(invoice);

    } catch (error) {
        console.error('[API] Get invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const { paid_at, paid_notes, action } = body;

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

        // Send Payment Confirmation WhatsApp
        try {
            const settings = await getInvoiceSettings();
            if (settings?.payment_confirmation_template) {
                const formattedAmount = new Intl.NumberFormat('id-ID').format(invoice.total_amount);
                const paidDate = new Date(paid_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });

                const invoiceUrl = `${settings.base_url}/invoice/${invoice.invoice_number}`;

                const message = settings.payment_confirmation_template
                    .replace(/{parent_name}/g, invoice.parent_name)
                    .replace(/{invoice_number}/g, invoice.invoice_number)
                    .replace(/{amount}/g, formattedAmount)
                    .replace(/{paid_date}/g, paidDate)
                    .replace(/{invoice_url}/g, invoiceUrl);

                // Send message asynchronously (fire and forget from API perspective, but log error if any)
                await sendWhatsAppMessage(invoice.parent_phone, message)
                    .then(res => {
                        if (!res.success) console.error('[API] Failed to send payment confirmation:', res.error);
                        else console.log('[API] Payment confirmation sent to', invoice.parent_phone);
                    });
            }
        } catch (waError) {
            console.error('[API] Error sending payment confirmation:', waError);
            // Don't block the response, just log
        }

        return NextResponse.json(invoice);

    } catch (error) {
        console.error('[API] Update invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
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

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API] Delete invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
