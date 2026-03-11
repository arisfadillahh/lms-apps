'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths } from 'date-fns';
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

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function CalendarModal({ sessions, children, triggerClassName, triggerText }: CalendarModalProps) {
    const [open, setOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const today = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
        calendarDays.push(day);
        day = addDays(day, 1);
    }

    // Map sessions by date key
    const sessionsByDate = new Map<string, Session[]>();
    sessions.forEach(s => {
        const key = format(new Date(s.date_time), 'yyyy-MM-dd');
        if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
        sessionsByDate.get(key)!.push(s);
    });

    const selectedKey = format(selectedDate, 'yyyy-MM-dd');
    const selectedSessions = sessionsByDate.get(selectedKey) || [];
    const activeSessions = selectedSessions.filter(s => s.status !== 'CANCELLED');
    const cancelledSessions = selectedSessions.filter(s => s.status === 'CANCELLED');

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                {children || (
                    <button className={triggerClassName ?? 'px-4 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 text-sm hover:bg-slate-50 transition-all'}>
                        {triggerText ?? 'Buka Kalender'}
                    </button>
                )}
            </Dialog.Trigger>

            <Dialog.Portal>
                {/* Backdrop */}
                <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md" />

                {/* Modal */}
                <Dialog.Content className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
                    <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 pointer-events-auto">

                        {/* Header */}
                        <header className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                            <div>
                                <Dialog.Title asChild>
                                    <h2 className="text-xl font-bold text-slate-900">Jadwal Bulanan</h2>
                                </Dialog.Title>
                                <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
                                    <span className="material-symbols-outlined text-sm" style={{ fontSize: '14px' }}>event</span>
                                    <span className="text-sm font-medium">{format(currentMonth, 'MMMM yyyy', { locale: localeId })}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Month nav */}
                                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                                        className="p-2 hover:bg-white rounded-md transition-all text-slate-600"
                                    >
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                    <span className="px-4 font-semibold text-slate-700 text-sm min-w-[120px] text-center">
                                        {format(currentMonth, 'MMMM yyyy', { locale: localeId })}
                                    </span>
                                    <button
                                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                        className="p-2 hover:bg-white rounded-md transition-all text-slate-600"
                                    >
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                </div>

                                {/* Close */}
                                <Dialog.Close asChild>
                                    <button className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </Dialog.Close>
                            </div>
                        </header>

                        {/* Content = Calendar + Sidebar */}
                        <div className="flex flex-1 overflow-hidden">

                            {/* Calendar Grid */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                {/* Day headers */}
                                <div className="grid grid-cols-7 mb-2">
                                    {DAY_HEADERS.map((d, i) => (
                                        <div
                                            key={d}
                                            className={`text-center text-[11px] font-bold uppercase tracking-wider py-2 ${i === 6 ? 'text-orange-400' : 'text-slate-400'}`}
                                        >
                                            {d}
                                        </div>
                                    ))}
                                </div>

                                {/* Day cells */}
                                <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100 shadow-inner">
                                    {calendarDays.map((date, i) => {
                                        const dateKey = format(date, 'yyyy-MM-dd');
                                        const daySessions = sessionsByDate.get(dateKey) || [];
                                        const isCurrentMonth = isSameMonth(date, monthStart);
                                        const isToday = isSameDay(date, today);
                                        const isSelected = isSameDay(date, selectedDate);
                                        const hasCompleted = daySessions.some(s => s.status === 'COMPLETED');
                                        const hasScheduled = daySessions.some(s => s.status === 'SCHEDULED');
                                        const hasCancelled = daySessions.some(s => s.status === 'CANCELLED');

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setSelectedDate(date)}
                                                className={`
                                                    relative h-28 p-3 flex flex-col cursor-pointer transition-colors
                                                    ${!isCurrentMonth ? 'bg-slate-50 text-slate-300' : 'bg-white hover:bg-slate-50'}
                                                    ${isSelected ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-50 hover:bg-emerald-50 z-10' : ''}
                                                `}
                                            >
                                                {/* Date number */}
                                                <div className="flex justify-between items-start">
                                                    <span className={`
                                                        flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold
                                                        ${isToday ? 'bg-emerald-500 text-white font-bold' : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}
                                                    `}>
                                                        {format(date, 'd')}
                                                    </span>
                                                </div>

                                                {/* Dot indicators at bottom */}
                                                {daySessions.length > 0 && (
                                                    <div className="mt-auto flex gap-1">
                                                        {hasCompleted && <div className="size-1.5 rounded-full bg-emerald-500" />}
                                                        {hasScheduled && <div className="size-1.5 rounded-full bg-blue-500" />}
                                                        {hasCancelled && <div className="size-1.5 rounded-full bg-red-400" />}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Sidebar — Selected Day Sessions */}
                            <aside className="w-72 bg-slate-50 border-l border-slate-100 p-5 flex flex-col gap-5 overflow-y-auto">
                                <div>
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                        Detail Sesi — {format(selectedDate, 'd MMM', { locale: localeId })}
                                    </h3>

                                    {selectedSessions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-center">
                                            <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">event_busy</span>
                                            <p className="text-sm text-slate-400 font-medium">Tidak ada sesi</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4">
                                            {/* Active Sessions */}
                                            {activeSessions.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                                                        Sesi Aktif ({activeSessions.length})
                                                    </p>
                                                    <div className="flex flex-col gap-2">
                                                        {activeSessions.map(s => {
                                                            const isCompleted = s.status === 'COMPLETED';
                                                            return(
                                                            <a
                                                                key={s.id}
                                                                href={`/coach/sessions/${s.id}/attendance`}
                                                                className={`p-3 rounded-xl bg-white border-l-4 shadow-sm hover:shadow-md transition-shadow block ${isCompleted ? 'border-emerald-500' : 'border-blue-500'}`}
                                                            >
                                                                <span className={`text-[10px] font-bold uppercase ${isCompleted ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                                    {format(new Date(s.date_time), 'HH:mm')}
                                                                    {isCompleted ? ' · Selesai' : ' · Terjadwal'}
                                                                </span>
                                                                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{s.class_name ?? 'Kelas'}</h4>
                                                                {s.lesson && (
                                                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{s.lesson.title}</p>
                                                                )}
                                                                <div className="flex gap-1.5 mt-2">
                                                                    {s.lesson?.slide_url && (
                                                                        <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                            <span className="material-symbols-outlined text-xs" style={{ fontSize: '11px' }}>slideshow</span>
                                                                            Slide
                                                                        </span>
                                                                    )}
                                                                    {s.lesson?.example_url && (
                                                                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                            <span className="material-symbols-outlined text-xs" style={{ fontSize: '11px' }}>sports_esports</span>
                                                                            Game
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </a>
                                                        )})}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Cancelled Sessions */}
                                            {cancelledSessions.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                                                        Sesi Libur/Batal ({cancelledSessions.length})
                                                    </p>
                                                    <div className="flex flex-col gap-2">
                                                        {cancelledSessions.map(s => (
                                                            <div
                                                                key={s.id}
                                                                className="p-3 rounded-xl bg-slate-100/60 border-l-4 border-red-300 opacity-80"
                                                            >
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                                        {format(new Date(s.date_time), 'HH:mm')}
                                                                    </span>
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">LIBUR</span>
                                                                </div>
                                                                <h4 className="text-sm font-bold text-slate-400 line-through">{s.class_name ?? 'Kelas'}</h4>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </aside>
                        </div>

                        {/* Footer Legend */}
                        <footer className="px-8 py-4 bg-white border-t border-slate-100 flex items-center gap-6">
                            <div className="flex items-center gap-1.5">
                                <div className="size-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-medium text-slate-600">Selesai</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="size-2 rounded-full bg-blue-500" />
                                <span className="text-xs font-medium text-slate-600">Terjadwal</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="size-2 rounded-full bg-red-400" />
                                <span className="text-xs font-medium text-slate-600">Libur/Batal</span>
                            </div>
                            <div className="ml-auto text-xs text-slate-400">
                                Klik tanggal untuk melihat detail sesi
                            </div>
                        </footer>

                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
