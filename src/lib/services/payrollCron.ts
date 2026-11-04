import 'server-only';
import { getPayrollConfig, ensurePayrollPeriod } from '@/lib/dao/payrollDao';
import { currentPeriod, wibDate } from '@/lib/payroll/model';
import { calculatePayroll } from './payroll';
import { sendPayrollBatch } from './payrollDelivery';

export async function runPayrollCron(now = new Date()) {
  const config = await getPayrollConfig();
  if (!config.settings.automation_enabled || !config.settings.active_from || config.settings.active_from > wibDate(now) || !config.people.some(p => p.active)) return { skipped: 'Belum diaktifkan admin' };
  const p = currentPeriod(now);
  let record = await ensurePayrollPeriod(p.year, p.month);
  if (record.document.status === 'DRAFT') record = await calculatePayroll(record, now);
  const local = new Date(now.getTime() + 7 * 3600000);
  if (local.getUTCDate() !== 25 || local.getUTCHours() < 9 || local.getUTCHours() >= 17) return { period: p.id, calculated: true };
  const ids = record.document.slips.filter(s => s.kind === 'COACH').map(s => s.profile_id);
  const recap = await sendPayrollBatch(p.id, ids, 'RECAP', null);
  const reminder = local.getUTCHours() >= 16 ? await sendPayrollBatch(p.id, ids, 'REMINDER', null) : [];
  return { period: p.id, recap, reminder };
}
