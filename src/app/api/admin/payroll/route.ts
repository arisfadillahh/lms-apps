import { NextResponse } from 'next/server';
import { payrollAdmin } from '@/lib/payroll/access';
import { PayrollError } from '@/lib/payroll/model';
import { payrollCommandSchema } from '@/lib/payroll/validation';
import { payrollBootstrap } from '@/lib/services/payroll';
import { executePayrollCommand } from '@/lib/services/payrollCommands';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await payrollAdmin();
    const p = new URL(request.url).searchParams;
    const year = p.has('year') ? Number(p.get('year')) : undefined;
    const month = p.has('month') ? Number(p.get('month')) : undefined;
    if ((p.has('year') || p.has('month')) && (!year || !Number.isInteger(year) || year < 2020 || year > 2099 || !month || !Number.isInteger(month) || month < 1 || month > 12)) throw new PayrollError('Periode tidak valid.');
    return NextResponse.json(await payrollBootstrap(year, month), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const session = await payrollAdmin();
    const parsed = payrollCommandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new PayrollError(parsed.error.issues[0]?.message || 'Data tidak valid.');
    return NextResponse.json({ result: await executePayrollCommand(parsed.data, session.user.id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
function failure(e: unknown) {
  if (!(e instanceof PayrollError)) console.error('[Payroll]', e);
  return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'Gagal memproses gaji. Periksa konfigurasi/migrasi atau coba lagi.' }, { status: e instanceof PayrollError ? e.status : 500 });
}
