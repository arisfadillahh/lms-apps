export const revalidate = 0;

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import EvaluationsClient from './EvaluationsClient';
import PageHead from '@/components/admin/PageHead';

export default async function AdminEvaluationsPage() {
  const supabase = getSupabaseAdmin();

  const { data: criteria } = await supabase
    .from('evaluation_criteria')
    .select('*')
    .order('order_index', { ascending: true });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <PageHead
        title="Kompetensi Rapor"
        desc="Definisikan rubrik, indikator, dan template penilaian untuk laporan siswa."
      />

      <EvaluationsClient initialData={criteria || []} />
    </div>
  );
}
