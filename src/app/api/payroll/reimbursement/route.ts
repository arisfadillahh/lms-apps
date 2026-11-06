import { NextResponse } from 'next/server';
import { consumeRateLimit } from '@/lib/rateLimit';
import { PayrollError } from '@/lib/payroll/model';
import { publicReimbursementMetadata, reimbursementClaims, reimbursementScope, submitPublicReimbursement } from '@/lib/services/payrollReimbursements';
import { readReimbursementForm } from '@/lib/services/reimbursementImage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
async function authorize(request: Request, submit: boolean) {
  if (!await consumeRateLimit({ request, scope: submit ? 'payroll-reimbursement-submit-ip' : 'payroll-reimbursement-read-ip', maxRequests: submit ? 20 : 60, windowSeconds: submit ? 3600 : 300 })) throw new PayrollError('Terlalu banyak permintaan. Tunggu beberapa saat lalu coba lagi.', 429);
  const token = request.headers.get('x-payroll-reimbursement-token') ?? '';
  const claims = reimbursementClaims(token);
  if (!await consumeRateLimit({ request, scope: submit ? 'payroll-reimbursement-submit-profile' : 'payroll-reimbursement-read-profile', actorId: `${claims.profileId}:${claims.periodId}`, maxRequests: submit ? 12 : 120, windowSeconds: submit ? 3600 : 300 })) throw new PayrollError('Terlalu banyak permintaan untuk penerima ini. Tunggu lalu coba lagi.', 429);
  return token;
}
export async function GET(request: Request) {
  try { return NextResponse.json(await publicReimbursementMetadata(await authorize(request, false)), { headers }); }
  catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const token = await authorize(request, true);
    await reimbursementScope(token); // Reject closed/deactivated links before reading a file.
    return NextResponse.json(await submitPublicReimbursement(token, await readReimbursementForm(request)), { status: 201, headers });
  } catch (e) { return failure(e); }
}
function failure(e: unknown) {
  if (!(e instanceof PayrollError)) console.error('[Reimbursement public] Request failed');
  return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'Pengajuan gagal diproses. Coba lagi atau hubungi admin.' }, { status: e instanceof PayrollError ? e.status : 500, headers });
}
