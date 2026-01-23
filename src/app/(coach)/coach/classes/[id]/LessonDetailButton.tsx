'use client';

import { useState, type CSSProperties } from 'react';
import { BookOpen, X, ExternalLink, Presentation } from 'lucide-react';
import type { LessonSlot } from '@/lib/services/lessonScheduler';

import ReportLessonButton from '../../lesson/[id]/ReportLessonButton';

interface LessonDetailButtonProps {
    lessonSlot: LessonSlot | null;
    sessionId: string;
    sessionDate: string;
    coachId: string;
}

export default function LessonDetailButton({ lessonSlot, sessionId, sessionDate, coachId }: LessonDetailButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!lessonSlot) return null;

    const { lessonTemplate, partNumber, totalParts } = lessonSlot;
    const title = totalParts > 1
        ? `${lessonTemplate.title} (Part ${partNumber})`
        : lessonTemplate.title;
    const slideUrl = lessonTemplate.slide_url;
    const summary = lessonTemplate.summary;
    const exampleUrl = lessonTemplate.example_url;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                style={detailButtonStyle}
                title="Lihat detail lesson"
            >
                <BookOpen size={14} />
                Detail
            </button>

            {isOpen && (
                <div style={overlayStyle} onClick={() => setIsOpen(false)}>
                    <div style={modalStyle} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={headerStyle}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                    📅 {sessionDate}
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                                    {title}
                                </h2>
                            </div>
                            <button onClick={() => setIsOpen(false)} style={closeButtonStyle}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={bodyStyle}>
                            {/* Summary */}
                            {summary && (
                                <div style={sectionStyle}>
                                    <h3 style={sectionTitleStyle}>📝 Ringkasan</h3>
                                    <p style={{ color: '#475569', lineHeight: 1.6, margin: 0 }}>{summary}</p>
                                </div>
                            )}

                            {/* Slide */}
                            <div style={sectionStyle}>
                                <h3 style={sectionTitleStyle}>📊 Slide Presentasi</h3>
                                {slideUrl ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <a
                                            href={slideUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={linkButtonStyle}
                                        >
                                            <Presentation size={16} />
                                            Buka Slide di Tab Baru
                                            <ExternalLink size={14} />
                                        </a>
                                        <iframe
                                            src={slideUrl.replace('/edit', '/embed')}
                                            title={title}
                                            style={iframeStyle}
                                            allow="fullscreen"
                                            loading="lazy"
                                        />
                                    </div>
                                ) : (
                                    <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                                        Belum ada slide untuk lesson ini.
                                    </p>
                                )}
                            </div>

                            {/* Example Game */}
                            <div style={sectionStyle}>
                                <h3 style={sectionTitleStyle}>🎮 Contoh Game</h3>
                                {exampleUrl ? (
                                    <a href={exampleUrl} target="_blank" rel="noreferrer" style={linkButtonStyle}>
                                        <ExternalLink size={16} />
                                        Buka Contoh Game
                                    </a>
                                ) : (
                                    <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                                        Belum ada contoh game.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={footerStyle}>
                            <ReportLessonButton
                                lessonId={lessonTemplate.id}
                                lessonTitle={title}
                                coachId={coachId}
                            />
                            <a
                                href={`/coach/sessions/${sessionId}/attendance`}
                                style={primaryButtonStyle}
                            >
                                🎯 Ke Halaman Absensi
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const detailButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.4rem 0.7rem',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
};

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem',
    zIndex: 1000,
};

const modalStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '700px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e2e8f0',
};

const closeButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0.25rem',
};

const bodyStyle: CSSProperties = {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
};

const sectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
};

const sectionTitleStyle: CSSProperties = {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
};

const linkButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1rem',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    color: '#1d4ed8',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
    width: 'fit-content',
};

const iframeStyle: CSSProperties = {
    width: '100%',
    height: '350px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
};

const footerStyle: CSSProperties = {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'center',
};

const primaryButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.25rem',
    background: '#1e3a5f',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontWeight: 700,
    fontSize: '0.9rem',
    textDecoration: 'none',
};
