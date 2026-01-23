import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, sessionsDao } from '@/lib/dao';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import UploadMaterialForm from './UploadMaterialForm';
import CollapsibleUpload from './CollapsibleUpload';
import LessonListClient from './LessonListClient';
import type { CSSProperties } from 'react';

export const dynamic = 'force-dynamic';

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSessionOrThrow();
    const { id: classId } = await params;

    const classRecord = await classesDao.getClassById(classId);

    if (!classRecord) {
        notFound();
    }

    // Verify ownership
    if (classRecord.coach_id !== session.user.id) {
        return (
            <div style={{ padding: '2rem' }}>
                <h1 style={{ color: '#ef4444' }}>Akses Ditolak</h1>
                <p>Anda tidak memiliki akses ke kelas ini.</p>
                <Link href="/coach/dashboard" style={{ color: '#2563eb', textDecoration: 'underline' }}>Kembali ke Dashboard</Link>
            </div>
        );
    }

    const sessions = await sessionsDao.listSessionsByClass(classId);
    const lessonSchedule = await computeLessonSchedule(classId, classRecord.level_id, (classRecord as any).ekskul_lesson_plan_id);

    // Get future sessions only, sorted by date
    const now = new Date();
    const futureSessions = sessions
        .filter(s => new Date(s.date_time) > now && s.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    // Limit to 12 upcoming sessions
    const upcomingSessionsLimit = 12;
    const upcomingSessions = futureSessions.slice(0, upcomingSessionsLimit);
    const nextSession = upcomingSessions[0];
    const nextLessonSlot = nextSession ? lessonSchedule.get(nextSession.id) : null;

    // Prepare data for client component
    const sessionsForLessonList = upcomingSessions.map(s => {
        const slot = lessonSchedule.get(s.id);
        return {
            sessionId: s.id,
            dateTime: s.date_time,
            lessonSlot: slot ? {
                title: slot.lessonTemplate.title,
                partNumber: slot.partNumber,
                totalParts: slot.totalParts,
                lessonTemplate: slot.lessonTemplate,
                block: slot.block,
                globalIndex: slot.globalIndex,
            } : null,
        };
    });

    // Sessions for upload form
    const sessionsForUpload = sessions.map(s => ({
        id: s.id,
        date_time: s.date_time
    }));

    return (
        <div style={containerStyle}>
            {/* Header */}
            <header style={headerStyle}>
                <Link href="/coach/dashboard" style={backLinkStyle}>
                    ← Kembali ke Dashboard
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={titleStyle}>{classRecord.name}</h1>
                        <div style={subtitleStyle}>
                            <span style={typeBadgeStyle}>{classRecord.type}</span>
                            <span>•</span>
                            <span>{classRecord.schedule_day}, {classRecord.schedule_time}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Next Session Highlight */}
            {nextSession && (
                <section style={nextSessionCardStyle}>
                    <div style={{ marginBottom: '0.75rem' }}>
                        <span style={labelStyle}>📅 SESI BERIKUTNYA</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div style={sessionDateStyle}>
                                {format(toZonedTime(nextSession.date_time, 'Asia/Jakarta'), 'EEEE, d MMMM yyyy', { locale: id })}
                            </div>
                            <div style={sessionTimeStyle}>
                                {format(toZonedTime(nextSession.date_time, 'Asia/Jakarta'), 'HH:mm')} WIB
                            </div>
                            {nextLessonSlot && (
                                <div style={lessonTitleStyle}>
                                    📚 {formatLessonTitle(nextLessonSlot)}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {nextLessonSlot?.lessonTemplate.slide_url && (
                                <a
                                    href={nextLessonSlot.lessonTemplate.slide_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={outlineButtonStyle}
                                >
                                    📊 Lihat Slide
                                </a>
                            )}
                            <Link
                                href={`/coach/sessions/${nextSession.id}/attendance`}
                                style={primaryButtonStyle}
                            >
                                🎯 Absensi & Mulai Kelas
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* Lesson Plan - 12 Upcoming Sessions */}
            <section style={sectionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={sectionTitleStyle}>📚 Lesson Plan ({upcomingSessions.length} Pertemuan Ke Depan)</h2>
                    <Link href={`/coach/classes/${classId}/lessons`} style={viewAllLinkStyle}>
                        Lihat Semua →
                    </Link>
                </div>

                {sessionsForLessonList.length === 0 ? (
                    <p style={{ color: '#64748b', fontStyle: 'italic' }}>Tidak ada sesi yang akan datang.</p>
                ) : (
                    <LessonListClient sessions={sessionsForLessonList} coachId={session.user.id} />
                )}
            </section>

            {/* Collapsible Upload Section */}
            <CollapsibleUpload>
                <UploadMaterialForm
                    classId={classId}
                    sessions={sessionsForUpload}
                    defaultSessionId={nextSession?.id}
                />
            </CollapsibleUpload>
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '0 2rem 3rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
};

const headerStyle: CSSProperties = {
    marginBottom: '0.5rem',
};

const backLinkStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#64748b',
    textDecoration: 'none',
    marginBottom: '1rem',
    fontWeight: 500,
    fontSize: '0.9rem',
};

const titleStyle: CSSProperties = {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#1e293b',
    marginBottom: '0.5rem',
};

const subtitleStyle: CSSProperties = {
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'center',
    color: '#64748b',
    fontSize: '0.9rem',
};

const typeBadgeStyle: CSSProperties = {
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '0.2rem 0.6rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 600,
};

const nextSessionCardStyle: CSSProperties = {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    padding: '1.5rem',
    borderRadius: '16px',
    color: 'white',
};

const labelStyle: CSSProperties = {
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    opacity: 0.8,
};

const sessionDateStyle: CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
};

const sessionTimeStyle: CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 800,
    marginBottom: '0.5rem',
};

const lessonTitleStyle: CSSProperties = {
    fontSize: '1rem',
    opacity: 0.9,
    marginTop: '0.5rem',
};

const outlineButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '8px',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
};

const primaryButtonStyle: CSSProperties = {
    padding: '0.6rem 1.25rem',
    background: 'white',
    border: 'none',
    borderRadius: '8px',
    color: '#1e3a5f',
    fontWeight: 700,
    fontSize: '0.9rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
};

const sectionStyle: CSSProperties = {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
};

const sectionTitleStyle: CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
};

const viewAllLinkStyle: CSSProperties = {
    color: '#2563eb',
    fontSize: '0.85rem',
    fontWeight: 600,
    textDecoration: 'none',
};

const lessonListStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
};

const lessonItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
};

const lessonNumberStyle: CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#475569',
    flexShrink: 0,
};

const smallButtonStyle: CSSProperties = {
    padding: '0.4rem 0.8rem',
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '6px',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.8rem',
    textDecoration: 'none',
};
