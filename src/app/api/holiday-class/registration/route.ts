import { after, NextResponse } from 'next/server';
import { holidayBatches, holidayLevels, holidayPlatformFee, holidaySessionMinutes } from '@/lib/holidayClass';
import { consumeRateLimit } from '@/lib/rateLimit';
import { createHolidayRegistration, holidayRegistrationSchema, HolidayRegistrationError } from '@/lib/services/holidayClassRegistration';
import { holidayInvoiceUrl } from '@/lib/services/holidayClassPayment';
import { deliverHolidayWhatsApp } from '@/lib/services/holidayClassMessaging';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

export function GET() {
  return NextResponse.json({
    batches: holidayBatches, levels: holidayLevels, platformFee: holidayPlatformFee, sessionMinutes: holidaySessionMinutes,
  }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Format pendaftaran tidak valid.' }, { status: 415 });
  }
  const origin = request.headers.get('origin');
  const publicUrl = process.env.NEXTAUTH_URL || 'https://lms.clev.io';
  if (origin && origin !== new URL(publicUrl).origin) return NextResponse.json({ error: 'Sumber formulir tidak valid.' }, { status: 403 });
  try {
    if (!await consumeRateLimit({ request, scope: 'holiday-registration', maxRequests: 16, windowSeconds: 600 })) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba beberapa menit lagi.' }, { status: 429 });
    }
    const parsed = holidayRegistrationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Periksa nama, WhatsApp, pilihan program, dan persetujuan privasi.' }, { status: 400 });
    }
    if (!await consumeRateLimit({
      request, actorId: parsed.data.phone, scope: 'holiday-registration-phone', maxRequests: 5, windowSeconds: 1800,
    })) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan untuk nomor WhatsApp ini. Buka kembali invoice atau coba lagi nanti.' }, { status: 429 });
    }
    const invoice = await createHolidayRegistration(parsed.data);
    after(() => deliverHolidayWhatsApp(parsed.data.id).catch(() => console.warn('[Holiday Class] Registration delivery deferred')));
    const invoiceUrl = holidayInvoiceUrl(invoice);
    return NextResponse.json({ invoiceNumber: invoice.invoice_number, invoiceUrl }, { headers: noStore });
  } catch (error) {
    if (error instanceof HolidayRegistrationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Holiday Class] Registration could not be completed');
    return NextResponse.json({ error: 'Pendaftaran belum dapat diproses. Coba kembali dengan data yang sama.' }, { status: 503 });
  }
}
