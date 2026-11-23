import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Play, Gamepad2 } from 'lucide-react';
import { getSessionOrThrow } from '@/lib/auth';
import { getLessonDetailForCoder } from '@/lib/services/coder';
import { assertRole } from '@/lib/roles';
import AIChatbot from '@/components/coder/AIChatbot';
import styles from './lesson.module.css';

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
        <div className={`${styles.page} flex-1 overflow-y-auto overflow-x-hidden w-full relative`}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem', paddingTop: '1rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                {/* Navigation */}
            <header style={{ marginBottom: '2rem' }}>
                <Link
                    href="/coder/materials"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'var(--coder-muted, #64748b)',
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

            {/* Hero Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: 'var(--coder-text, #1e293b)',
                    lineHeight: 1.2,
                    marginBottom: '1rem',
                    letterSpacing: '-0.02em'
                }}>
                    {lesson.title}
                </h1>
            </div>

            <div className={styles.layout}>

                {/* Main Content Area */}
                <main>
                    {/* Slide Viewer (Cinema Mode) */}
                    <div style={cardStyle}>
                        <div className={styles.slideHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--coder-surface-soft, #eff6ff)', color: 'var(--lesson-link)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Play size={18} fill="currentColor" />
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--coder-text, #1e293b)', margin: 0 }}>Slide Materi</h2>
                            </div>
                            {lesson.slide_url && (
                                <a
                                    href={lesson.slide_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.9rem', color: 'var(--lesson-link)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
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
                            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--coder-surface-soft, #f8fafc)', borderRadius: '12px', border: '2px dashed var(--coder-border, #cbd5e1)', color: 'var(--coder-muted, #64748b)' }}>
                                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Slide belum tersedia</p>
                                <p style={{ fontSize: '0.9rem' }}>Materi presentasi belum diunggah untuk sesi ini.</p>
                            </div>
                        )}

                        {lesson.summary && (
                            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--coder-border, #e2e8f0)' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--coder-text, #1e293b)', marginBottom: '0.75rem' }}>Ringkasan Materi</h3>
                                <div style={{ fontSize: '1rem', color: 'var(--coder-muted, #475569)', lineHeight: 1.6, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                                    {lesson.summary}
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {/* Sidebar */}
                <aside className={styles.sidebar}>

                    {/* Project Mission Card - Only show if URL exists */}
                    {lesson.coach_example_url && (
                        <div style={projectCardStyle}>
                            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                <div style={{ marginBottom: '0.5rem', color: '#ffffff' }}><Gamepad2 size={48} strokeWidth={1.7} aria-hidden="true" /></div>
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
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--coder-text, #1e293b)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={18} style={{ color: 'var(--lesson-link)' }} /> Info Sesi
                        </h3>

                        <div style={{ padding: '1rem', background: 'var(--coder-surface-soft, #f8fafc)', borderRadius: '12px', border: '1px solid var(--coder-border, #e2e8f0)' }}>
                            <span style={{ display: 'block', color: 'var(--coder-muted, #64748b)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                Tanggal & Waktu
                            </span>
                            <span style={{ color: 'var(--coder-text, #334155)', fontWeight: 600, fontSize: '0.95rem' }}>
                                {lesson.sessionDate
                                    ? new Date(lesson.sessionDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
                                    : 'Belum dijadwalkan'}
                            </span>
                            {lesson.sessionDate && (
                                <div style={{ marginTop: '0.25rem', color: 'var(--coder-muted, #64748b)', fontSize: '0.9rem' }}>
                                    {new Date(lesson.sessionDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

            </div>
            <AIChatbot 
                classLessonId={params.lessonId}
                lessonTitle={lesson.title || 'Materi Belajar'} 
                lessonSummary={lesson.summary || ''} 
                lessonMakeUpInstructions={lesson.make_up_instructions} 
            />
        </div>
        </div>
    );
}

function getSlideEmbedUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('docs.google.com') && parsed.pathname.includes('/presentation/d/')) {
            // Check for /d/e/ pattern (published to web)
            if (parsed.pathname.includes('/d/e/')) {
                const segments = parsed.pathname.split('/');
                const eIndex = segments.indexOf('e');
                if (eIndex !== -1 && segments[eIndex + 1]) {
                    const presentationId = segments[eIndex + 1];
                    return `https://docs.google.com/presentation/d/e/${presentationId}/embed${parsed.search}`;
                }
            }

            // Standard /d/[ID] pattern
            const segments = parsed.pathname.split('/');
            const dIndex = segments.indexOf('d');

            if (dIndex !== -1 && segments[dIndex + 1]) {
                const presentationId = segments[dIndex + 1];
                // Check if the next segment is NOT 'e' (to avoid conflict with logic above, though order matters)
                if (presentationId !== 'e') {
                    return `https://docs.google.com/presentation/d/${presentationId}/embed${parsed.search}`;
                }
            }
        }
    } catch {
        // ignore
    }
    return url;
}

const cardStyle = {
    background: 'var(--coder-surface, #ffffff)',
    borderRadius: '16px',
    border: '1px solid var(--coder-border, #e2e8f0)',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};

const slideContainerStyle = {
    position: 'relative' as const,
    width: '100%',
    paddingTop: '62.5%', // Slightly taller aspect ratio for better visibility
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
    background: 'var(--coder-surface, #ffffff)',
    borderRadius: '16px',
    border: '1px solid var(--coder-border, #e2e8f0)',
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
