import 'server-only';
import { getServerAuthSession, type AppSession } from '@/lib/auth';
import { canAccessMenu } from '@/lib/permissions';
import { PayrollError, type Slip } from './model';

export async function payrollSession(): Promise<AppSession> {
  const session = await getServerAuthSession();
  if (!session?.user.isActive) throw new PayrollError('Silakan masuk terlebih dahulu.', 401);
  return session;
}
export function isPayrollAdmin(session: AppSession): boolean {
  return session.user.role === 'ADMIN' && canAccessMenu(session.user.username, session.user.adminPermissions ?? null, 'payroll');
}
export function isAttendanceAdmin(session: AppSession): boolean {
  return session.user.role === 'ADMIN' && (canAccessMenu(session.user.username, session.user.adminPermissions ?? null, 'coachAttendance') || isPayrollAdmin(session));
}
export async function attendanceAdmin(): Promise<AppSession> {
  const session = await payrollSession();
  if (!isAttendanceAdmin(session)) throw new PayrollError('Akses koreksi untuk admin, coach lead, atau finance yang berwenang.', 403);
  return session;
}
export async function payrollAdmin(): Promise<AppSession> {
  const session = await payrollSession();
  if (!isPayrollAdmin(session)) throw new PayrollError('Akses pengelolaan gaji hanya untuk admin yang berwenang.', 403);
  return session;
}
export function canReadSlip(session: AppSession, slip: Slip): boolean {
  return isPayrollAdmin(session) || (session.user.role === 'COACH' && slip.user_id === session.user.id);
}
