import { NextRequest, NextResponse } from 'next/server';
import { authorizeCheckout, getCheckoutIntent, CheckoutError } from '@/lib/services/invoiceCheckoutServer';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { link } = await authorizeCheckout((await params).id, request.nextUrl.searchParams.get('t'));
    const order = request.nextUrl.searchParams.get('order');
    const intent = order ? await getCheckoutIntent(order) : null;
    if (!intent || intent.link_id !== link.id || intent.state !== 'PENDING' || intent.method !== 'qris' || !intent.payment_details?.qrCodeUrl) throw new CheckoutError('QR tidak aktif atau belum tersedia.', 404);
    const url = new URL(intent.payment_details.qrCodeUrl);
    if (url.protocol !== 'https:' || !['api.midtrans.com', 'api.sandbox.midtrans.com'].includes(url.hostname)) throw new CheckoutError('Sumber QR tidak valid.', 400);
    const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
    if (!serverKey) throw new CheckoutError('Konfigurasi QR belum tersedia.', 503);
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`, Accept: 'image/*' } });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !/^image\/(png|jpeg|webp)$/i.test(type.split(';')[0])) throw new CheckoutError('Gambar QR belum dapat dimuat.', 502);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 2_000_000) throw new CheckoutError('Gambar QR terlalu besar.', 502);
    return new Response(buffer, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="qris-tagihan.png"' } });
  } catch (e) { return NextResponse.json({ error: e instanceof CheckoutError ? e.message : 'Gagal memuat QR.' }, { status: e instanceof CheckoutError ? e.status : 502 }); }
}
