import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { isAttendanceAdmin, isPayrollAdmin } from '@/lib/payroll/access';
import PayrollAdmin from './PayrollAdmin';
import CoachAttendance from '../coach-attendance/CoachAttendance';

export const dynamic = 'force-dynamic';
export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string; tab?: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect('/login');
  if (!isAttendanceAdmin(session)) return <div role="alert" className="p-6">Akses Gaji &amp; Slip Gaji belum diberikan. Hubungi superadmin.</div>;
  const { period, tab } = await searchParams;
  if (!isPayrollAdmin(session)) return <CoachAttendance initialPeriod={period} />;
  return <PayrollAdmin initialPeriod={period} initialTab={tab} />;
}
