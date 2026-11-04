import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { isPayrollAdmin } from '@/lib/payroll/access';
import PayrollAdmin from './PayrollAdmin';

export const dynamic = 'force-dynamic';
export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect('/login');
  if (!isPayrollAdmin(session)) return <div role="alert" className="p-6">Akses Gaji &amp; Slip Gaji belum diberikan. Hubungi superadmin.</div>;
  const { period } = await searchParams;
  return <PayrollAdmin initialPeriod={period} />;
}
