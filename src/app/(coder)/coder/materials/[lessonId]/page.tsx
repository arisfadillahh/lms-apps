import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Play } from 'lucide-react';
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
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem', paddingTop: '1rem' }}>
            {/* Navigation */}
            <header style={{ marginBottom: '2rem' }}>
                <Link
                    href="/coder/materials"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: '#64748b',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        transition: 'color 0.2s'
                    }}
                >
                    <ArrowLeft size={18} />
                    Kembali ke Materi
                </Link>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '3rem', alignItems: 'start' }}>

                {/* Main Content Area */}
                <main>
                    {/* Hero Header */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h1 style={{
                            fontSize: '2rem',
                            fontWeight: 800,
                            color: '#1e293b',
                            lineHeight: 1.2,
                            marginBottom: '1rem',
                            letterSpacing: '-0.02em'
                        }}>
                            {lesson.title}
                        </h1>
                    </div>

                    {/* Slide Viewer (Cinema Mode) */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Play size={18} fill="currentColor" />
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Slide Materi</h2>
                            </div>
                            {lesson.slide_url && (
                                <a
                                    href={lesson.slide_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                                >
                                    Buka Fullscreen <ExternalLink size={14} />
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
                            <div style={{ padding: '4rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1', color: '#94a3b8' }}>
                                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Slide belum tersedia</p>
                                <p style={{ fontSize: '0.9rem' }}>Materi presentasi belum diunggah untuk sesi ini.</p>
                            </div>
                        )}

                        {lesson.summary && (
                            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Ringkasan Materi</h3>
                                <div style={{ fontSize: '1rem', color: '#475569', lineHeight: 1.6 }}>
                                    {lesson.summary}
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {/* Sidebar */}
                <aside style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '2rem' }}>

                    {/* Project Mission Card - Only show if URL exists */}
                    {lesson.coach_example_url && (
                        <div style={projectCardStyle}>
                            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎮</div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>Project Mission</h3>
                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
                                    Cek hasil akhir project yang akan kita buat hari ini!
                                </p>
                            </div>

                            <a
                                href={lesson.coach_example_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={primaryButtonStyle}
                            >
                                <Play size={18} fill="currentColor" /> Mainkan Game
                            </a>
                        </div>
                    )}

                    {/* Session Info Card */}
                    <div style={sidebarCardStyle}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={18} className="text-blue-500" /> Info Sesi
                        </h3>

                        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                Tanggal & Waktu
                            </span>
                            <span style={{ color: '#334155', fontWeight: 600, fontSize: '0.95rem' }}>
                                {lesson.sessionDate
                                    ? new Date(lesson.sessionDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                    : 'Belum dijadwalkan'}
                            </span>
                            {lesson.sessionDate && (
                                <div style={{ marginTop: '0.25rem', color: '#64748b', fontSize: '0.9rem' }}>
                                    {new Date(lesson.sessionDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Responsive CSS */}
                <style>{`
                    @media (max-width: 1024px) {
                        div[style*="grid-template-columns"] {
                            grid-template-columns: 1fr !important;
                        }
                        aside {
                            position: static !important;
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
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};

const slideContainerStyle = {
    position: 'relative' as const,
    width: '100%',
    paddingTop: '62.5%', // Slightly taller aspect ratio for better visibility
    minHeight: '400px', // Minimum height to prevent too small display
    background: '#0f172a',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255,255,255,0.05)'
};

const slideFrameStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
};

const sidebarCardStyle = {
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '1.25rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};

const projectCardStyle = {
    background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.1)'
};

const primaryButtonStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    background: '#fff',
    color: '#1e40af',
    padding: '0.8rem',
    borderRadius: '10px',
    fontWeight: 700,
    textDecoration: 'none',
    transition: 'transform 0.1s, box-shadow 0.1s',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
};
