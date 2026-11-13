import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceById } from '@/lib/dao/invoicesDao';
import { verifyInvoicePublicToken } from '@/lib/services/invoicePublicAccess';
import { getStoredInvoicePaymentByInvoiceId } from '@/lib/invoicePaymentStore';
import { isLiveSingleInvoiceCheckout } from '@/lib/services/invoicePaymentInstructions';
import { paymentQrIsActive, renderInvoicePaymentQr } from '@/lib/invoicePaymentQr';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get('t');
    const requestedOrder = request.nextUrl.searchParams.get('order');
    const invoice = await getInvoiceById(id);
    if (!invoice || !verifyInvoicePublicToken(invoice, token)) return NextResponse.json({ error:'Invoice tidak valid.' },{status:404});
    const stored = await getStoredInvoicePaymentByInvoiceId(invoice.id);
    const order = stored?.orderId ?? invoice.midtrans_order_id ?? null;
    if (!order || (requestedOrder && requestedOrder !== order)) return NextResponse.json({error:'QR pembayaran tidak aktif.'},{status:404});
    if (order.startsWith('LMSB-') && !await isLiveSingleInvoiceCheckout(invoice,order)) return NextResponse.json({error:'QR pembayaran tidak aktif. Muat ulang status tagihan.'},{status:409});
    if (!paymentQrIsActive(invoice.status, stored?.transactionStatus ?? invoice.midtrans_transaction_status,
        stored?.expiresAt ?? invoice.midtrans_expires_at)) return NextResponse.json({error:'QR pembayaran sudah tidak aktif.'},{status:409});
    const details = stored?.paymentDetails ?? invoice.midtrans_payment_details;
    if (!details || typeof details !== 'object' || (details as Record<string,unknown>).method !== 'qris') return NextResponse.json({error:'QR pembayaran belum tersedia.'},{status:404});
    try {
        const file=await renderInvoicePaymentQr(details as Record<string,unknown>);
        const filename=`qr-${invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g,'-')}.png`;
        return new Response(new Uint8Array(file),{headers:{'Content-Type':'image/png','Cache-Control':'no-store',
            'Content-Disposition':`inline; filename="${filename}"`,'X-Content-Type-Options':'nosniff'}});
    } catch {
        return NextResponse.json({error:'Gambar QR belum dapat dimuat. Coba kembali atau hubungi admin.'},{status:502});
    }
}
