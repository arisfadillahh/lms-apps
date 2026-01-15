import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { getAccessibleLessonsForCoder, getVisibleMaterialsForCoder } from '@/lib/services/coder';

export default async function CoderMaterialsPage() {
  const session = await getSessionOrThrow();
  const [lessonPlans, materialsByClass] = await Promise.all([
    getAccessibleLessonsForCoder(session.user.id),
    getVisibleMaterialsForCoder(session.user.id),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Pelajaran &amp; Materi</h1>
        <p style={{ color: '#64748b' }}>
          Lihat rangkuman block yang sedang berjalan, slide pembelajaran, dan materi tambahan yang dirilis coach.
        </p>
      </header>

      {lessonPlans.map((entry) => {
        const blocksWithLessons = entry.blocks.filter((block) => block.lessons.length > 0);
        return (
          <section key={entry.classId} style={cardStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem', color: '#0f172a' }}>{entry.name}</h2>

            {blocksWithLessons.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Belum ada materi pelajaran yang tersedia.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {blocksWithLessons.map((block) => (
                  <div key={block.id}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ height: '20px', width: '4px', background: '#3b82f6', borderRadius: '4px' }}></span>
                      {block.name}
                    </h3>

                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ background: '#f8fafc' }}>
                          <tr>
                            <th style={thStyle}>Topik Pelajaran</th>
                            <th style={thStyle} className="hide-mobile">Jadwal Sesi</th>
                            <th style={{ ...thStyle, width: '140px' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.lessons.map((lesson) => (
                            <tr key={lesson.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
                                  #{lesson.orderIndex + 1} {lesson.title}
                                </div>
                                {lesson.summary && (
                                  <div style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '480px', lineHeight: 1.4 }}>
                                    {lesson.summary}
                                  </div>
                                )}
                                <div className="show-mobile" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                  {lesson.sessionDate ? new Date(lesson.sessionDate).toLocaleDateString() : 'Belum dijadwalkan'}
                                </div>
                              </td>
                              <td style={tdStyle} className="hide-mobile">
                                {lesson.sessionDate ? (
                                  <span style={{ color: '#334155' }}>
                                    {new Date(lesson.sessionDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>
                                )}
                              </td>
                              <td style={tdStyle}>
                                <a
                                  href={`/coder/materials/${lesson.id}`}
                                  style={{
                                    display: 'inline-block',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                    textDecoration: 'none',
                                    transition: 'background 0.2s',
                                    whiteSpace: 'nowrap'
                                  }}
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

      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Materi Tambahan</h2>
        {materialsByClass.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Belum ada materi tambahan.</p>
        ) : (
          materialsByClass.map((entry) => (
            <div key={entry.classId} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{entry.name}</h3>
              {entry.materials.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Belum ada materi yang dirilis.</p>
              ) : (
                entry.materials.map((material) => (
                  <div key={material.id} style={materialCard}>
                    <div>
                      <strong style={{ color: '#0f172a' }}>{material.title}</strong>
                      {material.description ? <p style={{ color: '#475569', marginTop: '0.25rem' }}>{material.description}</p> : null}
                      {material.coach_note ? (
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Catatan coach: {material.coach_note}</p>
                      ) : null}
                    </div>
                    {material.file_url ? (
                      <a href={material.file_url} target="_blank" rel="noreferrer" style={{ color: '#1e3a5f', fontWeight: 500 }}>
                        Buka file
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function getSlideEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('docs.google.com')) {
      return url
        .replace(/\/edit.*$/, '/preview')
        .replace(/\/view.*$/, '/preview')
        .replace(/\/present.*$/, '/preview');
    }
  } catch {
    // ignore error and fall through
  }
  return url;
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
  overflowX: 'auto',
};

const lessonBlockStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.85rem',
  padding: '1rem 1.1rem',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const lessonCardStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '0.85rem 1rem',
  background: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  boxShadow: 'var(--shadow-medium)',
};

const slideContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const slideFrameStyle: CSSProperties = {
  width: '100%',
  minHeight: '320px',
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
};

const slideLinkStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#1e3a5f',
  fontWeight: 600,
  alignSelf: 'flex-start',
};

const materialCard: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.85rem 1rem',
  borderRadius: '0.75rem',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.8rem',
  color: '#475569',
  fontWeight: 600,
  borderBottom: '1px solid #e2e8f0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
};

const tdStyle: CSSProperties = {
  padding: '1rem',
  verticalAlign: 'top',
};
