'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { CSSProperties } from 'react';
import LessonDetailButton from './LessonDetailButton';
import type { LessonSlot } from '@/lib/services/lessonScheduler';

interface SessionLesson {
    sessionId: string;
    dateTime: string;
    lessonSlot: {
        title: string;
        partNumber: number;
        totalParts: number;
        lessonTemplate: {
            id: string;
            title: string;
            summary: string | null;
            slide_url: string | null;
            example_url: string | null;
            estimated_meeting_count: number | null;
            order_index: number;
            block_id: string;
            created_at: string;
            updated_at: string;
            make_up_instructions: string | null;
            example_storage_path: string | null;
        };
        block: {
            id: string;
            name: string | null;
            level_id: string;
            order_index: number;
            estimated_sessions: number | null;
            summary: string | null;
            is_published: boolean;
            created_at: string;
            updated_at: string;
        };
        globalIndex: number;
    } | null;
}

interface LessonListClientProps {
    sessions: SessionLesson[];
    coachId: string;
}

export default function LessonListClient({ sessions, coachId }: LessonListClientProps) {
    return (
        <div style={lessonListStyle}>
            {sessions.map((sess, idx) => {
                const isNext = idx === 0;
                const lessonSlot = sess.lessonSlot;
                const title = lessonSlot
                    ? (lessonSlot.totalParts > 1
                        ? `${lessonSlot.lessonTemplate.title} (Part ${lessonSlot.partNumber})`
                        : lessonSlot.lessonTemplate.title)
                    : 'Lesson tidak tersedia';
                const dateStr = format(new Date(sess.dateTime), 'EEEE, d MMM yyyy • HH:mm', { locale: id });

                return (
                    <div key={sess.sessionId} style={{
                        ...lessonItemStyle,
                        background: isNext ? 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)' : '#fff',
                        borderColor: isNext ? '#3b82f6' : '#e2e8f0',
                    }}>
                        <div style={lessonNumberStyle}>{idx + 1}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>
                                {title}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                {dateStr}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <LessonDetailButton
                                lessonSlot={lessonSlot as LessonSlot | null}
                                sessionId={sess.sessionId}
                                sessionDate={dateStr}
                                coachId={coachId}
                            />
                            <Link
                                href={`/coach/sessions/${sess.sessionId}/attendance`}
                                style={smallButtonStyle}
                            >
                                Absensi
                            </Link>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

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
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.4rem 0.7rem',
    background: '#1e3a5f',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.8rem',
    textDecoration: 'none',
};
