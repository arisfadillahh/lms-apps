import { NextResponse } from 'next/server';
import { attendanceAdmin } from '@/lib/payroll/access';
import { PayrollError } from '@/lib/payroll/model';
import { attendanceBootstrap, executeAttendanceCommand } from '@/lib/services/payrollAttendance';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await attendanceAdmin();
    return NextResponse.json(await attendanceBootstrap(new URL(request.url).searchParams.get('period') ?? undefined), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
export async function POST(request: Request) {
  try {
    const session = await attendanceAdmin();
    return NextResponse.json(await executeAttendanceCommand(await request.json().catch(() => null), session.user.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return fail(e); }
}
function fail(e: unknown) {
  return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'Gagal memproses absensi coach.' }, { status: e instanceof PayrollError ? e.status : 500 });
}
