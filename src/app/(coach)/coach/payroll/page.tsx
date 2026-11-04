import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import CoachPayroll from './CoachPayroll';

export const dynamic = 'force-dynamic';
export default async function CoachPayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== 'COACH') redirect('/login');
  const { period } = await searchParams;
  return <CoachPayroll initialPeriod={period} />;
}
