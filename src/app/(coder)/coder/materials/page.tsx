import type { CSSProperties } from 'react';
import { BookOpen, Calendar, FileText, Download } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { getAccessibleLessonsForCoder, getVisibleMaterialsForCoder } from '@/lib/services/coder';

export default async function CoderMaterialsPage() {
  const session = await getSessionOrThrow();
  const [lessonPlans, materialsByClass] = await Promise.all([
    getAccessibleLessonsForCoder(session.user.id),
    getVisibleMaterialsForCoder(session.user.id),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      <header>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1e293b', letterSpacing: '-0.02em' }}>
          Pelajaran & Materi
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '800px', lineHeight: 1.6 }}>
          Akses modul pelajaran, slide presentasi, dan materi tambahan dari coach.
        </p>
      </header>

      {/* 1. Lesson Plans Section */}
      {lessonPlans.map((entry) => {
        const blocksWithLessons = entry.blocks.filter((block) => block.lessons.length > 0);
        return (
          <section key={entry.classId} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <span style={{ width: '4px', height: '24px', background: '#3b82f6', borderRadius: '2px' }}></span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{entry.name}</h2>
            </div>

            {blocksWithLessons.length === 0 ? (
              <div style={emptyStateStyle}>
                <BookOpen size={32} color="#cbd5e1" />
                <p>Belum ada materi pelajaran yang tersedia.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {blocksWithLessons.map((block) => (
                  <div key={block.id}>
                    <h3 style={{
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      background: '#f8fafc',
                      padding: '0.6rem 1rem',
                      borderRadius: '8px'
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></div>
                      {block.name}
                    </h3>

                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                        <thead style={{ background: '#f8fafc' }}>
                          <tr>
                            <th style={thStyle}>Topik Pelajaran</th>
                            <th style={thStyle} className="hide-mobile">Jadwal Sesi</th>
                            <th style={{ ...thStyle, width: '150px', textAlign: 'center' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.lessons.map((lesson) => (
                            <tr key={lesson.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', background: '#fff' }}>
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>#{lesson.orderIndex + 1}</span>
                                  {lesson.title}
                                </div>
                                {lesson.summary && (
                                  <div style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '540px', lineHeight: 1.5 }}>
                                    {lesson.summary}
                                  </div>
                                )}
                                <div className="show-mobile" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <Calendar size={14} />
                                  {lesson.sessionDate ? new Date(lesson.sessionDate).toLocaleDateString() : 'Belum dijadwalkan'}
                                </div>
                              </td>
                              <td style={tdStyle} className="hide-mobile">
                                {lesson.sessionDate ? (
                                  <span style={{ color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                                    <Calendar size={16} color="#64748b" />
                                    {new Date(lesson.sessionDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>Belum dijadwalkan</span>
                                )}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <a
                                  href={`/coder/materials/${lesson.id}`}
                                  style={actionButtonStyle}
                                >
                                  Buka Materi →
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* 2. Additional Materials Section */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
          <span style={{ width: '4px', height: '24px', background: '#ec4899', borderRadius: '2px' }}></span>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Materi Tambahan</h2>
        </div>

        {materialsByClass.length === 0 ? (
          <div style={emptyStateStyle}>
            <FileText size={32} color="#cbd5e1" />
            <p>Belum ada materi tambahan dari coach.</p>
          </div>
        ) : (
          materialsByClass.map((entry) => (
            <div key={entry.classId} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>{entry.name}</h3>
              {entry.materials.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>Belum ada materi yang dirilis.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {entry.materials.map((material) => (
                    <div key={material.id} style={materialCardStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <div style={{ padding: '0.5rem', background: '#f0f9ff', borderRadius: '8px', color: '#0284c7' }}>
                            <FileText size={20} />
                          </div>
                          <div>
                            <strong style={{ color: '#1e293b', fontSize: '1rem', display: 'block' }}>{material.title}</strong>
                            {material.description && <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem', lineHeight: 1.4 }}>{material.description}</p>}
                          </div>
                        </div>
                        {material.coach_note ? (
                          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', fontSize: '0.85rem', color: '#92400e' }}>
                            <strong>Catatan Coach:</strong> {material.coach_note}
                          </div>
                        ) : null}
                      </div>
                      {material.file_url ? (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                          <a href={material.file_url} target="_blank" rel="noreferrer" style={downloadLinkStyle}>
                            <Download size={16} /> Buka File
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  padding: '1.5rem',
};

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  padding: '3rem',
  background: '#f8fafc',
  borderRadius: '12px',
  border: '1px dashed #cbd5e1',
  color: '#ed8936'
};

const thStyle: CSSProperties = {
  padding: '1rem',
  fontSize: '0.8rem',
  color: '#64748b',
  fontWeight: 700,
  borderBottom: '1px solid #e2e8f0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
};

const tdStyle: CSSProperties = {
  padding: '1.25rem 1rem',
  verticalAlign: 'top',
};

const actionButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  background: '#eff6ff',
  color: '#3b82f6',
  fontWeight: 600,
  fontSize: '0.9rem',
  textDecoration: 'none',
  transition: 'all 0.2s',
  border: '1px solid #dbeafe'
};

const materialCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '1.25rem',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  transition: 'transform 0.2s, box-shadow 0.2s'
};

const downloadLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  color: '#0284c7',
  fontWeight: 600,
  fontSize: '0.9rem',
  textDecoration: 'none',
  padding: '0.5rem 0.8rem',
  borderRadius: '6px',
  background: '#f0f9ff',
  transition: 'background 0.2s'
};
