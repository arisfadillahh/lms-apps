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
