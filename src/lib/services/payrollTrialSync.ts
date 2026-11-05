import 'server-only';
import { getPayrollConfig, ensurePayrollPeriod } from '@/lib/dao/payrollDao';
import { currentPeriod, wibDate } from '@/lib/payroll/model';
import { calculatePayroll } from './payroll';
import { createPayrollAdminNotifications } from './payrollNotifications';

export async function syncSubmittedTrialPayroll(trialId: string, scheduledAt: string | null) {
  if (!scheduledAt) return;
  const config = await getPayrollConfig();
  if (!config.settings.active_from || wibDate(scheduledAt) < config.settings.active_from) return;
  const period = currentPeriod(new Date(scheduledAt));
  const record = await ensurePayrollPeriod(period.year, period.month);
  if (record.document.status === 'FINAL') {
    await createPayrollAdminNotifications({ title: 'Penilaian trial masuk setelah gaji final', message: `Periksa absensi trial periode ${period.id}. Buka revisi admin bila fee perlu diperbarui; versi final tidak diubah otomatis.`, actionUrl: `/admin/payroll?period=${period.id}`, dedupeKey: `payroll-late-trial:${trialId}:${period.id}` });
    return;
  }
  await calculatePayroll(record);
}

export async function syncPaidTrialGoalPayroll(invoiceId: string, paidAt: string) {
  const config = await getPayrollConfig();
  if (!config.settings.active_from || wibDate(paidAt) < config.settings.active_from) return;
  const period = currentPeriod(new Date(paidAt));
  const record = await ensurePayrollPeriod(period.year, period.month);
  if (record.document.status === 'FINAL') {
    await createPayrollAdminNotifications({ title: 'Bonus goal perlu pemeriksaan', message: `Invoice trial telah lunas untuk periode ${period.id}. Periksa bonus melalui revisi beralasan; slip final tidak berubah otomatis.`, actionUrl: `/admin/payroll?period=${period.id}`, dedupeKey: `payroll-late-goal:${invoiceId}:${period.id}`, push: false }, record.document.pic_id);
    return;
  }
  await calculatePayroll(record);
}
