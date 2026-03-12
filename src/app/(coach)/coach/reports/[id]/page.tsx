import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSessionOrThrow } from '@/lib/auth';
import { ArrowLeft, User, BookOpen } from 'lucide-react';
import ReportReviewClient from './ReportReviewClient';
import { classesDao } from '@/lib/dao';

export default async function CoachReportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrThrow();
  const coachId = session.user.id;
  
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const supabase = getSupabaseAdmin();

  // Fetch report details
  const { data: report, error } = await supabase
    .from('block_reports')
    .select(`
      *,
      class:classes(id, name, coach_id),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name, id)
    `)
    .eq('id', id)
    .single();

  if (error || !report) redirect('/coach/reports');

  // Verify ownership properly handles both main coaches and secondary/substitute coaches
  const klass = Array.isArray(report.class) ? report.class[0] : report.class;
  if (!klass) redirect('/coach/reports');
  
  const coachClasses = await classesDao.listClassesForCoach(coachId);
  const isAuthorized = coachClasses.some(c => c.id === klass.id);
  
  if (!isAuthorized) redirect('/coach/reports');

  // If already published, maybe don't allow edits? The user said "kalo udah oke bisa publish"
  if (report.status === 'PUBLISHED') {
     // For now, let's just show it or redirect. Let's redirect to list.
     redirect('/coach/reports');
  }

  // Fetch the criteria and the saved descriptions
  const criteriaData = await import('@/lib/dao/reportsDao').then(r => r.getEvaluationCriteria());
  const descriptionsData = await import('@/lib/dao/reportsDao').then(r => r.getBlockReportDescriptions(report.id));

  // Merge the descriptions with the criteria context
  const initialDescriptions = criteriaData.map(c => {
    const savedDesc = descriptionsData.find(d => d.criteria_id === c.id);
    return {
      criteriaId: c.id,
      criteriaName: c.name,
      score: savedDesc?.score || 0,
      description: savedDesc?.description || ''
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link href="/coach/reports" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Kembali ke Daftar
        </Link>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e3a5f', marginBottom: '0.25rem' }}>
            Review Draf Rapor
          </h1>
          <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 500 }}>
            Pastikan deskripsi sesuai dengan perkembangan siswa.
          </p>
        </div>
      </header>

      <section style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: 'var(--shadow-small)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color="#1d4ed8" />
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.1rem' }}>Coder</p>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {(report.coder as any)?.full_name || 'Coder'}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={24} color="#4f46e5" />
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.1rem' }}>Kelas & Block</p>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {(report.class as any)?.name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>|</span> {(report.block as any)?.name}
              </h3>
            </div>
          </div>

          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
             <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.1rem' }}>Nilai Akhir</p>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', justifyContent: 'flex-end' }}>
               <span style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{report.grade}</span>
               <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#94a3b8' }}>({report.average_score})</span>
             </div>
          </div>

        </div>

        <div style={{ padding: '2rem' }}>
          <ReportReviewClient 
            reportId={report.id} 
            initialDescriptions={initialDescriptions} 
          />
        </div>
      </section>
    </div>
  );
}
