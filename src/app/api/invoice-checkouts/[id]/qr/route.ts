import { NextRequest, NextResponse } from 'next/server';
import { authorizeCheckout, getCheckoutIntent, CheckoutError } from '@/lib/services/invoiceCheckoutServer';
import { renderInvoicePaymentQr } from '@/lib/invoicePaymentQr';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { link } = await authorizeCheckout((await params).id, request.nextUrl.searchParams.get('t'));
    const order = request.nextUrl.searchParams.get('order');
    const intent = order ? await getCheckoutIntent(order) : null;
    if (!intent || intent.link_id !== link.id || intent.state !== 'PENDING' || intent.method !== 'qris' || !intent.payment_details) throw new CheckoutError('QR tidak aktif atau belum tersedia.', 404);
    const buffer=await renderInvoicePaymentQr(intent.payment_details);
    return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="qris-tagihan.png"' } });
  } catch (e) { return NextResponse.json({ error: e instanceof CheckoutError ? e.message : 'Gagal memuat QR.' }, { status: e instanceof CheckoutError ? e.status : 502 }); }
}
