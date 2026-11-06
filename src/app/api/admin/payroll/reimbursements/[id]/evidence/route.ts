import { NextResponse } from 'next/server';
import { payrollAdmin } from '@/lib/payroll/access';
import { PayrollError } from '@/lib/payroll/model';
import { adminReimbursementEvidence } from '@/lib/services/payrollReimbursements';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await payrollAdmin();
    const { id } = await context.params;
    const image = await adminReimbursementEvidence(id);
    return new Response(image, { headers: { 'Content-Type': 'image/webp', 'Content-Disposition': 'inline; filename="bukti-reimbursement.webp"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer' } });
  } catch (e) { return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'Foto bukti gagal dibuka.' }, { status: e instanceof PayrollError ? e.status : 500, headers: { 'Cache-Control': 'private, no-store' } }); }
}
