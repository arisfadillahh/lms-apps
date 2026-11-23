import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron';
import { deliverHolidayWhatsApp } from '@/lib/services/holidayClassMessaging';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { deliverHolidayConversions } from '@/lib/services/holidayMetaConversions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (process.env.HOLIDAY_REMINDER_ENABLED === 'true') {
      const { error } = await getSupabaseAdmin().rpc('enqueue_holiday_reminders' as never);
      if (error) throw new Error('Holiday reminders unavailable');
    }
    const whatsapp=await deliverHolidayWhatsApp();
    const meta=await deliverHolidayConversions();
    return NextResponse.json({...whatsapp,meta});
  }
  catch {
    console.error('[Holiday Class] WhatsApp cron failed');
    return NextResponse.json({ error: 'Pengiriman Holiday Class belum dapat diproses.' }, { status: 503 });
  }
}
