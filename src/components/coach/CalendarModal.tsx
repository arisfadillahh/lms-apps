'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

type Session = {
    id: string;
    class_id: string;
    date_time: string;
    status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
    class_name?: string;
    lesson?: {
        title: string;
        block_name: string;
        slide_url: string | null;
        example_url: string | null;
    } | null;
};

type CalendarModalProps = {
    sessions: Session[];
    children?: React.ReactNode;
    triggerClassName?: string;
    triggerText?: React.ReactNode;
};

export default function CalendarModal({ sessions, children, triggerClassName, triggerText }: CalendarModalProps) {
    const [open, setOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
        calendarDays.push(day);
        day = addDays(day, 1);
    }

    // Sessions map
    const sessionsByDate = new Map<string, Session[]>();
    sessions.forEach(s => {
        const key = format(new Date(s.date_time), 'yyyy-MM-dd');
        if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
        sessionsByDate.get(key)!.push(s);
    });

    const nextMonth = () => setCurrentMonth(addDays(monthEnd, 1));
    const prevMonth = () => setCurrentMonth(addDays(monthStart, -1));

    return (
        <>
            <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Trigger asChild>
                    {children || (
                        <button
                            className={triggerClassName}
                            style={!triggerClassName ? triggerButtonStyle : undefined}
                        >
                            {triggerText || '📅 Buka Kalender Lengkap'}
                        </button>
                    )}
                </Dialog.Trigger>
                <Dialog.Portal>
                    <Dialog.Overlay style={overlayStyle} />
                    <Dialog.Content style={contentStyle}>
                        {/* Header */}
                        <div style={headerStyle}>
                            <Dialog.Title asChild>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Kalender Kelas</h2>
                            </Dialog.Title>

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                <button onClick={prevMonth} style={navIconStyle} title="Bulan Sebelumnya">
                                    <ChevronLeft size={20} />
                                </button>
                                <span style={{ fontSize: '1rem', fontWeight: 600, minWidth: '140px', textAlign: 'center', color: '#1e293b' }}>
                                    {format(currentMonth, 'MMMM yyyy', { locale: localeId })}
                                </span>
                                <button onClick={nextMonth} style={navIconStyle} title="Bulan Berikutnya">
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            <Dialog.Close asChild>
                                <button style={closeButtonStyle}>
                                    <X size={24} />
                                </button>
                            </Dialog.Close>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: '1.5rem', padding: '0.75rem 2rem', background: '#fff', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e3a5f' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }}></span>
                                <span>Akan Datang (Biru)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a' }}></span>
                                <span>Selesai (Hijau)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
                                <span>Batal/Libur (Merah)</span>
                            </div>
                        </div>

                        {/* Grid */}
                        <div style={gridStyle}>
                            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
                                <div key={d} style={dayHeaderStyle}>{d}</div>
                            ))}

                            {calendarDays.map((date, i) => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const daySessions = sessionsByDate.get(dateKey) || [];
                                const isCurrentMonth = isSameMonth(date, monthStart);
                                const isToday = isSameDay(date, new Date());

                                return (
                                    <div key={i} style={{
                                        ...cellStyle,
                                        background: isCurrentMonth ? 'white' : '#f8fafc',
                                    }}>
                                        <div style={{
                                            marginBottom: '0.5rem',
                                            display: 'flex',
                                            justifyContent: 'center'
                                        }}>
                                            <span style={isToday ? todayNumberStyle : dateNumberStyle}>
                                                {format(date, 'd')}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {daySessions.map(session => {
                                                // Determine color schema
                                                let badgeBg = '#eff6ff';
                                                let badgeColor = '#1d4ed8';
                                                let badgeBorder = 'transparent';

                                                if (session.status === 'COMPLETED') {
                                                    badgeBg = '#dcfce7';
                                                    badgeColor = '#166534';
                                                } else if (session.status === 'CANCELLED') {
                                                    badgeBg = '#fee2e2';
                                                    badgeColor = '#991b1b';
                                                }

                                                return (
                                                    <button
                                                        key={session.id}
                                                        onClick={() => setSelectedSession(session)}
                                                        style={{
                                                            ...sessionBadgeStyle,
                                                            background: badgeBg,
                                                            color: badgeColor,
                                                            border: `1px solid ${badgeBorder}`,
                                                            borderLeft: `3px solid ${badgeColor}`
                                                        }}
                                                        title={`${session.class_name} (${session.status})`}
                                                    >
                                                        <div style={{ fontWeight: 700, fontSize: '0.7rem' }}>
                                                            {format(new Date(session.date_time), 'HH:mm')}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.7rem',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            fontWeight: 500,
                                                            lineHeight: 1.2
                                                        }}>
                                                            {session.class_name || 'Class'}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Session Detail Modal */}
            <Dialog.Root open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay style={{ ...overlayStyle, zIndex: 1001 }} />
                    <Dialog.Content style={{ ...detailModalStyle, zIndex: 1002 }}>
                        {selectedSession && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                                            {selectedSession.class_name ?? 'Detail Sesi'}
                                        </h3>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                            {format(new Date(selectedSession.date_time), 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId })}
                                        </p>
                                    </div>
                                    <Dialog.Close asChild>
                                        <button style={closeButtonStyle} onClick={() => setSelectedSession(null)}>
                                            <X size={20} />
                                        </button>
                                    </Dialog.Close>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                                    {/* Status Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={detailLabelStyle}>Status:</span>
                                        <span style={{
                                            ...statusBadgeStyle(selectedSession.status),
                                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                                        }}>
                                            <span style={{
                                                width: '6px', height: '6px', borderRadius: '50%',
                                                background: selectedSession.status === 'COMPLETED' ? '#16a34a' : selectedSession.status === 'CANCELLED' ? '#ef4444' : '#3b82f6'
                                            }} />
                                            {selectedSession.status}
                                        </span>
                                    </div>

                                    {selectedSession.lesson ? (
                                        <div style={{ background: '#f8fafc', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                                            <div style={{ marginBottom: '0.75rem' }}>
                                                <span style={detailLabelStyle}>Materi Pembelajaran</span>
                                                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginTop: '0.25rem' }}>
                                                    {selectedSession.lesson.title}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                    Block: {selectedSession.lesson.block_name}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {selectedSession.lesson?.slide_url && (
                                                    <a href={selectedSession.lesson.slide_url} target="_blank" rel="noopener noreferrer" style={actionButtonStyle}>
                                                        📑 Slide
                                                    </a>
                                                )}
                                                {selectedSession.lesson?.example_url && (
                                                    <a href={selectedSession.lesson.example_url} target="_blank" rel="noopener noreferrer" style={actionButtonStyle}>
                                                        🎮 Game
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>
                                            {selectedSession.status === 'CANCELLED'
                                                ? '⛔ Sesi ini dibatalkan (Libur/Tidak ada kelas).'
                                                : 'Belum ada materi yang dijadwalkan.'}
                                        </div>
                                    )}

                                    <div>
                                        <span style={{ ...detailLabelStyle, display: 'block', marginBottom: '0.5rem' }}>Jalur Cepat</span>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <a href={`/coach/classes/${selectedSession.class_id}`} style={{ ...actionButtonStyle, background: 'white', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                                                🏫 Admin Kelas
                                            </a>
                                            <a href={`/coach/sessions/${selectedSession.id}/attendance`} style={{ ...actionButtonStyle, background: '#1e3a5f', color: 'white', border: '1px solid #1e3a5f' }}>
                                                📝 Isi Absensi
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}

// Styles
const overlayStyle: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 999, backdropFilter: 'blur(4px)'
};

const contentStyle: CSSProperties = {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '1000px', maxWidth: '95vw', height: '85vh', background: 'white', borderRadius: '1.5rem',
    padding: '0', zIndex: 1000, display: 'flex', flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', border: '1px solid #e2e8f0'
};

const detailModalStyle: CSSProperties = {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '420px', maxWidth: '90vw', background: 'white', borderRadius: '1.25rem',
    padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
};

const headerStyle: CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: '1px solid #f1f5f9', background: 'white'
};

const triggerButtonStyle: CSSProperties = {
    padding: '0.75rem 1.25rem', borderRadius: '0.75rem', background: 'white',
    color: '#0f172a', fontWeight: 600, border: '1px solid #e2e8f0', cursor: 'pointer',
    fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'all 0.2s'
};

const navIconStyle: CSSProperties = {
    background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
    width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#334155', fontSize: '0.85rem', transition: 'all 0.2s', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)'
};

const closeButtonStyle: CSSProperties = {
    background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.5rem', borderRadius: '0.5rem', display: 'flex', transition: 'background 0.2s'
};

const gridStyle: CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1,
    background: '#e2e8f0',
    gap: '1px', // Keep small gap for clean borders vs border collapse
    borderTop: '1px solid #e2e8f0',
    overflowY: 'auto'
};

const dayHeaderStyle: CSSProperties = {
    background: 'white', padding: '1rem', textAlign: 'center', fontWeight: 700,
    color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em',
    position: 'sticky', top: 0, zIndex: 10
};

const cellStyle: CSSProperties = {
    background: 'white', padding: '0.5rem', minHeight: '130px', display: 'flex', flexDirection: 'column',
    transition: 'background 0.2s'
};

const dateNumberStyle: CSSProperties = {
    fontSize: '0.9rem', fontWeight: 500, color: '#64748b',
    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%'
};

const todayNumberStyle: CSSProperties = {
    ...dateNumberStyle,
    background: '#3b82f6', color: 'white', fontWeight: 700
};

const sessionBadgeStyle: CSSProperties = {
    borderRadius: '0.35rem', padding: '0.35rem 0.5rem',
    display: 'flex', flexDirection: 'column', gap: '0.1rem', width: '100%',
    cursor: 'pointer', transition: 'transform 0.1s, opacity 0.2s', textAlign: 'left',
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)'
};

const detailLabelStyle: CSSProperties = {
    fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700
};

const actionButtonStyle: CSSProperties = {
    textAlign: 'center', padding: '0.6rem', borderRadius: '0.5rem',
    fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
    background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
};

const statusBadgeStyle = (status: string): CSSProperties => ({
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: status === 'COMPLETED' ? '#16a34a' : status === 'SCHEDULED' ? '#1e3a5f' : '#b91c1c',
    background: status === 'COMPLETED' ? '#dcfce7' : status === 'SCHEDULED' ? '#e0f2fe' : '#fee2e2',
});
