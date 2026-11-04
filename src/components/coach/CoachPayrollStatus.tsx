import Link from 'next/link';
import { getPayrollConfig } from '@/lib/dao/payrollDao';
import { effective, wibDate } from '@/lib/payroll/model';

export default async function CoachPayrollStatus({ userId }: { userId: string }) {
  try {
    const config = await getPayrollConfig();
    const profile = config.people.find(p => p.user_id === userId);
    const term = profile && effective(config.terms.filter(t => t.profile_id === profile.id), wibDate(new Date()));
    return <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4"><span>Status coach: <strong>{term?.contract ?? 'Belum diatur admin'}</strong></span><Link href="/coach/payroll" className="text-primary underline underline-offset-4">Absensi &amp; slip gaji</Link></div>;
  } catch { return null; }
}
