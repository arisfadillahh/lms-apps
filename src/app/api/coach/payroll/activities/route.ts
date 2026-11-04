import { NextResponse } from 'next/server';
import { payrollSession } from '@/lib/payroll/access';
import { PayrollError } from '@/lib/payroll/model';
import { payrollRows } from '@/lib/dao/payrollDao';
import { submitActivityRequest } from '@/lib/services/payrollActivityRequests';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await payrollSession();
    if (session.user.role !== 'COACH') throw new PayrollError('Forbidden', 403);
    return NextResponse.json({ requests: await payrollRows('payroll_activity_requests', '*', { eq: ['coach_id', session.user.id] }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const session = await payrollSession();
    if (session.user.role !== 'COACH') throw new PayrollError('Forbidden', 403);
    return NextResponse.json(await submitActivityRequest(await request.json().catch(() => null), session.user.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
function failure(e: unknown) { return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'Gagal memproses aktivitas.' }, { status: e instanceof PayrollError ? e.status : 500 }); }
