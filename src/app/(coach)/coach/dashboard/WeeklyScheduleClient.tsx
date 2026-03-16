'use client';

import { useState } from 'react';
import { format, addDays, isSameDay, startOfWeek, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface Session {
    id: string;
    class_name?: string;
    date_time: string;
    class_id: string;
}

interface ClassData {
    classId: string;
    studentsCount?: number;
}

interface WeeklyScheduleProps {
    sessions: Session[];
    classes: ClassData[];
}

export default function WeeklyScheduleClient({ sessions, classes }: WeeklyScheduleProps) {
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    
    // State to track date shifting (in days)
    const [dayOffset, setDayOffset] = useState(0);
    // Selected specific date
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    // Animation direction
    const [direction, setDirection] = useState(0);

    // Calculate the anchor date for the visible 5 days
    const currentAnchorDate = addDays(startOfCurrentWeek, dayOffset);

    const shiftForward = () => {
        setDirection(1);
        setDayOffset(prev => prev + 1);
    };

    const shiftBackward = () => {
        setDirection(-1);
        setDayOffset(prev => prev - 1);
    };

    // Filter sessions matching exactly the currently selected day
    const daySessions = sessions
        .filter(s => isSameDay(new Date(s.date_time), selectedDate))
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 50 : -50,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (dir: number) => ({
            zIndex: 0,
            x: dir < 0 ? 50 : -50,
            opacity: 0
        })
    };

    return (
        <div className="p-5 flex flex-col min-h-0">
            {/* Navigation and Date Slider */}
            <div className="flex items-center justify-between mb-6">
                <button 
                    onClick={shiftBackward}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                    title="Hari Sebelumnya"
                >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                
                <div className="relative overflow-hidden w-full mx-2 flex-1 flex justify-center h-16">
                    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                        <motion.div
                            key={dayOffset} // Triggers animation when offset changes
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                            className="absolute flex w-full justify-between items-center px-1"
                        >
                            {[0, 1, 2, 3, 4].map((offset) => {
                                const date = addDays(currentAnchorDate, offset);
                                const isSelected = isSameDay(date, selectedDate);
                                // Get first letter of the day name (e.g., S, S, R, K, J, S, M)
                                const dayLabel = format(date, 'EEEEE', { locale: localeId }).toUpperCase();

                                return (
                                    <div key={date.toISOString()} className="cursor-pointer group text-center flex-1" onClick={() => setSelectedDate(date)}>
                                        <p className={`text-[10px] font-bold mb-2 transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>{dayLabel}</p>
                                        <div className="flex justify-center">
                                            <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isSelected ? 'text-xs font-extrabold bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-xs font-bold hover:bg-slate-100/80 hover:shadow-sm'}`}>
                                                {format(date, 'd')}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <button 
                    onClick={shiftForward}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                    title="Hari Berikutnya"
                >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
            </div>

            {/* Sessions List */}
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                {daySessions.slice(0, 3).length > 0 ? daySessions.slice(0, 3).map((s, i) => {
                    const classInfo = classes.find(c => c.classId === s.class_id);
                    const studentCount = classInfo?.studentsCount || 0;

                    return (
                        <div key={s.id} className="flex gap-4">
                            <div className="text-right w-12 shrink-0">
                                <p className="text-xs font-extrabold text-brand-deep">{format(new Date(s.date_time), 'HH:mm')}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(s.date_time), 'a')}</p>
                            </div>
                            <div className={`flex-grow p-4 border-l-4 rounded-r-2xl ${i === 0 ? 'bg-emerald-50 border-emerald-500' : i === 1 ? 'bg-slate-50 border-slate-300' : 'bg-blue-50 border-blue-400'}`}>
                                <h5 className="text-xs font-bold text-brand-deep">{s.class_name}</h5>
                                <p className="text-[10px] text-slate-500 font-medium mt-1">Platform: Zoom • {studentCount} Siswa</p>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-8 text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-slate-300" style={{ fontSize: '32px' }}>event_busy</span>
                        Tidak ada sesi pada hari ini.
                    </div>
                )}
            </div>
        </div>
    );
}
