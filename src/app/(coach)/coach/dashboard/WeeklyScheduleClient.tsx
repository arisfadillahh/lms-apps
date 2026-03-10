'use client';

import { useState } from 'react';
import { format, addDays, isSameDay, startOfWeek } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

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
    const [selectedDate, setSelectedDate] = useState<Date>(today);

    // Filter sessions matching exactly the currently selected day
    const daySessions = sessions
        .filter(s => isSameDay(new Date(s.date_time), selectedDate))
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    return (
        <div className="p-5">
            <div className="flex justify-between items-center text-center mb-8">
                {[0, 1, 2, 3, 4].map((offset) => {
                    const date = addDays(startOfCurrentWeek, offset); // Mon - Fri
                    const isSelected = isSameDay(date, selectedDate);

                    let dayLabel = 'S';
                    if (offset === 0) dayLabel = 'S';
                    else if (offset === 1) dayLabel = 'S';
                    else if (offset === 2) dayLabel = 'R';
                    else if (offset === 3) dayLabel = 'K';
                    else if (offset === 4) dayLabel = 'J';

                    return (
                        <div key={offset} className="cursor-pointer group" onClick={() => setSelectedDate(date)}>
                            <p className={`text-[10px] font-bold mb-2 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>{dayLabel}</p>
                            <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isSelected ? 'text-xs font-extrabold bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'text-xs font-bold hover:bg-slate-100/80 hover:shadow-sm'}`}>
                                {format(date, 'd')}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="space-y-6">
                {daySessions.slice(0, 3).length > 0 ? daySessions.slice(0, 3).map((s, i) => {
                    const classInfo = classes.find(c => c.classId === s.class_id);
                    const studentCount = classInfo?.studentsCount || 0;

                    return (
                        <div key={s.id} className="flex gap-4">
                            <div className="text-right w-12 shrink-0">
                                <p className="text-xs font-extrabold text-brand-deep">{format(new Date(s.date_time), 'HH:mm')}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(s.date_time), 'a')}</p>
                            </div>
                            <div className={`flex-grow p-4 border-l-4 rounded-r-2xl ${i === 0 ? 'bg-emerald-50/50 border-emerald-400' : i === 1 ? 'bg-slate-50 border-slate-300' : 'bg-blue-50/50 border-blue-400'}`}>
                                <h5 className="text-xs font-bold text-brand-deep">{s.class_name}</h5>
                                <p className="text-[10px] text-slate-500 font-medium mt-1">Platform: Zoom • {studentCount} Siswa</p>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-4 text-slate-400 font-medium text-xs">
                        Tidak ada sesi pada hari ini.
                    </div>
                )}
            </div>
        </div>
    );
}
