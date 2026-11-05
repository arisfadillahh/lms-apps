import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { currentPeriod, PayrollError, type PeriodRecord } from '@/lib/payroll/model';
import { calculatePayroll, requireDraft } from './payroll';
const execute=promisify(execFile);
export async function refreshPayrollSource(record: PeriodRecord, actor: string) {
  requireDraft(record);
  if(record.id!==currentPeriod().id||!record.document.legacy_imports?.length)throw new PayrollError('Perbarui aktivitas melalui Hitung ulang pada periode ini.');
  if(process.env.PAYROLL_LOCAL_PREVIEW==='true')return calculatePayroll(record,new Date(),actor);
  try {
    await execute('python3',[path.join(process.cwd(),'scripts/sync-payroll-source.py'),'--config','/root/lms/shared/payroll-source-sync.json','--env','/root/lms/shared/.env','--period',record.id,'--actor',actor,'--apply'],{timeout:150000,maxBuffer:100000});
    return {success:true};
  }catch{throw new PayrollError('Data belum berhasil diperbarui. Coba lagi; jika masih gagal, hubungi admin. Rekap terakhir tetap tersimpan.',409);}
}
