import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { isAttendanceAdmin } from '@/lib/payroll/access';
import CoachAttendance from './CoachAttendance';
export const dynamic = 'force-dynamic';
export default async function CoachAttendancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect('/login');
  if (!isAttendanceAdmin(session)) return <p role="alert">Akses koreksi absensi belum diberikan.</p>;
  return <CoachAttendance initialPeriod={(await searchParams).period} />;
}
