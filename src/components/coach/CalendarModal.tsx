'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

type Session = {
    id: string;
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
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Kalender Kelas</h2>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <button onClick={prevMonth} style={navIconStyle}>←</button>
                                <span style={{ fontSize: '1.1rem', fontWeight: 500, minWidth: '150px', textAlign: 'center' }}>
                                    {format(currentMonth, 'MMMM yyyy', { locale: localeId })}
                                </span>
                                <button onClick={nextMonth} style={navIconStyle}>→</button>
                            </div>
                            <Dialog.Close asChild>
                                <button style={closeButtonStyle}>
                                    <X size={24} />
                                </button>
                            </Dialog.Close>
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
                                        opacity: isCurrentMonth ? 1 : 0.4,
                                        background: isToday ? '#eff6ff' : 'white'
                                    }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
                                            {format(date, 'd')}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {daySessions.map(session => (
                                                <button
                                                    key={session.id}
                                                    onClick={() => setSelectedSession(session)}
                                                    style={{
                                                        ...sessionBadgeStyle,
                                                        borderColor: session.status === 'CANCELLED' ? '#e2e8f0' : '#bfdbfe',
                                                        background: session.status === 'CANCELLED' ? '#f1f5f9' : '#eff6ff',
                                                        color: session.status === 'CANCELLED' ? '#94a3b8' : '#1e40af',
                                                        cursor: 'pointer',
                                                        textAlign: 'left'
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 600 }}>{format(new Date(session.date_time), 'HH:mm')}</div>
                                                    <div style={{
                                                        fontSize: '0.7rem',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        maxWidth: '100%'
                                                    }}>
                                                        {session.class_name || 'Class'}
                                                    </div>
                                                </button>
                                            ))}
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
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                            {selectedSession.class_name ?? 'Detail Sesi'}
                                        </h3>
                                        <p style={{ color: '#64748b' }}>
                                            {format(new Date(selectedSession.date_time), 'EEEE, d MMMM yyyy • HH:mm', { locale: localeId })}
                                        </p>
                                    </div>
                                    <Dialog.Close asChild>
                                        <button style={closeButtonStyle} onClick={() => setSelectedSession(null)}>
                                            <X size={20} />
                                        </button>
                                    </Dialog.Close>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={detailItemStyle}>
                                        <span style={detailLabelStyle}>Status</span>
                                        <span style={{
                                            ...statusBadgeStyle(selectedSession.status),
                                            display: 'inline-block'
                                        }}>
                                            {selectedSession.status}
                                        </span>
                                    </div>

                                    {selectedSession.lesson ? (
                                        <>
                                            <div style={detailItemStyle}>
                                                <span style={detailLabelStyle}>Materi (Lesson)</span>
                                                <div style={{ fontWeight: 500 }}>{selectedSession.lesson.title}</div>
                                            </div>
                                            <div style={detailItemStyle}>
                                                <span style={detailLabelStyle}>Block</span>
                                                <div>{selectedSession.lesson.block_name}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                {selectedSession.lesson.slide_url && (
                                                    <a href={selectedSession.lesson.slide_url} target="_blank" rel="noopener noreferrer" style={actionButtonStyle}>
                                                        📑 Slide Materi
                                                    </a>
                                                )}
                                                {selectedSession.lesson.example_url && (
                                                    <a href={selectedSession.lesson.example_url} target="_blank" rel="noopener noreferrer" style={actionButtonStyle}>
                                                        🎮 Contoh Game
                                                    </a>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                                            {selectedSession.status === 'CANCELLED'
                                                ? 'Sesi ini dibatalkan (Libur/Tidak ada kelas).'
                                                : 'Belum ada materi yang dijadwalkan untuk sesi ini.'}
                                        </div>
                                    )}
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
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, backdropFilter: 'blur(2px)'
};

const contentStyle: CSSProperties = {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '85vw', height: '85vh', background: 'white', borderRadius: '1rem',
    padding: '2rem', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '1rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
};

const detailModalStyle: CSSProperties = {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '400px', maxWidth: '90vw', background: 'white', borderRadius: '0.75rem',
    padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
};

const headerStyle: CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'
};

const triggerButtonStyle: CSSProperties = {
    padding: '0.6rem 1.2rem', borderRadius: '0.5rem', background: '#3b82f6',
    color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer',
    fontSize: '0.9rem'
};

const navIconStyle: CSSProperties = {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
    width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const closeButtonStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem'
};

const gridStyle: CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gap: '1px', background: '#e2e8f0', border: '1px solid #e2e8f0'
};

const dayHeaderStyle: CSSProperties = {
    background: '#f8fafc', padding: '1rem', textAlign: 'center', fontWeight: 600, color: '#64748b'
};

const cellStyle: CSSProperties = {
    background: 'white', padding: '0.5rem', minHeight: '100px', display: 'flex', flexDirection: 'column'
};

const sessionBadgeStyle: CSSProperties = {
    border: '1px solid', borderRadius: '0.25rem', padding: '0.3rem 0.4rem', fontSize: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.1rem', width: '100%'
};

const detailItemStyle: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: '0.2rem'
};

const detailLabelStyle: CSSProperties = {
    fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em'
};

const actionButtonStyle: CSSProperties = {
    flex: 1, textAlign: 'center', padding: '0.5rem', borderRadius: '0.375rem',
    fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none',
    background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0'
};

const statusBadgeStyle = (status: string): CSSProperties => ({
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: status === 'COMPLETED' ? '#16a34a' : status === 'SCHEDULED' ? '#2563eb' : '#94a3b8',
    background: status === 'COMPLETED' ? '#dcfce7' : status === 'SCHEDULED' ? '#eff6ff' : '#f1f5f9',
});
