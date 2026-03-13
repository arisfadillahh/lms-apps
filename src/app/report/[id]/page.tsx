import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';

const getGrade = (score: number) => {
  if (score >= 8.5) return 'A';
  if (score >= 7.0) return 'B';
  if (score >= 5.5) return 'C';
  return 'D';
};

const getGradeColor = (score: number) => {
  if (score >= 8.5) return '#16a34a';
  if (score >= 7.0) return '#2563eb';
  if (score >= 5.5) return '#d97706';
  return '#dc2626';
};

const getBarColor = (score: number) => {
  if (score >= 8) return '#10b981';
  if (score >= 6) return '#f59e0b';
  return '#ef4444';
};

export default async function PublicReportView({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const supabase = getSupabaseAdmin();

  const { data: report, error } = await supabase
    .from('block_reports')
    .select(`
      *,
      class:classes(id, name, type, level:levels(name)),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('[PublicReportView] Supabase Error:', error);
    return notFound();
  }

  const isPublished = report.status === 'PUBLISHED';
  if (!isPublished) {
    const { getSessionOrThrow } = await import('@/lib/auth');
    try {
      const session = await getSessionOrThrow();
      const role = session.user.role;
      if (role !== 'ADMIN' && role !== 'COACH') return notFound();
    } catch {
      return notFound();
    }
  }

  const klass = Array.isArray(report.class) ? report.class[0] : report.class;
  const block = Array.isArray(report.block) ? report.block[0] : report.block;
  const coder = Array.isArray(report.coder) ? report.coder[0] : report.coder;

  const [{ data: evalCriteria }, { data: lessonTemplates }] = await Promise.all([
    supabase.from('evaluation_criteria').select('*').order('order_index'),
    supabase.from('lesson_templates').select('title, order_index').eq('block_id', report.block_id).order('order_index'),
  ]);

  const descriptionsData = await import('@/lib/dao/reportsDao').then(r => r.getBlockReportDescriptions(report.id));

  const breakdownData = evalCriteria?.map(c => {
    const desc = descriptionsData.find(d => d.criteria_id === c.id);
    return {
      name: c.name,
      average: Number((desc?.score || 0).toFixed(1)),
      description: desc?.description || '',
    };
  }) || [];

  const lessonTitles = (lessonTemplates || []).map(l => l.title);

  const pubDate = new Date(report.updated_at || report.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const avgScore = Number((report.average_score || 0).toFixed(1));
  const grade = report.grade || getGrade(avgScore);
  const gradeColor = getGradeColor(avgScore);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: '"Inter", system-ui, -apple-system, sans-serif', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* ── HEADER ── */}
        <div style={{ background: '#0f172a', borderRadius: '1.25rem 1.25rem 0 0', padding: '2rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Clevio Coder Camp</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>Progress Report</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Diterbitkan</div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.15rem' }}>{pubDate}</div>
          </div>
        </div>

        {/* ── STUDENT IDENTITY ── */}
        <div style={{ background: '#ffffff', padding: '1.75rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '2rem', alignItems: 'center' }}>
          {/* Avatar */}
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
              {coder?.full_name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
          {/* Info */}
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>{coder?.full_name}</div>
            <div style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 500 }}>
              {klass?.name}
              {(klass as any)?.level?.name && (
                <span style={{ marginLeft: '0.5rem', padding: '0.15rem 0.5rem', borderRadius: '0.375rem', background: '#f1f5f9', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                  {(klass as any).level.name}
                </span>
              )}
            </div>
          </div>
          {/* Block badge */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Block</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e3a5f', background: '#eff6ff', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #dbeafe' }}>{block?.name}</div>
          </div>
        </div>

        {/* ── OVERALL GRADE ── */}
        <div style={{ background: '#ffffff', padding: '2rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: '96px', height: '96px', borderRadius: '50%',
              border: `5px solid ${gradeColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 0 6px ${gradeColor}15`,
            }}>
              <span style={{ fontSize: '2.75rem', fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{grade}</span>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Nilai Akhir</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{avgScore}<span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}> / 10</span></div>
          </div>
          <div style={{ flex: 1, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6, fontStyle: 'italic' }}>
            Rapor ini merangkum perkembangan belajar selama satu block penuh. Nilai mencerminkan rata-rata dari seluruh kompetensi yang dinilai oleh Coach.
          </div>
        </div>

        {/* ── KOMPETENSI + NARASI (digabung per kriteria) ── */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ padding: '1.5rem 2.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
            Kompetensi &amp; Catatan Coach
          </div>
          {breakdownData.map((item, idx) => (
            <div key={idx} style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr',
              gap: '0',
              borderTop: '1px solid #f1f5f9',
            }}>
              {/* Kiri — Nama + Nilai */}
              <div style={{
                padding: '1.25rem 1.5rem 1.25rem 2.5rem',
                borderRight: '1px solid #f1f5f9',
                background: '#fafafa',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.6rem',
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>{item.name}</div>
                <div>
                  <span style={{
                    fontSize: '0.8rem', fontWeight: 700,
                    color: getBarColor(item.average),
                    background: `${getBarColor(item.average)}15`,
                    padding: '0.2rem 0.6rem', borderRadius: '0.4rem',
                    display: 'inline-block', marginBottom: '0.5rem',
                  }}>
                    {getGrade(item.average)} · {item.average}/10
                  </span>
                  <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(item.average / 10) * 100}%`, background: getBarColor(item.average), borderRadius: '999px' }} />
                  </div>
                </div>
              </div>
              {/* Kanan — Narasi */}
              <div style={{ padding: '1.25rem 2.5rem 1.25rem 1.5rem', display: 'flex', alignItems: 'center' }}>
                <p style={{ fontSize: '0.93rem', lineHeight: 1.75, color: '#475569', margin: 0 }}>
                  {item.description || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Tidak ada catatan.</span>}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── MATERI YANG DIPELAJARI ── */}
        {lessonTitles.length > 0 && (
          <div style={{ background: '#ffffff', padding: '2rem 2.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem' }}>Materi yang Dipelajari</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
              {lessonTitles.map((title, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.85rem', borderRadius: '0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', lineHeight: 1.3 }}>{title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PENUTUP ── */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2.5rem', borderRadius: '0 0 1.25rem 1.25rem', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.7, color: '#94a3b8', margin: 0, fontStyle: 'italic', textAlign: 'center' }}>
            Terima kasih atas kepercayaan Anda kepada Clevio Coder Camp. Kami berkomitmen mendampingi setiap anak menjadi inovator masa depan.
          </p>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 500 }}>
          © {new Date().getFullYear()} Clevio Coder Camp · Building Future Innovators
        </div>

      </div>
    </div>
  );
}
