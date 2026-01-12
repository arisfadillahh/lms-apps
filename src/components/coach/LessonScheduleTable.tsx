import type { CSSProperties } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';

type Session = {
    id: string;
    date_time: string;
    status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
};

type Lesson = {
    id: string;
    title: string;
    session_id: string | null;
    slide_url?: string | null;
    coach_example_url?: string | null;
    block_title?: string | null;
};

type LessonScheduleTableProps = {
    sessions: Session[];
    lessons: Lesson[];
};

export default function LessonScheduleTable({ sessions, lessons }: LessonScheduleTableProps) {
    // Map session_id -> Lesson
    const lessonMap = new Map<string, Lesson>();
    lessons.forEach((l) => {
        if (l.session_id) lessonMap.set(l.session_id, l);
    });

    return (
        <div style={containerStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Jadwal Belajar (Lesson Schedule)</h2>
            <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Jadwal</th>
                            <th style={thStyle}>Block</th>
                            <th style={thStyle}>Lesson / Materi</th>
                            <th style={thStyle}>Detail</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((session) => {
                            const lesson = lessonMap.get(session.id);
                            const isCancelled = session.status === 'CANCELLED';
                            const isPast = new Date(session.date_time) < new Date();

                            return (
                                <tr key={session.id} style={{ borderBottom: '1px solid #e2e8f0', background: isCancelled ? '#f8fafc' : 'white' }}>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 600, color: isCancelled ? '#94a3b8' : '#0f172a' }}>
                                            {format(new Date(session.date_time), 'EEEE, d MMM yyyy', { locale: id })}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {format(new Date(session.date_time), 'HH:mm')} WIB
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        {lesson?.block_title ? (
                                            <span style={{
                                                display: 'inline-block',
                                                background: '#f1f5f9',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '0.375rem',
                                                fontSize: '0.8rem',
                                                fontWeight: 500,
                                                color: '#475569'
                                            }}>
                                                {lesson.block_title}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td style={tdStyle}>
                                        {isCancelled ? (
                                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>— Tidak ada kelas (Libur/Batal) —</span>
                                        ) : lesson ? (
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#2563eb' }}>{lesson.title}</div>
                                                {lesson.slide_url && (
                                                    <a href={lesson.slide_url} target="_blank" rel="noreferrer" style={linkStyle}>
                                                        Slides
                                                    </a>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#64748b', fontStyle: 'italic' }}>Belum ada materi</span>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        {lesson?.coach_example_url ? (
                                            <a href={lesson.coach_example_url} target="_blank" rel="noreferrer" style={linkStyle}>
                                                Contoh Game
                                            </a>
                                        ) : '—'}
                                    </td>
                                    <td style={tdStyle}>
                                        <StatusBadge status={session.status} />
                                    </td>
                                    <td style={tdStyle}>
                                        {!isCancelled && (
                                            <Link href={`/coach/sessions/${session.id}/attendance`} style={actionButtonStyle}>
                                                Absensi
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        SCHEDULED: { bg: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', label: 'Terjadwal' },
        COMPLETED: { bg: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', label: 'Selesai' },
        CANCELLED: { bg: '#f1f5f9', color: '#94a3b8', label: 'Dibatalkan' },
    };
    const style = styles[status as keyof typeof styles] || styles.SCHEDULED;

    return (
        <span style={{
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: style.bg,
            color: style.color
        }}>
            {style.label}
        </span>
    );
}

const containerStyle: CSSProperties = {
    background: '#ffffff',
    borderRadius: '1rem',
    border: '1px solid #e2e8f0',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '600px',
};

const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '1rem',
    borderBottom: '2px solid #e2e8f0',
    color: '#64748b',
    fontSize: '0.85rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

const tdStyle: CSSProperties = {
    padding: '1rem',
    verticalAlign: 'top',
    fontSize: '0.95rem',
};

const linkStyle: CSSProperties = {
    color: '#2563eb',
    fontSize: '0.85rem',
    textDecoration: 'none',
    marginRight: '0.5rem',
};

const actionButtonStyle: CSSProperties = {
    display: 'inline-block',
    padding: '0.4rem 0.8rem',
    borderRadius: '0.375rem',
    background: '#0f172a',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: 500,
    textDecoration: 'none',
};
