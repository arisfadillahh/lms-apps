import 'server-only';
import { getPayrollConfig, ensurePayrollPeriod } from '@/lib/dao/payrollDao';
import { currentPeriod, wibDate } from '@/lib/payroll/model';
import { calculatePayroll } from './payroll';
import { sendPayrollBatch } from './payrollDelivery';
import { refreshPayrollSource } from './payrollSourceSync';

export async function runPayrollCron(now = new Date()) {
  const config = await getPayrollConfig();
  if (!config.settings.active_from || config.settings.active_from > wibDate(now) || !config.people.some(p => p.active)) return { skipped: 'Belum diaktifkan admin' };
  const p = currentPeriod(now);
  let record = await ensurePayrollPeriod(p.year, p.month);
  if (record.document.status === 'DRAFT') {
    const checked = Date.parse(record.document.source_refreshed_at ?? '');
    if (record.document.legacy_imports?.length && (!Number.isFinite(checked) || now.getTime()-checked >= 3600000)) record = await refreshPayrollSource(record,null,now);
    else record = await calculatePayroll(record, now);
  }
  // This setting pauses scheduled messages only. Attendance, calculation and
  // hourly source refresh continue so the period stays current while WA is off.
  if (!config.settings.automation_enabled) return { period: p.id, calculated: true, whatsappPaused: true };
  const local = new Date(now.getTime() + 7 * 3600000);
  if (local.getUTCDate() !== 25 || local.getUTCHours() < 9 || local.getUTCHours() >= 17) return { period: p.id, calculated: true };
  const activeCoaches = new Set(config.people.filter(person => person.kind === 'COACH' && person.active).map(person => person.id));
  const ids = record.document.slips.filter(s => s.kind === 'COACH' && activeCoaches.has(s.profile_id)).map(s => s.profile_id);
  const recap = await sendPayrollBatch(p.id, ids, 'RECAP', null);
  // Staff have no attendance recap. Coaches with incomplete imported meeting
  // details still receive their scoped reimbursement form, without false dates.
  const formOnlyIds = [...config.people.filter(person => person.active && person.kind === 'STAFF').map(person => person.id), ...recap.filter(result => result.status === 'FAILED' && /tanggal dan nama kelas|jumlah aktivitas belum dilengkapi/.test(result.error ?? '')).map(result => result.profileId)];
  const reimbursement = formOnlyIds.length ? await sendPayrollBatch(p.id, formOnlyIds, 'REIMBURSEMENT', null) : [];
  const reminder = local.getUTCHours() >= 16 ? await sendPayrollBatch(p.id, ids, 'REMINDER', null) : [];
  return { period: p.id, recap, reimbursement, reminder };
}
