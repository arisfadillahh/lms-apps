import { NextResponse } from 'next/server';
import { getPayrollPeriod } from '@/lib/dao/payrollDao';
import { payrollSession, canReadSlip, isPayrollAdmin } from '@/lib/payroll/access';
import { PayrollError, isPaid } from '@/lib/payroll/model';
import { generatePayrollPdf } from '@/lib/pdf/generatePayrollPdf';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ period: string; profileId: string }> }) {
  try {
    const session = await payrollSession();
    const { period, profileId } = await context.params;
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) || !/^[0-9a-f-]{36}$/i.test(profileId)) throw new PayrollError('Dokumen tidak ditemukan.', 404);
    const record = await getPayrollPeriod(period);
    if (!record) throw new PayrollError('Dokumen tidak ditemukan.', 404);
    const p = new URL(request.url).searchParams;
    const version = p.has('version') ? Number(p.get('version')) : record.document.version;
    if (!Number.isInteger(version) || version < 1) throw new PayrollError('Versi dokumen tidak valid.');
    if (p.has('kind') && p.get('kind') !== 'SLIP') throw new PayrollError('Rekap absensi tersedia sebagai pesan teks dan rincian LMS. File hanya untuk slip gaji.', 404);
    const history = record.document.history.find(h => h.version === version);
    const slip = (history ? history.slips : record.document.slips).find(s => s.profile_id === profileId);
    if (!slip || !canReadSlip(session, slip)) throw new PayrollError('Dokumen tidak ditemukan.', 404);
    if (!isPayrollAdmin(session) && (!history || !isPaid(record.document, profileId, slip.total))) throw new PayrollError('Slip final tersedia setelah admin menyelesaikan transfer.', 409);
    if (version !== record.document.version && !history) throw new PayrollError('Versi dokumen tidak ditemukan.', 404);
    const pdf = await generatePayrollPdf(record.document, slip, version);
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="slip-${period}-v${version}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof PayrollError ? e.message : 'PDF gagal dibuat. Periksa konfigurasi Chromium.' }, { status: e instanceof PayrollError ? e.status : 500 });
  }
}
