'use client';

import { useState } from 'react';
import SessionRowActions from './SessionRowActions';

type Session = {
    id: string;
    date_time: string;
    status: string;
    substitute_coach_id: string | null;
};

type SessionsTableProps = {
    sessions: Session[];
    coachMap: Map<string, string>;
};

export default function SessionsTable({ sessions, coachMap }: SessionsTableProps) {
    const [page, setPage] = useState(1);
    const pageSize = 10;

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
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Sesi Pertemuan</h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Jadwal sesi kelas.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', marginRight: '0.5rem' }}>
                        Halaman {page} dari {totalPages || 1}
                    </span>
                    <button
                        onClick={handlePrev}
                        disabled={page === 1}
                        style={{
                            padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0',
                            background: page === 1 ? '#f1f5f9' : 'white', color: page === 1 ? '#94a3b8' : '#334155',
                            cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem'
                        }}
                    >
                        Prev
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={page >= totalPages}
                        style={{
                            padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0',
                            background: page >= totalPages ? '#f1f5f9' : 'white', color: page >= totalPages ? '#94a3b8' : '#334155',
                            cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '0.85rem'
                        }}
                    >
                        Next
                    </button>
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
                        <tr>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Tanggal & Waktu</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Coach Pengganti</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                    Sesi belum digenerate.
                                </td>
                            </tr>
                        ) : (
                            currentSessions.map((session) => (
                                <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', background: 'white' }}>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                                        <div style={{ fontWeight: 500, color: '#1e293b' }}>
                                            {new Date(session.date_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            {new Date(session.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            background: session.status === 'COMPLETED' ? '#dcfce7' : session.status === 'CANCELLED' ? '#fee2e2' : '#f1f5f9',
                                            color: session.status === 'COMPLETED' ? '#16a34a' : session.status === 'CANCELLED' ? '#dc2626' : '#475569'
                                        }}>
                                            {session.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                                        {session.substitute_coach_id ? (
                                            <span style={{ color: '#0369a1', fontWeight: 600, background: '#e0f2fe', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                                                {coachMap.get(session.substitute_coach_id) ?? 'Coach'}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#cbd5e1' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
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
