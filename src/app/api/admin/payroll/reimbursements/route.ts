import { NextResponse } from 'next/server';
import { payrollAdmin } from '@/lib/payroll/access';
import { PayrollError } from '@/lib/payroll/model';
import { adminReimbursementList, adminReviewReimbursement } from '@/lib/services/payrollReimbursements';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: Request) {
  try {
    await payrollAdmin();
    return NextResponse.json(await adminReimbursementList(new URL(request.url).searchParams.get('period') ?? ''), { headers });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const session = await payrollAdmin();
    const length = Number(request.headers.get('content-length'));
    if (length > 8192) throw new PayrollError('Data keputusan terlalu panjang.', 413);
    return NextResponse.json(await adminReviewReimbursement(await request.json().catch(() => null), session.user.id), { headers });
  } catch (e) { return failure(e); }
}
function failure(e: unknown) {
  return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'Gagal memproses reimbursement.' }, { status: e instanceof PayrollError ? e.status : 500, headers });
}
