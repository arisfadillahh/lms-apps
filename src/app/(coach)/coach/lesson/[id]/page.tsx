import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { lessonTemplatesDao } from '@/lib/dao';
import ReportLessonButton from './ReportLessonButton';

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function CoachLessonDetailPage({ params }: PageProps) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'COACH');

    const resolvedParams = await params;
    const lessonId = resolvedParams.id;

    const lesson = await lessonTemplatesDao.getLessonTemplateById(lessonId);
    if (!lesson) {
        notFound();
    }

    return (
        <div style={containerStyle}>
            <Link href="/coach/dashboard" style={backLinkStyle}>
                ← Kembali ke Dashboard
            </Link>

            <div style={cardStyle}>
                <div style={headerStyle}>
                    <div>
                        <h1 style={titleStyle}>{lesson.title}</h1>
                        {lesson.summary && (
                            <p style={summaryStyle}>{lesson.summary}</p>
                        )}
                    </div>
                    <ReportLessonButton lessonId={lesson.id} lessonTitle={lesson.title} coachId={session.user.id} />
                </div>

                <div style={infoRowStyle}>
                    <div style={infoItemStyle}>
                        <span style={infoLabelStyle}>Jumlah Pertemuan</span>
                        <span style={infoValueStyle}>{lesson.estimated_meeting_count ?? '-'} sesi</span>
                    </div>
                    <div style={infoItemStyle}>
                        <span style={infoLabelStyle}>Urutan</span>
                        <span style={infoValueStyle}>Lesson {lesson.order_index}</span>
                    </div>
                </div>

                {/* Actions */}
                <div style={actionsStyle}>
                    {lesson.slide_url ? (
                        <a href={lesson.slide_url} target="_blank" rel="noopener noreferrer" style={primaryButtonStyle}>
                            📊 Buka Slide Materi
                        </a>
                    ) : (
                        <span style={noSlideStyle}>Belum ada slide</span>
                    )}
                    {lesson.example_url && (
                        <a href={lesson.example_url} target="_blank" rel="noopener noreferrer" style={secondaryButtonStyle}>
                            🎮 Lihat Contoh Game
                        </a>
                    )}
                </div>

                {/* Make-up Instructions */}
                {lesson.make_up_instructions && (
                    <div style={makeUpSectionStyle}>
                        <h3 style={sectionTitleStyle}>📝 Instruksi Make-Up / Pengganti</h3>
                        <p style={makeUpTextStyle}>{lesson.make_up_instructions}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

const containerStyle: CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto',
};

const backLinkStyle: CSSProperties = {
    display: 'inline-block',
    marginBottom: '1rem',
    color: '#2563eb',
    fontSize: '0.9rem',
    fontWeight: 500,
    textDecoration: 'none',
};

const cardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '1rem',
    padding: '2rem',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
};

const summaryStyle: CSSProperties = {
    fontSize: '0.95rem',
    color: '#64748b',
    marginTop: '0.5rem',
    lineHeight: 1.5,
};

const infoRowStyle: CSSProperties = {
    display: 'flex',
    gap: '2rem',
    marginBottom: '1.5rem',
    padding: '1rem',
    background: '#f8fafc',
    borderRadius: '0.75rem',
};

const infoItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
};

const infoLabelStyle: CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
};

const infoValueStyle: CSSProperties = {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#0f172a',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
};

const primaryButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: '#2563eb',
    color: '#fff',
    borderRadius: '0.5rem',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
};

const secondaryButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: '#f1f5f9',
    color: '#334155',
    borderRadius: '0.5rem',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
    border: '1px solid #e2e8f0',
};

const noSlideStyle: CSSProperties = {
    color: '#94a3b8',
    fontStyle: 'italic',
};

const makeUpSectionStyle: CSSProperties = {
    padding: '1rem',
    background: '#fffbeb',
    borderRadius: '0.75rem',
    border: '1px solid #fef3c7',
};

const sectionTitleStyle: CSSProperties = {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#92400e',
    marginBottom: '0.5rem',
};

const makeUpTextStyle: CSSProperties = {
    fontSize: '0.9rem',
    color: '#78350f',
    lineHeight: 1.6,
};
