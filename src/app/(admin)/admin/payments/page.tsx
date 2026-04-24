import Link from 'next/link';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import AddPaymentPlanButton from './AddPaymentPlanButton';
import EditPaymentPlanButton from './EditPaymentPlanButton';
import DeletePaymentPlanButton from './DeletePaymentPlanButton';
import PageHead from '@/components/admin/PageHead';

export default async function PaymentDashboardPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const supabase = getSupabaseAdmin();

  const { data: plans } = await supabase
    .from('payment_plans')
    .select('*')
    .order('duration_months', { ascending: true });

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const basePricePerMonth = 850000;

  return (
    <div className="col gap-4">
      <PageHead
        title="Paket & Tarif"
        desc="Pusat kontrol paket pembayaran, reminder, harga level, dan tagihan coder."
        actions={
          <>
            <Link href="/admin/payments/pricing" className="btn btn-sm btn-ghost">Atur Harga per Level</Link>
            <AddPaymentPlanButton />
          </>
        }
      />

      <div className="grid grid-4">
        {plans?.map((p) => {
          const originalTotal = basePricePerMonth * p.duration_months;
          const discountedTotal = originalTotal * (1 - p.discount_percent / 100);
          const perMonth = discountedTotal / p.duration_months;

          return (
            <div key={p.id} className="card card-p" style={{ position: 'relative' }}>
              {p.discount_percent > 0 && (
                <span className="badge badge-success" style={{ position: 'absolute', top: 14, right: 14 }}>
                  -{p.discount_percent}%
                </span>
              )}
              <div className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {p.duration_months} bulan
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 4px' }}>{p.name}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)' }}>
                {p.discount_percent > 0 ? `Diskon ${p.discount_percent}%` : 'Normal'}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Dari harga per level
              </div>
              <div className="row gap-2" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                {p.is_active ? (
                  <span className="badge badge-success">Aktif</span>
                ) : (
                  <span className="badge badge-neutral">Nonaktif</span>
                )}
                <div className="row gap-1" style={{ marginLeft: 'auto' }}>
                  <EditPaymentPlanButton plan={p} />
                  <DeletePaymentPlanButton planId={p.id} planName={p.name} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
