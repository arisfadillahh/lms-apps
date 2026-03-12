import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { getPendingLessonEvaluationsForCoach, getDraftReportsForCoach } from '@/lib/services/coach';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export default async function CoachRubricsPage() {
  const session = await getSessionOrThrow();
  const [pendingLessons, draftReports] = await Promise.all([
    getPendingLessonEvaluationsForCoach(session.user.id),
    getDraftReportsForCoach(session.user.id)
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e3a5f', marginBottom: '0.5rem' }}>
          Tugas Penilaian Lesson
        </h1>
        <p style={{ color: '#64748b', maxWidth: '52rem', lineHeight: 1.5 }}>
          Setiap kali suatu lesson selesai (dihiasi Centang Hijau di Daftar Sesi), coach harus memberinya nilai sebagai bahan bakar bagi AI yang akan merajik seluruhnya secara otomatis menjadi lembar Rapor Digital siswa di akhir blok.
        </p>
      </header>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <AlertCircle size={24} color="#f59e0b" />
          <h2 style={sectionTitleStyle}>
            Daftar Antrean Nilai
            {pendingLessons.length > 0 && <span style={badgeStyle}>{pendingLessons.length}</span>}
          </h2>
        </div>
        
        {pendingLessons.length === 0 ? (
          <div style={emptyStateWrapper}>
            <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: '#334155' }}>Hore! Semua nilai sudah terisi.</p>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.2rem' }}>
              Rajin banget nih coachnya, mantap!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingLessons.map((item) => (
              <div key={item.sessionId} style={itemCardStyle}>
                <div style={itemInfoStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={pillTagStyle}>{item.className}</span>
                    {item.blockName && <span style={pillLightStyle}>{item.blockName}</span>}
                  </div>
                  <h3 style={itemTitleStyle}>{item.lessonTitle}</h3>
                  <div style={itemMetaStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} /> {formatDate(item.sessionDate)}
                    </span>
                    <span style={{ color: '#cbd5f5', padding: '0 4px' }}>•</span>
                    <span>{item.studentsCount} Siswa Aktif</span>
                  </div>
                </div>
                
                <Link href={`/coach/rubrics/${item.sessionId}`} style={primaryButtonStyle}>
                  Beri Nilai →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <AlertCircle size={24} color="#f59e0b" />
          <h2 style={sectionTitleStyle}>
            Review Rapor AI (DRAFT)
            {draftReports.length > 0 && <span style={badgeStyle}>{draftReports.length}</span>}
          </h2>
        </div>
        
        {draftReports.length === 0 ? (
          <div style={emptyStateWrapper}>
            <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: '#334155' }}>Semua rapor sudah beres!</p>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.2rem' }}>
              Tidak ada draf rapor AI yang butuh direview.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {draftReports.map((report) => (
              <div key={report.reportId} style={itemCardStyle}>
                <div style={itemInfoStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={pillTagStyle}>{report.className}</span>
                    <span style={pillLightStyle}>{report.blockName}</span>
                  </div>
                  <h3 style={itemTitleStyle}>
                    Rapor {report.coderName}
                  </h3>
                  <div style={itemMetaStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} /> Dibuat: {formatDate(report.createdAt)}
                    </span>
                  </div>
                </div>
                
                <Link href={`/coach/reports/${report.reportId}`} style={{ ...primaryButtonStyle, background: '#eab308' }}>
                  Review Rapor AI →
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
  border: '1px solid #cbd5f5',
  background: '#fff',
  gap: '1rem',
  flexWrap: 'wrap',
  transition: 'border-color 0.2s',
};

const itemInfoStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const itemTitleStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: '0.2rem 0',
};

const itemMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
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
  backgroundColor: '#e0f2fe',
  color: '#0284c7',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const primaryButtonStyle: CSSProperties = {
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  background: '#16a34a',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '0.95rem',
  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
  transition: 'transform 0.1s, box-shadow 0.1s',
};
