import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getInvoiceByNumber } from '@/lib/dao/invoicesDao';
import { holidayInvoicePattern } from '@/lib/holidayClass';
import { consumeRateLimit } from '@/lib/rateLimit';
import { getHolidayPaymentUrl } from '@/lib/services/holidayClassPayment';
import { verifyInvoicePublicToken } from '@/lib/services/invoicePublicAccess';

export async function POST(request: Request) {
  try {
    const input = z.object({ invoiceNumber: z.string().regex(holidayInvoicePattern), token: z.string().min(1).max(100) })
      .safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: 'Link invoice tidak valid.' }, { status: 404 });
    if (!await consumeRateLimit({ request, scope: 'holiday-payment', maxRequests: 20, windowSeconds: 300 })) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429 });
    }
    const invoice = await getInvoiceByNumber(input.data.invoiceNumber);
    if (!invoice || !verifyInvoicePublicToken(invoice, input.data.token)) return NextResponse.json({ error: 'Link invoice tidak valid.' }, { status: 404 });
    if (invoice.status === 'PAID') return NextResponse.json({ paid: true }, { headers: { 'Cache-Control': 'no-store' } });
    if (!['PENDING', 'OVERDUE'].includes(invoice.status)) return NextResponse.json({ error: 'Invoice sudah tidak aktif. Hubungi tim Clevio.' }, { status: 409 });
    const paymentUrl = await getHolidayPaymentUrl(invoice);
    if (!paymentUrl) return NextResponse.json({ error: 'Link Midtrans sedang disiapkan. Coba beberapa saat lagi.' }, { status: 409 });
    return NextResponse.json({ paymentUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Link Midtrans belum tersedia. Coba kembali atau hubungi tim Clevio.' }, { status: 503 });
  }
}
