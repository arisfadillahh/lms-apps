import Link from 'next/link';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import PageHead from '@/components/admin/PageHead';

export default async function ExpiredPaymentsPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const supabase = getSupabaseAdmin();

  const { data: periods } = await supabase
    .from('coder_payment_periods')
    .select('*, users!coder_payment_periods_coder_id_fkey(full_name, parent_contact_phone), payment_plans(*)')
    .eq('status', 'ACTIVE')
    .lte('end_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('end_date', { ascending: true });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const getDaysStatus = (endDate: string) => {
    const days = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: `Expired ${Math.abs(days)} hari`, cls: 'badge-danger' };
    if (days === 0) return { text: 'Hari ini expired', cls: 'badge-danger' };
    if (days <= 3) return { text: `H-${days}`, cls: 'badge-warn' };
    return { text: `H-${days}`, cls: 'badge-neutral' };
  };

  return (
    <div className="col gap-4">
      <PageHead
        title="Monitoring Expired"
        desc="Follow up periode belajar yang hampir habis atau sudah lewat jatuh tempo dalam 7 hari."
      />

      <div className="card" style={{ overflow: 'auto' }}>
        {periods && periods.length > 0 ? (
          <table className="table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Coder</th>
                <th>Paket</th>
                <th>Berakhir</th>
                <th>Total</th>
                <th>Status</th>
                <th>No. HP Ortu</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period: any) => {
                const status = getDaysStatus(period.end_date);
                return (
                  <tr key={period.id}>
                    <td style={{ fontWeight: 600 }}>{period.users?.full_name || 'Unknown'}</td>
                    <td>{period.payment_plans?.name || '-'}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{formatDate(period.end_date)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(period.total_amount)}</td>
                    <td><span className={`badge ${status.cls}`}>{status.text}</span></td>
                    <td>
                      {period.users?.parent_contact_phone ? (
                        <a
                          href={`https://wa.me/${period.users.parent_contact_phone.replace(/^0/, '62')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-ghost"
                          style={{ color: '#16a34a' }}
                        >
                          📱 {period.users.parent_contact_phone}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty" style={{ color: '#16a34a' }}>
            ✅ Tidak ada periode yang akan expired dalam 7 hari ke depan
          </div>
        )}
      </div>
    </div>
  );
}
