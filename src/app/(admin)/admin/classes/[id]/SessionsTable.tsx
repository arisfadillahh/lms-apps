'use client';

import { useState } from 'react';
import SessionRowActions from './SessionRowActions';
import AssignMaterialModal from './AssignMaterialModal';

type Session = {
    id: string;
    date_time: string;
    status: string;
    substitute_coach_id: string | null;
};

type ClassLesson = {
    id: string;
    title: string;
    order_index: number;
    blockName: string;
    blockOrder: number;
};

type SessionsTableProps = {
    classId: string;
    sessions: Session[];
    coachMap: Map<string, string>;
    lessonMap: Map<string, string>;
    availableLessons: ClassLesson[];
};

export default function SessionsTable({ classId, sessions, coachMap, lessonMap, availableLessons }: SessionsTableProps) {
    const pageSize = 10;

    // Compute the initial page to show — the page containing the nearest upcoming/current session
    const initialPage = (() => {
        const now = new Date();
        // Find the index of the nearest session that is SCHEDULED and closest to today (past or future)
        let nearestIndex = 0;
        let nearestDiff = Infinity;
        sessions.forEach((s, i) => {
            if (s.status === 'CANCELLED') return;
            const diff = Math.abs(new Date(s.date_time).getTime() - now.getTime());
            if (diff < nearestDiff) {
                nearestDiff = diff;
                nearestIndex = i;
            }
        });
        return Math.max(1, Math.ceil((nearestIndex + 1) / pageSize));
    })();

    const [page, setPage] = useState(initialPage);
    const [editingMaterialSession, setEditingMaterialSession] = useState<Session | null>(null);

    const totalPages = Math.ceil(sessions.length / pageSize);
    const startIndex = (page - 1) * pageSize;
    const currentSessions = sessions.slice(startIndex, startIndex + pageSize);

    const handleNext = () => {
        if (page < totalPages) setPage(page + 1);
    };

    const handlePrev = () => {
        if (page > 1) setPage(page - 1);
    };

    return (
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AssignMaterialModal
                classId={classId}
                sessionId={editingMaterialSession?.id ?? ''}
                currentDate={editingMaterialSession?.date_time ?? ''}
                isOpen={!!editingMaterialSession}
                onClose={() => setEditingMaterialSession(null)}
                availableLessons={availableLessons}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Sesi Pertemuan</h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Jadwal dan materi kelas.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', marginRight: '0.5rem', fontWeight: 500 }}>
                        Halaman {page} dari {totalPages || 1}
                    </span>
                    <button
                        onClick={handlePrev}
                        disabled={page === 1}
                        style={{
                            padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                            background: page === 1 ? '#f8fafc' : 'white', color: page === 1 ? '#94a3b8' : '#334155',
                            cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                        }}
                    >
                        Prev
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={page >= totalPages}
                        style={{
                            padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                            background: page >= totalPages ? '#f8fafc' : 'white', color: page >= totalPages ? '#94a3b8' : '#334155',
                            cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                        }}
                    >
                        Next
                    </button>
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'white', textAlign: 'left' }}>
                        <tr>
                            <th style={thStyle}>Tanggal & Waktu</th>
                            <th style={thStyle}>Materi</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Coach Substitute</th>
                            <th style={thStyle}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                    Sesi belum digenerate.
                                </td>
                            </tr>
                        ) : (
                            currentSessions.map((session) => (
                                <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', background: 'white' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                                            {new Date(session.date_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
                                            {new Date(session.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')} WIB
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, maxWidth: '220px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                                {lessonMap.get(session.id) ?? <span style={{ color: '#94a3b8', fontWeight: 400 }}>Belum dialokasikan</span>}
                                            </span>
                                            {session.status !== 'CANCELLED' && (
                                                <button
                                                    onClick={() => setEditingMaterialSession(session)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '6px',
                                                        padding: '0.25rem 0.5rem',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        color: '#475569',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                    title="Ubah Materi Sesi"
                                                >
                                                    Ubah
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.35rem 0.65rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            background: session.status === 'COMPLETED' ? '#dcfce7' : session.status === 'CANCELLED' ? '#fee2e2' : '#f1f5f9',
                                            color: session.status === 'COMPLETED' ? '#16a34a' : session.status === 'CANCELLED' ? '#dc2626' : '#475569',
                                            display: 'inline-block',
                                            letterSpacing: '0.02em'
                                        }}>
                                            {session.status}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        {session.substitute_coach_id ? (
                                            <span style={{ color: '#0369a1', fontWeight: 600, background: '#e0f2fe', padding: '0.35rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', display: 'inline-block' }}>
                                                {coachMap.get(session.substitute_coach_id) ?? 'Coach'}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#cbd5e1' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        <SessionRowActions
                                            sessionId={session.id}
                                            substituteCoachName={session.substitute_coach_id ? coachMap.get(session.substitute_coach_id) ?? null : null}
                                            currentStatus={session.status as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'}
                                            currentDate={session.date_time}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '1.25rem 1.5rem',
    fontSize: '0.75rem',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
    padding: '1.25rem 1.5rem',
    verticalAlign: 'middle'
};
