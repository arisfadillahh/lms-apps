import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { getLessonDetailForCoder } from '@/lib/services/coder';
import { assertRole } from '@/lib/roles';

interface PageProps {
    params: Promise<{ lessonId: string }>;
}

export default async function CoderLessonDetailPage(props: PageProps) {
    const params = await props.params;
    const session = await getSessionOrThrow();
    await assertRole(session, 'CODER');

    const lesson = await getLessonDetailForCoder(session.user.id, params.lessonId);

    if (!lesson) {
        notFound();
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header>
                <Link
                    href="/coder/materials"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: '#64748b',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        marginBottom: '1rem',
                        textDecoration: 'none'
                    }}
                >
                    ← Kembali ke Materi
                </Link>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '2rem', alignItems: 'start' }}>
                {/* Main Content: Slides */}
                <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <section style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                                Detail Lesson
                            </h2>
                            {lesson.slide_url && (
                                <a
                                    href={lesson.slide_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.85rem', color: '#1e3a5f', fontWeight: 500 }}
                                >
                                    Buka di tab baru ↗
                                </a>
                            )}
                        </div>

                        {lesson.slide_url ? (
                            <div style={slideContainerStyle}>
                                <iframe
                                    src={getSlideEmbedUrl(lesson.slide_url)}
                                    title={lesson.title}
                                    allowFullScreen
                                    style={slideFrameStyle}
                                />
                            </div>
                        ) : (
                            <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.5rem', color: '#94a3b8' }}>
                                Slide belum tersedia.
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: '0.5rem' }}>
                                {lesson.title}
                            </h1>
                            {lesson.summary && (
                                <p style={{ fontSize: '1rem', color: '#475569', lineHeight: 1.6 }}>
                                    {lesson.summary}
                                </p>
                            )}
                        </div>
                    </section>


                </main>

                {/* Sidebar: Actions & Info */}
                <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Game / Example Card - Back in Sidebar */}
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>
                            🎮 Project Contoh
                        </h3>
                        {lesson.coach_example_url ? (
                            <a
                                href={lesson.coach_example_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={actionButtonStyle}
                            >
                                <span>Mainkan Game Contoh</span>
                                <span style={{ fontSize: '1.2rem' }}>👉</span>
                            </a>
                        ) : (
                            <p style={{ fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>
                                Belum ada contoh project untuk materi ini.
                            </p>
                        )}
                    </div>

                    {/* Session Info */}
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>
                            Info Sesi
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                            <div>
                                <span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Tanggal</span>
                                <span style={{ color: '#334155' }}>
                                    {lesson.sessionDate
                                        ? new Date(lesson.sessionDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                        : 'Belum dijadwalkan'}
                                </span>
                            </div>
                        </div>
                    </div>
                </aside>


                {/* Responsive CSS */}
                <style>{`
        @media (max-width: 1024px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
            </div>
        </div>
    );
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
        // ignore
    }
    return url;
}

const cardStyle = {
    background: '#ffffff',
    borderRadius: '1rem',
    border: '1px solid #e2e8f0',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};

const slideContainerStyle = {
    position: 'relative' as const,
    width: '100%',
    paddingTop: '56.25%', // 16:9 Aspect Ratio
    background: '#f1f5f9',
    borderRadius: '0.75rem',
    overflow: 'hidden',
};

const slideFrameStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
};

const actionButtonStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
    color: 'white',
    padding: '1rem',
    borderRadius: '0.75rem',
    fontWeight: 600,
    textDecoration: 'none',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
};
