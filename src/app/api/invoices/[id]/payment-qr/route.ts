import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getInvoiceById } from '@/lib/dao/invoicesDao';
import { verifyInvoicePublicToken } from '@/lib/services/invoicePublicAccess';
import { getStoredInvoicePaymentByInvoiceId } from '@/lib/invoicePaymentStore';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get('t');
    const requestedOrder = request.nextUrl.searchParams.get('order');
    const invoice = await getInvoiceById(id);

    if (!invoice || !verifyInvoicePublicToken(invoice, token)) {
        return NextResponse.json({ error: 'Invoice tidak valid.' }, { status: 404 });
    }

    const storedPayment = await getStoredInvoicePaymentByInvoiceId(invoice.id);
    const activeOrderId = invoice.midtrans_order_id ?? storedPayment?.orderId ?? null;

    if (requestedOrder && requestedOrder !== activeOrderId) {
        return NextResponse.json({ error: 'QR pembayaran tidak aktif.' }, { status: 404 });
    }

    const payment = normalizePaymentDetails(invoice.midtrans_payment_details ?? storedPayment?.paymentDetails ?? null);
    if (!payment || payment.method !== 'qris' || (!payment.qrCodeUrl && !payment.fallbackQrValue)) {
        return NextResponse.json({ error: 'QR pembayaran belum tersedia.' }, { status: 404 });
    }

    const safeQrUrl = payment.qrCodeUrl ? parseAllowedMidtransUrl(payment.qrCodeUrl) : null;
    if (payment.qrCodeUrl && !safeQrUrl) {
        return NextResponse.json({ error: 'URL QR tidak valid.' }, { status: 400 });
    }

    try {
        if (safeQrUrl) {
            const response = await fetch(safeQrUrl, {
                cache: 'no-store',
                headers: getMidtransQrHeaders(safeQrUrl),
                signal: AbortSignal.timeout(15000)
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type') ?? 'image/png';
                if (!contentType.toLowerCase().startsWith('image/')) {
                    return NextResponse.json({ error: 'Response QR tidak valid.' }, { status: 502 });
                }

                const file = Buffer.from(await response.arrayBuffer());
                return buildQrImageResponse(file, invoice.invoice_number, contentType);
            }
        }

        if (payment.fallbackQrValue) {
            const file = await QRCode.toBuffer(payment.fallbackQrValue, {
                errorCorrectionLevel: 'M',
                margin: 1,
                scale: 8,
                type: 'png'
            });
            return buildQrImageResponse(file, invoice.invoice_number, 'image/png');
        }

        return NextResponse.json({ error: 'Gagal mengambil QR pembayaran.' }, { status: 502 });
    } catch (error) {
        console.error('[InvoicePayment] QR fetch error:', error);
        return NextResponse.json({ error: 'Gagal mengunduh QR pembayaran.' }, { status: 502 });
    }
}

function normalizePaymentDetails(value: unknown) {
    if (!value || typeof value !== 'object') return null;
    const details = value as Record<string, unknown>;
    const method = typeof details.method === 'string' ? details.method : null;
    const qrCodeUrl = typeof details.qrCodeUrl === 'string' ? details.qrCodeUrl : null;
    const deeplinkUrl = typeof details.deeplinkUrl === 'string' ? details.deeplinkUrl : null;
    return {
        method,
        qrCodeUrl,
        fallbackQrValue: deeplinkUrl ?? qrCodeUrl
    };
}

function parseAllowedMidtransUrl(value: string) {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'https:') return null;

        const allowedHosts = (process.env.MIDTRANS_QRIS_ALLOWED_HOSTS ?? 'api.sandbox.midtrans.com,api.midtrans.com')
            .split(',')
            .map((host) => host.trim().toLowerCase())
            .filter(Boolean);
        const host = parsed.hostname.toLowerCase();
        const isAllowed = allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));

        return isAllowed ? parsed.toString() : null;
    } catch {
        return null;
    }
}

function getMidtransQrHeaders(value: string) {
    const headers: HeadersInit = {
        accept: 'image/png,image/*;q=0.9,*/*;q=0.1'
    };
    const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
    if (!serverKey) return headers;

    const host = new URL(value).hostname.toLowerCase();
    if (host === 'api.midtrans.com' || host === 'api.sandbox.midtrans.com') {
        headers.authorization = `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
    }
    return headers;
}

function buildQrImageResponse(file: Buffer, invoiceNumber: string, contentType: string) {
    const filename = `qr-${invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
    return new Response(new Uint8Array(file), {
        headers: {
            'cache-control': 'no-store',
            'content-disposition': `attachment; filename="${filename}"`,
            'content-length': String(file.byteLength),
            'content-type': contentType,
            'x-content-type-options': 'nosniff'
        }
    });
}
