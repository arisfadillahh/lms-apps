import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { currentPeriod, PayrollError, type PeriodRecord } from '@/lib/payroll/model';
import { calculatePayroll, requireDraft } from './payroll';
import { getPayrollPeriod } from '@/lib/dao/payrollDao';
const execute=promisify(execFile);
export async function refreshPayrollSource(record: PeriodRecord, actor: string | null, now = new Date()) {
  requireDraft(record);
  if(record.id!==currentPeriod(now).id||!record.document.legacy_imports?.length)throw new PayrollError('Perbarui aktivitas melalui Hitung ulang pada periode ini.');
  if(process.env.PAYROLL_LOCAL_PREVIEW==='true')return calculatePayroll(record,now,actor);
  try {
    const args=[path.join(process.cwd(),'scripts/sync-payroll-source.py'),'--config','/root/lms/shared/payroll-source-sync.json','--env','/root/lms/shared/.env','--period',record.id,'--apply'];
    if(actor)args.push('--actor',actor);
    await execute('python3',args,{timeout:150000,maxBuffer:100000});
    const refreshed = await getPayrollPeriod(record.id);
    if (!refreshed) throw new PayrollError('Periode tidak ditemukan setelah pembaruan.',404);
    return await calculatePayroll({...refreshed,document:{...refreshed.document,source_refreshed_at:now.toISOString()}},now,actor);
  }catch{throw new PayrollError('Data belum berhasil diperbarui. Coba lagi; jika masih gagal, hubungi admin. Rekap terakhir tetap tersimpan.',409);}
}
