import Link from 'next/link';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { levelsDao } from '@/lib/dao';
import AddPricingButton from './AddPricingButton';
import PricingActions from './PricingActions';
import PageHead from '@/components/admin/PageHead';

interface PricingItem {
  id: string;
  level_id: string | null;
  mode: 'ONLINE' | 'OFFLINE';
  base_price_monthly: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pricing_type: 'WEEKLY' | 'SEASONAL';
  seasonal_name: string | null;
}

export default async function PricingPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const supabase = getSupabaseAdmin();
  const [{ data }, levels] = await Promise.all([
    supabase.from('pricing').select('*').order('created_at', { ascending: false }),
    levelsDao.listLevels(),
  ]);

  const pricing = (data || []) as unknown as PricingItem[];
  const levelMap = new Map(levels.map((l) => [l.id, l.name]));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="col gap-4">
      <PageHead
        title="Harga per Level"
        desc="Sesuaikan base price, diskon, dan struktur biaya untuk semua level belajar."
        actions={<AddPricingButton levels={levels} />}
      />

      <div className="card" style={{ overflow: 'hidden' }}>
        {pricing && pricing.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tipe</th>
                  <th>Level / Program</th>
                  <th>Mode</th>
                  <th>Harga/Bulan</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pricing.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`badge ${item.pricing_type === 'SEASONAL' ? 'badge-info' : 'badge-neutral'}`}>
                        {item.pricing_type || 'WEEKLY'}
                      </span>
                    </td>
                    <td>
                      {item.pricing_type === 'SEASONAL'
                        ? (item.seasonal_name || '-')
                        : (item.level_id ? (levelMap.get(item.level_id) || 'Unknown') : '-')}
                    </td>
                    <td>
                      <span className={`badge ${item.mode === 'ONLINE' ? 'badge-info' : 'badge-warn'}`}>
                        {item.mode}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(item.base_price_monthly)}</td>
                    <td>
                      <span className={`badge ${item.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <PricingActions
                        pricing={item}
                        levels={levels}
                        levelName={item.pricing_type === 'SEASONAL'
                          ? (item.seasonal_name || '-')
                          : (item.level_id ? (levelMap.get(item.level_id) || 'Unknown') : '-')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Belum ada harga yang ditentukan. Klik &quot;Tambah Harga&quot; untuk mulai.</div>
        )}
      </div>
    </div>
  );
}
