import { NextRequest, NextResponse } from 'next/server';

import { getInvoiceById, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';
import { getShortInvoiceUrlOrOriginal } from '@/lib/services/shortLinks';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';
import { validateBearerToken } from '@/lib/apiTokenAuth';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
    const unauthorized = assertCoreApiToken(request);
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const invoice = await getInvoiceById(id);
    if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const settings = await getInvoiceSettings();
    const longPaymentLink = buildInvoicePublicUrl(process.env.NEXTAUTH_URL || settings?.base_url || 'https://lms.clev.io', invoice);
    const paymentLink = await getShortInvoiceUrlOrOriginal(longPaymentLink, invoice, settings?.base_url ?? undefined);
    const targetPhone = invoice.parent_phone || invoice.seasonal_student_phone;
    if (!targetPhone) {
        return NextResponse.json({ error: 'Invoice has no WhatsApp target' }, { status: 400 });
    }

    const message = buildInvoiceResendMessage(invoice, paymentLink);

    const result = await sendWhatsAppMessage(targetPhone, message);
    if (!result.success) {
        return NextResponse.json({ error: 'Failed to send WhatsApp', details: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sent: true });
}

function buildInvoiceResendMessage(invoice: {
    invoice_number: string;
    parent_name?: string | null;
    student_name?: string | null;
    total_amount: number;
    due_date?: string | null;
    items?: Array<{ class_name?: string | null; description?: string | null }>;
}, paymentLink: string) {
    const studentName = invoice.student_name || invoice.items?.[0]?.description || '-';
    const programName = invoice.items?.[0]?.class_name || 'Program Clevio';

    return [
        `Halo ${invoice.parent_name || 'Bapak/Ibu'},`,
        '',
        'Invoice pendaftaran Clevio sudah dibuat.',
        '',
        `Invoice: ${invoice.invoice_number}`,
        `Siswa: ${studentName}`,
        `Program: ${programName}`,
        `Total: ${formatRupiah(invoice.total_amount)}`,
        invoice.due_date ? `Batas bayar: ${formatDate(invoice.due_date)}` : null,
        '',
        'Silakan lanjutkan pembayaran melalui link berikut:',
        paymentLink,
        '',
        'Setelah pembayaran terkonfirmasi, status pendaftaran akan diperbarui otomatis.',
        '',
        'Terima kasih,',
        'Clevio'
    ].filter((line): line is string => line !== null).join('\n');
}

function formatRupiah(value: number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(value);
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
    }).format(new Date(value));
}

function assertCoreApiToken(request: NextRequest) {
    const result = validateBearerToken(request, [process.env.LMS_CORE_API_TOKEN]);
    if (result === 'UNCONFIGURED') return NextResponse.json({ error: 'Integration token is not configured' }, { status: 503 });
    return result === 'INVALID' ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) : null;
}
