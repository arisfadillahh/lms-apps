import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron';
import { runPayrollCron } from '@/lib/services/payrollCron';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const mode = new URL(request.url).searchParams.get('mode') ?? 'daily';
  if (mode !== 'daily' && mode !== 'notify') return NextResponse.json({ error: 'Mode payroll tidak valid.' }, { status: 400 });
  try { return NextResponse.json({ success: true, result: await runPayrollCron(new Date(), mode) }); }
  catch (e) { console.error('[Payroll cron]', e); return NextResponse.json({ error: 'Pemeriksaan payroll gagal. Periksa log dan konfigurasi.' }, { status: 500 }); }
}
