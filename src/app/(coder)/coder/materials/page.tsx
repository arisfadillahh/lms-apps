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
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>{entry.name}</h2>
            {blocksWithLessons.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                Belum ada lesson yang tersedia. Coach akan membuka slide setelah sesi berjalan.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {blocksWithLessons.map((block) => (
                  <div key={block.id} style={lessonBlockStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div>
                        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{block.name}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                          {formatDate(block.startDate)} – {formatDate(block.endDate)} • {block.status}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {block.lessons.map((lesson) => (
                        <div key={lesson.id} style={lessonCardStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <strong style={{ color: '#0f172a' }}>
                              #{lesson.orderIndex + 1} {lesson.title}
                            </strong>
                            {lesson.sessionDate ? (
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                Dibahas pada {new Date(lesson.sessionDate).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                          {lesson.slideUrl ? (
                            <div style={slideContainerStyle}>
                              <iframe
                                src={getSlideEmbedUrl(lesson.slideUrl)}
                                title={lesson.title}
                                allowFullScreen
                                style={slideFrameStyle}
                              />
                              <a href={lesson.slideUrl} target="_blank" rel="noreferrer" style={slideLinkStyle}>
                                Buka di tab baru
                              </a>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Coach belum menambahkan link slide.</span>
                          )}
                        </div>
                      ))}
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
                      <a href={material.file_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 500 }}>
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
  color: '#2563eb',
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
