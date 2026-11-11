import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { isAttendanceAdmin } from '@/lib/payroll/access';
export const dynamic = 'force-dynamic';
export default async function CoachAttendancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect('/login');
  if (!isAttendanceAdmin(session)) return <p role="alert">Akses koreksi absensi belum diberikan.</p>;
  const { period } = await searchParams;
  const query = new URLSearchParams({ tab: 'attendance' });
  if (period) query.set('period', period);
  redirect('/admin/payroll?' + query);
}
