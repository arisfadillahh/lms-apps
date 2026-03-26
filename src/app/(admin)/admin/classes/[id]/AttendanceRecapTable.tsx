'use client';

import type { CSSProperties } from 'react';
import type { AttendanceRecord } from '@/lib/dao/attendanceDao';

type Session = {
    id: string;
    date_time: string;
    status: string;
};

type Enrollment = {
    coder_id: string;
    status: string;
};

type Props = {
    sessions: Session[];
    enrollments: Enrollment[];
    coderMap: Map<string, string>;
    attendanceRecords: AttendanceRecord[];
};

export default function AttendanceRecapTable({ sessions, enrollments, coderMap, attendanceRecords }: Props) {
    const validSessions = sessions
        .filter(s => s.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    const attendanceMatrix = new Map<string, Map<string, string>>();

    for (const record of attendanceRecords) {
        if (!attendanceMatrix.has(record.coder_id)) {
            attendanceMatrix.set(record.coder_id, new Map());
        }
        attendanceMatrix.get(record.coder_id)!.set(record.session_id, record.status);
    }

    const getStatusToken = (status?: string) => {
        if (status === 'PRESENT') return { label: 'Hadir', bg: '#dcfce7', color: '#16a34a' };
        if (status === 'LATE') return { label: 'Telat', bg: '#fef3c7', color: '#d97706' };
        if (status === 'EXCUSED') return { label: 'Izin', bg: '#e0f2fe', color: '#0284c7' };
        if (status === 'ABSENT') return { label: 'Alpa', bg: '#fee2e2', color: '#dc2626' };
        return { label: '—', bg: '#f8fafc', color: '#94a3b8' };
    };

    return (
        <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Rekap Absensi Kelas</h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Pantau kehadiran siswa di setiap pertemuan berjalan.</p>
                </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
                        <tr>
                            <th style={{ ...thStyle, position: 'sticky', left: 0, background: '#f8fafc', zIndex: 10, borderRight: '1px solid #e2e8f0', minWidth: '200px' }}>
                                Nama Coder
                            </th>
                            {validSessions.map((session, i) => (
                                <th key={session.id} style={{ ...thStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    Pertemuan {i + 1}
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                        {new Date(session.date_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {enrollments.length === 0 ? (
                            <tr>
                                <td colSpan={validSessions.length + 1} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                    Belum ada siswa terdaftar.
                                </td>
                            </tr>
                        ) : (
                            enrollments.map(enrollment => {
                                const coderName = coderMap.get(enrollment.coder_id) ?? 'Unknown';
                                return (
                                    <tr key={enrollment.coder_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ ...tdStyle, position: 'sticky', left: 0, background: 'white', zIndex: 10, borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>
                                            {coderName}
                                        </td>
                                        {validSessions.map(session => {
                                            const status = attendanceMatrix.get(enrollment.coder_id)?.get(session.id);
                                            const token = getStatusToken(status);
                                            const isFuture = new Date(session.date_time) > new Date();
                                            
                                            return (
                                                <td key={session.id} style={{ ...tdStyle, textAlign: 'center', opacity: isFuture && !status ? 0.4 : 1 }}>
                                                    <span style={{
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        background: token.bg,
                                                        color: token.color,
                                                        display: 'inline-block',
                                                        minWidth: '50px'
                                                    }}>
                                                        {token.label}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

const cardStyle: CSSProperties = {
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    width: '100%',
    overflow: 'hidden',
};

const sectionHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #f1f5f9',
};

const thStyle: CSSProperties = {
    padding: '1rem',
    fontSize: '0.75rem',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
};

const tdStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '0.85rem',
    color: '#334155',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
};
