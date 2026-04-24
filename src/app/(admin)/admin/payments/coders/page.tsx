import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { usersDao } from '@/lib/dao';
import CoderPaymentTable from './CoderPaymentTable';
import PageHead from '@/components/admin/PageHead';

export default async function CoderPaymentsPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const supabase = getSupabaseAdmin();
  const coders = await usersDao.listUsersByRole('CODER');

  const { data: periods } = await supabase
    .from('coder_payment_periods')
    .select('*, payment_plans(*), pricing(*)')
    .order('end_date', { ascending: true });

  const coderPayments = new Map<string, typeof periods>();
  periods?.forEach((period) => {
    const existing = coderPayments.get(period.coder_id) || [];
    existing.push(period);
    coderPayments.set(period.coder_id, existing);
  });

  const [{ data: plans }, { data: pricing }] = await Promise.all([
    supabase.from('payment_plans').select('*').eq('is_active', true),
    supabase.from('pricing').select('*, levels(name)').eq('is_active', true),
  ]);

  const { data: rawEnrollments } = await supabase
    .from('enrollments')
    .select('coder_id, classes(name)')
    .eq('status', 'ACTIVE');

  const coderClasses = new Map<string, string[]>();
  rawEnrollments?.forEach((enrollment: any) => {
    if (enrollment.classes?.name) {
      const existing = coderClasses.get(enrollment.coder_id) || [];
      existing.push(enrollment.classes.name);
      coderClasses.set(enrollment.coder_id, existing);
    }
  });

  const tableData = coders.map((coder) => {
    const coderPeriods = coderPayments.get(coder.id) || [];
    const activePeriod = coderPeriods.find((p: any) => p.status === 'ACTIVE');
    const classNames = coderClasses.get(coder.id) || [];
    return {
      id: coder.id,
      full_name: coder.full_name,
      username: coder.username,
      className: classNames.join(', '),
      activePeriod: activePeriod ? {
        id: activePeriod.id,
        start_date: activePeriod.start_date,
        end_date: activePeriod.end_date,
        total_amount: activePeriod.total_amount,
        status: activePeriod.status,
        payment_plan_id: activePeriod.payment_plan_id,
        pricing_id: activePeriod.pricing_id,
      } : undefined,
    };
  }).sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="col gap-4">
      <PageHead
        title="Periode Belajar Coder"
        desc="Mapping periode pembayaran ke coder aktif untuk kontrol tagihan dan perpanjangan."
      />
      <CoderPaymentTable
        coders={tableData}
        plans={plans || []}
        pricing={pricing || []}
      />
    </div>
  );
}
