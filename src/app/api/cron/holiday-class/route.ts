import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron';
import { deliverHolidayWhatsApp } from '@/lib/services/holidayClassMessaging';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await deliverHolidayWhatsApp()); }
  catch {
    console.error('[Holiday Class] WhatsApp cron failed');
    return NextResponse.json({ error: 'Pengiriman Holiday Class belum dapat diproses.' }, { status: 503 });
  }
}
