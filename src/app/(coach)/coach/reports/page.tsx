import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSessionOrThrow } from '@/lib/auth';
import { CheckCircle2, FileText, ArrowRight } from 'lucide-react';

export default async function CoachReportsIndexPage() {
  const session = await getSessionOrThrow();
  const coachId = session.user.id;
  const supabase = getSupabaseAdmin();

  const { data: classes } = await supabase.from('classes').select('id').eq('coach_id', coachId);
  const classIds = classes?.map(c => c.id) || [];

  const { data: draftReports } = await supabase
    .from('block_reports')
    .select(`
      id,
      average_score,
      grade,
      class:classes(name),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name)
    `)
    .eq('status', 'DRAFT')
    .in('class_id', classIds)
    .order('created_at', { ascending: false });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e3a5f', marginBottom: '0.5rem' }}>
          Review Draf Rapor
        </h1>
        <p style={{ color: '#64748b', maxWidth: '52rem', lineHeight: 1.5 }}>
          Daftar rapor di bawah ini telah selesai di-generate oleh AI berdasarkan rubrik penilaian Anda. 
          Silakan tinjau kembali narasi deskripsinya, edit jika perlu, lalu klik Publish agar siap dikirimkan oleh Admin ke orang tua.
        </p>
      </header>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <FileText size={24} color="#f59e0b" />
          <h2 style={sectionTitleStyle}>
            Menunggu Review Anda
            {draftReports && draftReports.length > 0 && <span style={badgeStyle}>{draftReports.length}</span>}
          </h2>
        </div>

        {!draftReports || draftReports.length === 0 ? (
          <div style={emptyStateWrapper}>
            <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: '#334155', fontSize: '1.1rem' }}>Bagus! Tidak ada rapor yang perlu direview.</p>
            <p style={{ fontSize: '0.95rem', color: '#64748b', marginTop: '0.5rem' }}>
              Semua draf rapor sudah selesai dipublish.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {draftReports.map((report: any) => (
              <div key={report.id} style={itemCardStyle}>
                <div style={itemInfoStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={pillTagStyle}>{report.class?.name || 'Unknown Class'}</span>
                    <span style={pillLightStyle}>{report.block?.name || 'Unknown Block'}</span>
                  </div>
                  <h3 style={itemTitleStyle}>{report.coder?.full_name || 'Coder'}</h3>
                  <div style={itemMetaStyle}>
                    <span style={{ fontWeight: 700, color: '#3b82f6' }}>Nilai: {report.average_score} ({report.grade})</span>
                  </div>
                </div>
                
                <Link href={`/coach/reports/${report.id}`} style={primaryButtonStyle}>
                  Review Rapor <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '1rem',
  border: '1px solid #e2e8f0',
  padding: '2rem',
  boxShadow: 'var(--shadow-small)',
  display: 'flex',
  flexDirection: 'column',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#0f172a',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  margin: 0
};

const badgeStyle: CSSProperties = {
  background: '#ef4444',
  color: '#fff',
  fontSize: '0.85rem',
  padding: '0.15rem 0.6rem',
  borderRadius: '999px',
  fontWeight: 600,
};

const emptyStateWrapper: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  background: '#f8fafc',
  borderRadius: '0.75rem',
  border: '2px dashed #e2e8f0',
  textAlign: 'center',
};

const itemCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.25rem',
  borderRadius: '0.75rem',
  border: '1px solid #fef3c7',
  background: '#fffbeb',
  gap: '1rem',
  flexWrap: 'wrap',
  transition: 'all 0.2s',
};

const itemInfoStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const itemTitleStyle: CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 800,
  color: '#1e293b',
  margin: '0.2rem 0',
};

const itemMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.9rem',
  color: '#64748b',
};

const pillTagStyle: CSSProperties = {
  backgroundColor: '#1e3a5f',
  color: '#ffffff',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const pillLightStyle: CSSProperties = {
  backgroundColor: '#dbeafe',
  color: '#1d4ed8',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 700,
};

const primaryButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  background: '#f59e0b',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '0.95rem',
  transition: 'transform 0.1s, background-color 0.1s',
};
