import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import { Award, Target, BookOpen } from 'lucide-react';

const getGrade = (score: number) => {
  if (score >= 8.5) return 'A';
  if (score >= 7.0) return 'B';
  if (score >= 5.5) return 'C';
  return 'D';
};

export default async function PublicReportView({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const supabase = getSupabaseAdmin();

  // Fetch the report with all relation details
  const { data: report, error } = await supabase
    .from('block_reports')
    .select(`
      *,
      class:classes(name, type, level:levels(name)),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error("[PublicReportView] Supabase Error:", error);
    return notFound();
  }
  
  // Check authorization for non-PUBLISHED reports
  const isPublished = report.status === 'PUBLISHED';
  if (!isPublished) {
    // If not PUBLISHED, only ADMIN or COACH involved can see it
    const { getSessionOrThrow } = await import('@/lib/auth');
    try {
      const session = await getSessionOrThrow();
      const role = session.user.role;
      if (role !== 'ADMIN' && role !== 'COACH') {
        return notFound();
      }
      // If it's DRAFT, only allow if not SENT (obviously) and user is COACH/ADMIN
      // Actually, Admin should probably see PUBLISHED, Coach see DRAFT.
      // Let's allow ADMIN/COACH to see any report they find if they have the ID.
    } catch (e) {
      // No session, and report not PUBLISHED
      return notFound();
    }
  }

  const klass = Array.isArray(report.class) ? report.class[0] : report.class;
  const block = Array.isArray(report.block) ? report.block[0] : report.block;
  const coder = Array.isArray(report.coder) ? report.coder[0] : report.coder;

  const { data: evalCriteria } = await supabase.from('evaluation_criteria').select('*').order('order_index');
  const criteriaMap = new Map(evalCriteria?.map(c => [c.id, c.name]) || []);

  // Fetch descriptions which now contain the pre-calculated scores
  const descriptionsData = await import('@/lib/dao/reportsDao').then(r => r.getBlockReportDescriptions(report.id));

  // Format the breakdown
  const breakdownData = evalCriteria?.map(c => {
    const desc = descriptionsData.find(d => d.criteria_id === c.id);
    return {
      name: c.name,
      average: Number((desc?.score || 0).toFixed(1)),
      description: desc?.description || ''
    };
  }) || [];

  // Format dates
  const pubDate = new Date(report.updated_at || report.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div style={{ minHeight: '100vh', padding: '2rem 1rem', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', borderRadius: '1.5rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', overflow: 'hidden' }}>
        
        {/* Header / Banner */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #152945 100%)', padding: '2.5rem 2rem', color: '#fff', textAlign: 'center', position: 'relative' }}>
          <div style={{ 
            position: 'absolute', top: '-50px', left: '-50px', width: '200px', height: '200px', 
            background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' 
          }} />
           <div style={{ 
            position: 'absolute', bottom: '-80px', right: '-20px', width: '250px', height: '250px', 
            background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0) 70%)', borderRadius: '50%' 
          }} />

          <img src="/logo-white.png" alt="Clevio" style={{ height: '36px', margin: '0 auto 1.5rem', display: 'block' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>Progress Report</h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 500 }}>{pubDate}</p>
        </div>

        {/* Identity Grid */}
        <div style={{ padding: '2.5rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Nama Siswa</p>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{coder?.full_name}</h2>
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Kelas / Level</p>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', margin: 0 }}>
              {klass?.name} <span style={{ color: '#cbd5e1' }}>|</span> {(klass as any)?.level?.name || 'Beginner'}
            </h2>
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Topik Block</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#f0fdf4', color: '#16a34a', padding: '0.3rem 0.75rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
              <BookOpen size={16} /> {block?.name}
            </div>
          </div>
        </div>

        {/* Grades & Breakdown */}
        <div style={{ padding: '2.5rem 2rem', display: 'flex', flexWrap: 'wrap', gap: '3rem', borderBottom: '1px solid #f1f5f9' }}>
          
          {/* Main Grade Circle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
             <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Nilai Akhir</p>
             <div style={{ 
               width: '120px', height: '120px', borderRadius: '50%', background: '#fff', border: '6px solid #10b981', 
               display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', boxShadow: '0 4px 14px 0 rgba(16,185,129,0.2)'
             }}>
               <span style={{ fontSize: '3.5rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{report.grade}</span>
             </div>
             <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#334155', marginTop: '0.5rem' }}>
               Rata-rata: {(report.average_score || 0).toFixed(1)}
             </p>
          </div>

          {/* Breakdown Bars */}
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={20} color="#3b82f6" /> Rincian Kompetensi
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {breakdownData.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569' }}>{item.name}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                      <span style={{ color: '#10b981', marginRight: '4px' }}>{getGrade(item.average)}</span> 
                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>({item.average}/10)</span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${(item.average / 10) * 100}%`, 
                      background: item.average >= 8 ? '#10b981' : item.average >= 6 ? '#f59e0b' : '#ef4444',
                      borderRadius: '999px',
                      transition: 'width 1s ease-in-out'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coach Notes */}
        <div style={{ padding: '2.5rem 2rem', background: '#fafafa' }}>
           <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={20} color="#f59e0b" /> Catatan Coach per Kompetensi
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {breakdownData.map((item, idx) => (
                <div key={idx} style={{ background: '#fff', padding: '1.25rem 1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {item.name}
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '0.5rem' }}>
                      Nilai: <span style={{ color: '#10b981', fontWeight: 800 }}>{getGrade(item.average)}</span>
                    </span>
                  </h4>
                  <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#334155', margin: 0 }}>
                    {item.description || 'Tidak ada catatan khusus.'}
                  </p>
                </div>
              ))}
            </div>
        </div>

        <div style={{ background: '#1e3a5f', padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
          Clevio Coder Camp - Building Future Innovators
        </div>
      </div>
    </div>
  );
}
