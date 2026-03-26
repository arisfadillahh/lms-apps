'use client';

import { useState, useEffect, useRef } from 'react';
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

// Group sessions by month key "YYYY-MM"
function groupByMonth(sessions: Session[]) {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
        const d = new Date(s.date_time);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
    }
    // Return sorted months
    return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, slist]) => ({
            key,
            label: new Date(slist[0].date_time).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
            sessions: slist.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()),
        }));
}

export default function AttendanceRecapTable({ sessions, enrollments, coderMap, attendanceRecords }: Props) {
    const [now, setNow] = useState<Date | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const currentMonthRef = useRef<HTMLTableCellElement | null>(null);

    useEffect(() => {
        const n = new Date();
        setNow(n);
        // Auto-scroll to current month column after mount
        requestAnimationFrame(() => {
            if (currentMonthRef.current && scrollRef.current) {
                const container = scrollRef.current;
                const el = currentMonthRef.current;
                const elLeft = el.offsetLeft;
                const elWidth = el.offsetWidth;
                const containerWidth = container.clientWidth;
                container.scrollLeft = Math.max(0, elLeft - containerWidth / 2 + elWidth / 2);
            }
        });
    }, []);

    const validSessions = sessions
        .filter(s => s.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    const monthGroups = groupByMonth(validSessions);

    const attendanceMatrix = new Map<string, Map<string, { status: string; reason: string | null }>>();
    for (const record of attendanceRecords) {
        if (!attendanceMatrix.has(record.coder_id)) {
            attendanceMatrix.set(record.coder_id, new Map());
        }
        attendanceMatrix.get(record.coder_id)!.set(record.session_id, { status: record.status, reason: record.reason ?? null });
    }

    const getStatusToken = (status?: string, reason?: string | null) => {
        if (status === 'PRESENT') return { label: 'H', bg: '#dcfce7', color: '#15803d', title: 'Hadir' };
        if (status === 'LATE') return { label: 'H*', bg: '#dcfce7', color: '#15803d', title: 'Hadir (Terlambat)' };
        if (status === 'ABSENT' || status === 'EXCUSED') {
            const r = reason?.toLowerCase() ?? '';
            if (r === 'sakit') return { label: 'S', bg: '#e0f2fe', color: '#0369a1', title: 'Sakit' };
            if (r === 'izin') return { label: 'I', bg: '#fef9c3', color: '#a16207', title: 'Izin' };
            return { label: 'A', bg: '#fee2e2', color: '#dc2626', title: 'Alpha' };
        }
        return { label: '—', bg: '#f8fafc', color: '#94a3b8', title: '-' };
    };

    const currentMonthKey = now
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        : null;

    return (
        <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Rekap Absensi Kelas</h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Kehadiran siswa per tanggal, dikelompokkan per bulan.</p>
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {[{l: 'H', bg: '#dcfce7', c: '#15803d', t: 'Hadir'}, {l: 'I', bg: '#fef9c3', c: '#a16207', t: 'Izin'}, {l: 'S', bg: '#e0f2fe', c: '#0369a1', t: 'Sakit'}, {l: 'A', bg: '#fee2e2', c: '#dc2626', t: 'Alpha'}].map(x => (
                        <span key={x.l} title={x.t} style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: x.bg, color: x.c }}>
                            {x.l} = {x.t}
                        </span>
                    ))}
                </div>
            </div>

            <div ref={scrollRef} style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                        {/* Month group header row */}
                        <tr>
                            <th style={{ ...thStyle, position: 'sticky', left: 0, background: '#f8fafc', zIndex: 10, borderRight: '1px solid #e2e8f0', minWidth: '160px' }} rowSpan={2}>
                                Nama Coder
                            </th>
                            {monthGroups.map(group => {
                                const isCurrentMonth = group.key === currentMonthKey;
                                return (
                                    <th
                                        key={group.key}
                                        ref={isCurrentMonth ? (el) => { currentMonthRef.current = el; } : undefined}
                                        colSpan={group.sessions.length}
                                        style={{
                                            ...thStyle,
                                            textAlign: 'center',
                                            background: isCurrentMonth ? '#eff6ff' : '#f8fafc',
                                            color: isCurrentMonth ? '#1d4ed8' : '#64748b',
                                            borderLeft: '2px solid #e2e8f0',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {group.label}
                                        {isCurrentMonth && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', background: '#2563eb', color: 'white', borderRadius: '4px', padding: '0.1rem 0.35rem' }}>Bulan Ini</span>}
                                    </th>
                                );
                            })}
                        </tr>
                        {/* Date sub-header row */}
                        <tr>
                            {monthGroups.flatMap(group =>
                                group.sessions.map((session, i) => {
                                    const isCurrentMonth = group.key === currentMonthKey;
                                    const isFirstInMonth = i === 0;
                                    return (
                                        <th key={session.id} style={{
                                            ...thStyle,
                                            textAlign: 'center',
                                            whiteSpace: 'nowrap',
                                            background: isCurrentMonth ? '#f0f9ff' : 'white',
                                            borderLeft: isFirstInMonth ? '2px solid #e2e8f0' : '1px solid #f1f5f9',
                                            fontSize: '0.7rem',
                                            minWidth: '48px',
                                        }}>
                                            {new Date(session.date_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                        </th>
                                    );
                                })
                            )}
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
                                        {monthGroups.flatMap(group =>
                                            group.sessions.map((session, i) => {
                                                const rec = attendanceMatrix.get(enrollment.coder_id)?.get(session.id);
                                                const token = getStatusToken(rec?.status, rec?.reason);
                                                const isFuture = now ? new Date(session.date_time) > now : false;
                                                const isCurrentMonth = group.key === currentMonthKey;
                                                const isFirstInMonth = i === 0;
                                                return (
                                                    <td
                                                        key={session.id}
                                                        title={`${coderName} — ${new Date(session.date_time).toLocaleDateString('id-ID')} — ${token.title}`}
                                                        style={{
                                                            ...tdStyle,
                                                            textAlign: 'center',
                                                            opacity: isFuture && !status ? 0.4 : 1,
                                                            background: isCurrentMonth ? '#f0f9ff' : 'white',
                                                            borderLeft: isFirstInMonth ? '2px solid #e2e8f0' : '1px solid #f8fafc',
                                                            padding: '0.5rem 0.25rem',
                                                        }}
                                                    >
                                                        <span style={{
                                                            display: 'inline-block',
                                                            width: '28px',
                                                            height: '28px',
                                                            lineHeight: '28px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: token.bg,
                                                            color: token.color,
                                                            textAlign: 'center',
                                                        }}>
                                                            {token.label}
                                                        </span>
                                                    </td>
                                                );
                                            })
                                        )}
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
    flexWrap: 'wrap',
};

const thStyle: CSSProperties = {
    padding: '0.75rem 0.5rem',
    fontSize: '0.72rem',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
};

const tdStyle: CSSProperties = {
    padding: '0.6rem 0.5rem',
    fontSize: '0.85rem',
    color: '#334155',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
};
