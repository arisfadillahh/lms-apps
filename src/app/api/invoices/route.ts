/**
 * GET /api/invoices - List invoices with filters
 * POST /api/invoices - Core API invoice creation for external apps
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createSeasonalInvoice, getInvoiceByNumber, getInvoiceSettings, listInvoices, updateExternalInvoiceMetadata } from '@/lib/dao/invoicesDao';
import { getInvoiceStats } from '@/lib/services/invoiceGenerator';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';
import { getShortInvoiceUrlOrOriginal } from '@/lib/services/shortLinks';
import type { InvoiceFilters, InvoiceStatus } from '@/lib/types/invoice';
import { z } from 'zod';
import { validateBearerToken } from '@/lib/apiTokenAuth';

const createExternalInvoiceSchema = z.object({
    external_reference: z.string().min(1),
    customer: z.object({
        name: z.string().min(1),
        whatsapp: z.string().min(8),
        email: z.string().email().optional()
    }),
    student: z.object({
        name: z.string().min(1)
    }),
    items: z.array(z.object({
        name: z.string().min(1),
        qty: z.number().int().positive(),
        price: z.number().int().nonnegative()
    })).min(1),
    total: z.number().int().nonnegative(),
    expired_at: z.string().min(1),
    callback_url: z.string().url().optional()
});

export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse query params
        const { searchParams } = new URL(request.url);
        const filters: InvoiceFilters = {
            month: searchParams.get('month') && searchParams.get('month') !== 'all' ? parseInt(searchParams.get('month')!) : undefined,
            year: searchParams.get('year') && searchParams.get('year') !== 'all' ? parseInt(searchParams.get('year')!) : undefined,
            status: searchParams.get('status') as InvoiceStatus | undefined,
            search: searchParams.get('search') || undefined,
            page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
            limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
        };

        // Get invoices
        const result = await listInvoices(filters);

        // Get stats
        const stats = await getInvoiceStats(filters.month, filters.year);

        // Get settings
        const settings = await getInvoiceSettings();

        return NextResponse.json({
            ...result,
            stats,
            settings
        });

    } catch (error) {
        console.error('[API] List invoices error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const unauthorized = assertCoreApiToken(request);
        if (unauthorized) return unauthorized;

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const parsed = createExternalInvoiceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Validation failed',
                details: parsed.error.flatten()
            }, { status: 400 });
        }

        const payload = parsed.data;
        const customerName = cleanDisplayText(payload.customer.name, 'Orang Tua');
        const customerWhatsapp = cleanDisplayText(payload.customer.whatsapp, '');
        const studentName = cleanDisplayText(payload.student.name, 'Peserta');
        const itemTotal = payload.items.reduce((sum, item) => sum + item.qty * item.price, 0);
        if (itemTotal !== payload.total) {
            return NextResponse.json({
                error: 'Invoice item total does not match total'
            }, { status: 400 });
        }

        const invoiceNumber = `INV/${payload.external_reference}`;
        const existing = await getInvoiceByNumber(invoiceNumber);
        if (existing) {
            const updated = await updateExternalInvoiceMetadata(existing.id, {
                parent_name: customerName,
                parent_phone: customerWhatsapp,
                student_name: studentName,
                student_phone: customerWhatsapp
            });
            return NextResponse.json(await toExternalInvoiceResponse(updated ?? existing));
        }

        const expiredAt = new Date(payload.expired_at);
        if (Number.isNaN(expiredAt.getTime())) {
            return NextResponse.json({ error: 'Invalid expired_at' }, { status: 400 });
        }

        const result = await createSeasonalInvoice({
            invoice_number: invoiceNumber,
            parent_name: customerName,
            parent_phone: customerWhatsapp,
            student_phone: customerWhatsapp,
            student_name: studentName,
            period_month: expiredAt.getMonth() + 1,
            period_year: expiredAt.getFullYear(),
            period_start_date: new Date().toISOString().split('T')[0],
            period_end_date: expiredAt.toISOString().split('T')[0],
            total_amount: payload.total,
            due_date: expiredAt.toISOString().split('T')[0],
            items: payload.items.map((item) => ({
                class_name: item.name,
                level_name: 'Event',
                description: payload.external_reference,
                base_price: item.price * item.qty,
                discount_amount: 0,
                final_price: item.price * item.qty
            }))
        });

        if (!result) {
            return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
        }

        return NextResponse.json(await toExternalInvoiceResponse(result.invoice));
    } catch (error) {
        console.error('[API] Core create invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

function cleanDisplayText(value: string, fallback: string) {
    const cleaned = String(value ?? '').trim().replace(/\s+/g, ' ');
    return cleaned || fallback;
}

function assertCoreApiToken(request: NextRequest) {
    const result = validateBearerToken(request, [process.env.LMS_CORE_API_TOKEN]);
    if (result === 'UNCONFIGURED') return NextResponse.json({ error: 'Integration token is not configured' }, { status: 503 });
    return result === 'INVALID' ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) : null;
}

async function toExternalInvoiceResponse(invoice: { id: string; invoice_number: string; status: string; due_date: string | null; parent_phone: string; total_amount: number }) {
    const paymentLink = buildInvoicePublicUrl(process.env.NEXTAUTH_URL || 'https://lms.clev.io', invoice);
    const shortPaymentLink = await getShortInvoiceUrlOrOriginal(paymentLink, invoice);
    return {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_link: paymentLink,
        short_payment_link: shortPaymentLink,
        status: mapExternalInvoiceStatus(invoice.status),
        expired_at: invoice.due_date
    };
}

function mapExternalInvoiceStatus(status: string) {
    if (status === 'PAID') return 'paid';
    if (status === 'OVERDUE') return 'expired';
    return 'waiting_payment';
}
