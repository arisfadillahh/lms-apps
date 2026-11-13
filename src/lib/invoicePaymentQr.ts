import 'server-only';
import QRCode from 'qrcode';
import { validQrPayload } from '@/lib/invoiceMidtransClient';

/** Render on demand: no permanent image uploads or temporary PNG cleanup needed. */
export async function renderInvoicePaymentQr(details: Record<string, unknown>): Promise<Buffer> {
    if (typeof details.qrString === 'string') {
        if (!validQrPayload(details.qrString, Number(details.total))) throw new Error('QR pembayaran tidak valid.');
        return QRCode.toBuffer(details.qrString, { type:'png', errorCorrectionLevel:'M', margin:4, width:512 });
    }
    // Existing issued instructions remain usable. Never turn a checkout URL into a payment QR.
    if (typeof details.qrCodeUrl !== 'string') throw new Error('QR pembayaran belum tersedia.');
    const url = new URL(details.qrCodeUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
        || !['api.midtrans.com','api.sandbox.midtrans.com','merchants-app.midtrans.com','merchants-app.sbx.midtrans.com'].includes(url.hostname)) throw new Error('Sumber QR tidak valid.');
    const headers: Record<string,string> = { Accept:'image/png' };
    if (['api.midtrans.com','api.sandbox.midtrans.com'].includes(url.hostname)) {
        const key=process.env.MIDTRANS_SERVER_KEY?.trim();
        if (!key) throw new Error('Konfigurasi QR belum tersedia.');
        headers.Authorization=`Basic ${Buffer.from(`${key}:`).toString('base64')}`;
    }
    const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),headers});
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/png') throw new Error('Gambar QR belum dapat dimuat.');
    const declared=Number(response.headers.get('content-length'));
    if (declared>2_000_000) throw new Error('Gambar QR terlalu besar.');
    const reader=response.body?.getReader();
    if (!reader) throw new Error('Gambar QR kosong.');
    const parts:Uint8Array[]=[]; let size=0;
    try {
        while(true){ const {done,value}=await reader.read(); if(done)break; size+=value.byteLength;
            if(size>2_000_000)throw new Error('Gambar QR terlalu besar.'); parts.push(value); }
    } finally { await reader.cancel().catch(()=>{}); }
    const file=Buffer.concat(parts);
    if(file.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Gambar QR tidak valid.');
    return file;
}

export function paymentQrIsActive(invoiceStatus: string, status: string | null | undefined, expiresAt?: string | null) {
    return invoiceStatus !== 'PAID' && !['settlement','capture','cancel','deny','expire','failure'].includes(status ?? '')
        && (!expiresAt || new Date(expiresAt).getTime()>Date.now());
}
