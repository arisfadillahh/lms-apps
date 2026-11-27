import 'server-only';
import { getPayrollConfig, ensurePayrollPeriod } from '@/lib/dao/payrollDao';
import { currentPeriod, wibDate } from '@/lib/payroll/model';
import { calculatePayroll } from './payroll';
import { sendPayrollBatch } from './payrollDelivery';

export async function runPayrollCron(now = new Date(), mode: 'daily' | 'notify' = 'daily') {
  const local = new Date(now.getTime() + 7 * 3600000);
  const deliveryWindow = local.getUTCDate() === 25 && local.getUTCHours() >= 9 && local.getUTCHours() < 17;
  if (mode === 'notify' && !deliveryWindow) return { skipped: 'Di luar jadwal notifikasi payroll' };
  const config = await getPayrollConfig();
  if (!config.settings.active_from || config.settings.active_from > wibDate(now) || !config.people.some(p => p.active)) return { skipped: 'Belum diaktifkan admin' };
  const p = currentPeriod(now);
  let record = await ensurePayrollPeriod(p.year, p.month);
  if (record.document.status !== 'DRAFT') return { period: p.id, skipped: 'Periode sudah final' };
  const morning = new Date(local);
  morning.setUTCHours(8, 50, 0, 0);
  const currentCalculation = Date.parse(record.document.calculated_at ?? '') >= morning.getTime() - 7 * 3600000;
  if (mode === 'daily') {
    if (!currentCalculation) await calculatePayroll(record, now);
    return { period: p.id, calculated: !currentCalculation, whatsappPaused: !config.settings.automation_enabled };
  }
  if (!config.settings.automation_enabled) return { period: p.id, whatsappPaused: true };
  // Recover a missed morning calculation once. Delivery retries reuse that draft.
  if (!currentCalculation) record = await calculatePayroll(record, now);
  const activeCoaches = new Set(config.people.filter(person => person.kind === 'COACH' && person.active).map(person => person.id));
  const ids = record.document.slips.filter(s => s.kind === 'COACH' && activeCoaches.has(s.profile_id)).map(s => s.profile_id);
  const recap = await sendPayrollBatch(p.id, ids, 'RECAP', null);
  // Coach recap notices already link to the form while it is open.
  const formOnlyIds = config.people.filter(person => person.active && person.kind === 'STAFF').map(person => person.id);
  const reimbursement = formOnlyIds.length ? await sendPayrollBatch(p.id, formOnlyIds, 'REIMBURSEMENT', null) : [];
  const reminder = local.getUTCHours() >= 16 ? await sendPayrollBatch(p.id, ids, 'REMINDER', null) : [];
  return { period: p.id, recap, reimbursement, reminder };
}
