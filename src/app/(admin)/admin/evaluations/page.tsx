export const revalidate = 0;

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import EvaluationsClient from './EvaluationsClient';

export default async function AdminEvaluationsPage() {
  const supabase = getSupabaseAdmin();

  const { data: criteria } = await supabase
    .from('evaluation_criteria')
    .select('*')
    .order('order_index', { ascending: true });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Kompetensi Penilaian Rapor</h1>
        <p style={{ color: '#64748b', maxWidth: '56rem', fontSize: '1rem', lineHeight: '1.6' }}>
          Kelola kriteria kompetensi dasar dan deskripsi yang akan digunakan oleh Coach saat memberikan nilai 1-10 untuk per-sesi.
        </p>
      </header>

      <EvaluationsClient initialData={criteria || []} />
    </div>
  );
}
