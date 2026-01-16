import type { CSSProperties } from 'react';
import { BookOpen, Calendar, FileText, Download, Play, Video, ChevronRight, Lock } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { getAccessibleLessonsForCoder, getVisibleMaterialsForCoder } from '@/lib/services/coder';

export default async function CoderMaterialsPage() {
  const session = await getSessionOrThrow();
  const [lessonPlans, materialsByClass] = await Promise.all([
    getAccessibleLessonsForCoder(session.user.id),
    getVisibleMaterialsForCoder(session.user.id),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', paddingBottom: '4rem', maxWidth: '1000px', margin: '0 auto' }}>
      <header className="materials-header" style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem', color: '#1e293b', letterSpacing: '-0.03em', background: 'linear-gradient(to right, #1e293b, #334155)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Materi Pembelajaran
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          Akses kembali materi, modul, dan video dari sesi yang telah kamu pelajari.
        </p>
      </header>

      {/* 1. Lesson Plans Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
        {lessonPlans.map((entry) => {
          const blocksWithLessons = entry.blocks.filter((block) => block.lessons.length > 0);
          if (blocksWithLessons.length === 0) return null;

          return (
            <div key={entry.classId}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)' }}>
                  <BookOpen size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>{entry.name}</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Kelas Reguler</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                {blocksWithLessons.map((block) => (
                  <div key={block.id} style={{ position: 'relative' }}>
                    {/* Block Header */}
                    <div style={blockHeaderStyle}>
                      <div style={{ fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem' }}>Module Block</div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginTop: '0.25rem' }}>{block.name}</h3>
                    </div>

                    {/* Timeline Container */}
                    <div className="timeline-container" style={{ position: 'relative', paddingLeft: '2rem' }}>
                      {/* Vertical Line */}
                      <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '20px', width: '2px', background: '#e2e8f0', zIndex: 0 }} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {block.lessons.map((lesson, index) => {
                          const isScheduled = !!lesson.sessionDate;
                          const dateObj = lesson.sessionDate ? new Date(lesson.sessionDate) : null;
                          const isPast = dateObj ? dateObj < new Date() : false;

                          return (
                            <div key={lesson.id} style={{ position: 'relative', zIndex: 1 }}>
                              {/* Dot */}
                              <div style={{
                                position: 'absolute',
                                left: '-2.05rem',
                                top: '1.5rem',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: isScheduled ? (isPast ? '#fff' : '#3b82f6') : '#f1f5f9',
                                border: `4px solid ${isScheduled ? (isPast ? '#22c55e' : '#bfdbfe') : '#e2e8f0'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isScheduled ? (isPast ? '#22c55e' : '#fff') : '#94a3b8',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                              }}>
                                {isPast ? '✓' : (index + 1)}
                              </div>

                              {/* Card */}
                              <div style={lessonCardStyle}>
                                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                                  {/* Date Badge */}
                                  <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    minWidth: '60px',
                                    padding: '0.6rem 0.5rem',
                                    background: isScheduled ? '#eff6ff' : '#f8fafc',
                                    borderRadius: '10px',
                                    border: isScheduled ? '1px solid #dbeafe' : '1px solid #e2e8f0',
                                    color: isScheduled ? '#1d4ed8' : '#94a3b8'
                                  }}>
                                    {dateObj ? (
                                      <>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>{dateObj.getDate()}</span>
                                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>{dateObj.toLocaleDateString('id-ID', { month: 'short' })}</span>
                                      </>
                                    ) : (
                                      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>?</span>
                                    )}
                                  </div>

                                  {/* Content */}
                                  <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>{lesson.title}</h4>
                                    {lesson.summary && (
                                      <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>{lesson.summary}</p>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                      {isScheduled ? (
                                        <span style={badgeStyle}>
                                          <Video size={12} /> {new Date(lesson.sessionDate!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      ) : (
                                        <span style={{ ...badgeStyle, background: '#f1f5f9', color: '#94a3b8' }}>Belum dijadwalkan</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action */}
                                  <div style={{ alignSelf: 'center' }}>
                                    <a href={`/coder/materials/${lesson.id}`} style={actionButtonStyle}>
                                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)' }}>
                                        <ChevronRight size={20} />
                                      </div>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: '2px', background: '#f1f5f9', margin: '2rem 0' }} />

      {/* 2. Additional Materials Section */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ padding: '0.75rem', background: '#fdf2f8', borderRadius: '12px', color: '#db2777' }}>
            <FileText size={20} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Materi Tambahan</h2>
        </div>

        {materialsByClass.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ width: '64px', height: '64px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <FileText size={32} color="#cbd5e1" />
            </div>
            <p style={{ fontWeight: 600, color: '#64748b' }}>Belum ada materi tambahan</p>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Materi ekstra dari coach akan muncul di sini.</p>
          </div>
        ) : (
          <div className="materials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {materialsByClass.map((entry) => (
              entry.materials.map((material) => (
                <div key={material.id} style={materialCardStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{entry.name}</span>
                      {material.file_url && <Download size={16} color="#94a3b8" />}
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', lineHeight: 1.3 }}>{material.title}</h3>
                    {material.description && <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>{material.description}</p>}

                    {material.coach_note && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', fontSize: '0.85rem', color: '#b45309', display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>💡</span>
                        <div>{material.coach_note}</div>
                      </div>
                    )}
                  </div>
                  {material.file_url && (
                    <a href={material.file_url} target="_blank" rel="noreferrer" style={downloadButtonStyle}>
                      Buka File
                    </a>
                  )}
                </div>
              ))
            ))}
          </div>
        )}
      </section>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .materials-header h1 {
            font-size: 1.75rem !important;
          }
          .materials-header p {
            font-size: 0.95rem !important;
          }
          .materials-grid {
            grid-template-columns: 1fr !important;
          }
          .lesson-card-content {
            flex-direction: column !important;
            gap: 1rem !important;
          }
          .lesson-date-badge {
            flex-direction: row !important;
            min-width: auto !important;
            padding: 0.5rem 0.75rem !important;
          }
          .timeline-container {
            padding-left: 1rem !important;
          }
          .timeline-dot {
            left: -1.15rem !important;
            width: 24px !important;
            height: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}

const blockHeaderStyle: CSSProperties = {
  marginBottom: '1.5rem',
  padding: '1rem 1.5rem',
  background: '#f8fafc',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  display: 'inline-block'
};

const lessonCardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
  padding: '1.25rem',
  transition: 'transform 0.2s',
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.3rem 0.6rem',
  borderRadius: '6px',
  background: '#eff6ff',
  color: '#3b82f6',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  background: '#fff',
  borderRadius: '24px',
  border: '2px dashed #e2e8f0',
  textAlign: 'center'
};

const actionButtonStyle: CSSProperties = {
  textDecoration: 'none',
  display: 'block',
  transition: 'transform 0.2s'
};

const materialCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '1.5rem',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  transition: 'transform 0.2s',
  height: '100%',
  justifyContent: 'space-between',
  gap: '1rem'
};

const downloadButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '0.75rem',
  borderRadius: '10px',
  background: '#f1f5f9',
  color: '#1e293b',
  fontWeight: 600,
  fontSize: '0.9rem',
  textDecoration: 'none',
  transition: 'background 0.2s'
};
