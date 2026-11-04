import { NextResponse } from 'next/server';
import { z } from 'zod';
import { payrollSession } from '@/lib/payroll/access';
import { correctionOpen, PayrollError } from '@/lib/payroll/model';
import { listPayrollPeriods, getPayrollPeriod, getPayrollConfig } from '@/lib/dao/payrollDao';
import { createPayrollAdminNotifications } from '@/lib/services/payrollNotifications';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await payrollSession();
    if (session.user.role !== 'COACH') throw new PayrollError('Forbidden', 403);
    const [records, config] = await Promise.all([listPayrollPeriods(), getPayrollConfig()]);
    const profile = config.people.find(p => p.user_id === session.user.id);
    const terms = profile ? config.terms.filter(t => t.profile_id === profile.id) : [];
    return NextResponse.json({ profile: profile ? { name: profile.name, terms } : null, periods: records.flatMap(r => {
      const p = r.document, slip = p.slips.find(s => s.user_id === session.user.id);
      if (!slip) return [];
      return [{ id: p.id, status: p.status, version: p.version, starts_at: p.starts_at, ends_at: p.ends_at, correction_deadline: p.correction_deadline, calculated_at: p.calculated_at,
        slip, transfers: p.transfers.filter(t => t.profile_id === slip.profile_id), history: p.history.map(h => ({ ...h, slips: h.slips.filter(s => s.user_id === session.user.id) })) }];
    }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
export async function POST(request: Request) {
  try {
    const session = await payrollSession();
    if (session.user.role !== 'COACH') throw new PayrollError('Forbidden', 403);
    const body = z.object({ periodId: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), message: z.string().trim().min(10).max(2000) }).safeParse(await request.json().catch(() => null));
    if (!body.success) throw new PayrollError('Pilih periode dan tulis rincian koreksi minimal 10 karakter.');
    const record = await getPayrollPeriod(body.data.periodId);
    if (!record || !record.document.slips.some(s => s.user_id === session.user.id)) throw new PayrollError('Rekap tidak ditemukan.', 404);
    if (!correctionOpen(record.document)) throw new PayrollError('Batas koreksi reguler tanggal 25 pukul 17.00 WIB telah lewat. Hubungi admin untuk pengecualian force majeure.');
    await createPayrollAdminNotifications({ title: `Koreksi absensi ${body.data.periodId}`, message: `${session.user.fullName}: ${body.data.message}`, type: 'PAYROLL', category: 'PAYROLL', actionUrl: `/admin/payroll?period=${body.data.periodId}`, priority: 'HIGH', push: true });
    return NextResponse.json({ success: true });
  } catch (e) { return fail(e); }
}
function fail(e: unknown) { return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'Gagal membaca rekap gaji.' }, { status: e instanceof PayrollError ? e.status : 500 }); }
