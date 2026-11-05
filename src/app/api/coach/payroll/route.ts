import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { coachPeriodView } from '@/lib/payroll/coachView';
import { payrollSession } from '@/lib/payroll/access';
import { submitCorrection, PayrollError } from '@/lib/payroll/model';
import { listPayrollPeriods, getPayrollPeriod, getPayrollConfig, commitPayrollPeriod } from '@/lib/dao/payrollDao';
import { createAttendanceAdminNotifications } from '@/lib/services/payrollNotifications';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await payrollSession();
    if (session.user.role !== 'COACH') throw new PayrollError('Forbidden', 403);
    const [records, config] = await Promise.all([listPayrollPeriods(), getPayrollConfig()]);
    const profile = config.people.find(p => p.user_id === session.user.id);
    return NextResponse.json({ profile: profile ? { name: profile.name } : null, periods: records.flatMap(r => {
      const view = coachPeriodView(r.document, session.user.id);
      return view ? [view] : [];
    }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
export async function POST(request: Request) {
  try {
    const session = await payrollSession();
    if (session.user.role !== 'COACH') throw new PayrollError('Forbidden', 403);
    const body = z.object({ id: z.string().uuid().optional(), periodId: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), message: z.string().trim().min(10).max(2000) }).safeParse(await request.json().catch(() => null));
    if (!body.success) throw new PayrollError('Pilih periode dan tulis rincian koreksi minimal 10 karakter.');
    const record = await getPayrollPeriod(body.data.periodId);
    if (!record || !record.document.slips.some(s => s.user_id === session.user.id)) throw new PayrollError('Rekap tidak ditemukan.', 404);
    const next = submitCorrection(record.document, { id: body.data.id ?? randomUUID(), user_id: session.user.id, message: body.data.message });
    if (next !== record.document) {
      await commitPayrollPeriod(record, next, session.user.id, 'SUBMIT_CORRECTION', body.data.message);
      await createAttendanceAdminNotifications({ title: `Koreksi absensi ${body.data.periodId}`, message: `${session.user.fullName}: ${body.data.message}`, type: 'PAYROLL', category: 'PAYROLL', actionUrl: `/admin/coach-attendance?period=${body.data.periodId}`, priority: 'HIGH', push: false }, next.pic_id).catch(() => console.error('[Payroll] Notifikasi PIC belum terkirim; pengajuan tersimpan.'));
    }
    return NextResponse.json({ success: true });
  } catch (e) { return fail(e); }
}
function fail(e: unknown) { return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'Gagal membaca rekap gaji.' }, { status: e instanceof PayrollError ? e.status : 500 }); }
