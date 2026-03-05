'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle, BookOpen, Calendar, Rocket, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import type { ReactNode } from 'react';

type ClassDetailTriggerProps = {
    classInfo: {
        classId: string;
        className: string;
        classType: string;
        block: any;
        progressPct: number;
        bgColor: string;
        coach?: { name: string; avatarUrl: string | null; whatsappNumber: string | null } | null;
        schedule?: { days: string[]; timeInfo: string | null } | null;
    };
    customTrigger?: ReactNode;
};

export default function ClassDetailTrigger({ classInfo, customTrigger }: ClassDetailTriggerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { classId, className, classType, block, progressPct, bgColor, coach, schedule } = classInfo;

    const icon = classType === 'EKSKUL' ? '🎨' : '💻';
    const displayTitle = classType === 'EKSKUL' ? block?.name || className : className;
    const lessonsList = block?.lessons || [];

    // Formatting schedule string
    let scheduleText = 'Belum Ada Jadwal';
    if (schedule && schedule.days.length > 0) {
        scheduleText = `Setiap ${schedule.days.join(', ')} | Jam ${schedule.timeInfo || '-'}`;
    }

    return (
        <>
            {/* Trigger Card */}
            {customTrigger ? (
                <div onClick={() => setIsOpen(true)} className="cursor-pointer w-full">
                    {customTrigger}
                </div>
            ) : (
                <div
                    onClick={() => setIsOpen(true)}
                    className="rounded-[16px] p-5 transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-lg relative overflow-hidden group border border-transparent hover:border-blue-200"
                    style={{ background: bgColor }}
                >
                    <div className="absolute right-[-1rem] bottom-[-1rem] text-7xl opacity-10 group-hover:scale-110 transition-transform duration-300">
                        {icon}
                    </div>

                    <div className="text-4xl mb-3">{icon}</div>
                    <h3 className="text-base font-bold text-slate-800 m-0 mb-1 z-10 relative pr-4">
                        {displayTitle}
                    </h3>
                    <p className="text-xs text-slate-500 m-0 mb-4 z-10 relative line-clamp-1">
                        {lessonsList.find((l: any) => l.status === 'NEXT')?.title || 'Menunggu jadwal'}
                    </p>

                    {/* Progress bar miniature */}
                    <div className="flex items-center gap-2 mb-2 z-10 relative">
                        <span className="text-[10px] text-slate-500 font-medium">Sesi: {block?.estimatedSessions || 0}</span>
                        <span className="flex-1" />
                        <span className="text-[11px] font-bold text-blue-600">{progressPct}%</span>
                    </div>
                    <div className="h-1.5 bg-black/5 rounded-full overflow-hidden z-10 relative">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                </div>
            )}

            {/* Modal Popup */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.2, type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[2rem] shadow-2xl flex flex-col relative"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 pt-6 pb-5 relative flex flex-col items-center justify-center text-center border-b border-slate-100/50" style={{ backgroundColor: bgColor }}>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="absolute top-4 right-4 p-2 bg-black/5 hover:bg-black/10 text-slate-700 rounded-full transition-colors z-20"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="text-5xl mb-3 transform hover:scale-110 transition-transform duration-300 drop-shadow-sm">
                                    {icon}
                                </div>
                                <h2 className="text-xl font-black tracking-tight text-slate-800 leading-tight mb-2 px-4">
                                    {displayTitle}
                                </h2>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 text-slate-600 text-[11px] font-bold shadow-sm">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>{classType === 'EKSKUL' ? 'Program Ekskul Sekolah' : 'Program Reguler'}</span>
                                </div>
                            </div>

                            {/* Modal Body - Fixed, Internal Scrolling */}
                            <div className="px-6 py-5 flex-1 flex flex-col min-h-0">
                                {/* Progress Details */}
                                <div className="mb-4 flex-none">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Progres Keseluruhan Modul</span>
                                        <span className="text-blue-600 font-bold bg-blue-500/10 px-2.5 py-1 rounded-full text-xs">
                                            {progressPct}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div
                                            className="bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out"
                                            style={{ width: `${progressPct}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Current Content Info */}
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex-1 flex flex-col min-h-0">
                                    <div className="flex-none">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                <PlayCircle className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Sedang Berjalan</span>
                                        </div>
                                        <h4 className="text-[15px] font-bold text-slate-800 mb-1 leading-snug">
                                            {block?.name || 'Materi Belum Tersedia'}
                                        </h4>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex-1 flex flex-col min-h-0">
                                        <div className="flex justify-between items-center mb-3 flex-none text-right">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jadwal Sesi & Materi</p>
                                            </div>
                                            <p className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{scheduleText}</p>
                                        </div>

                                        {/* SCROLLABLE LESSON LIST */}
                                        <div className="space-y-1.5 pl-1 pr-1 pb-1 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                                            {lessonsList.length > 0 ? (
                                                lessonsList.map((lesson: any, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        className={`flex items-center gap-3 p-2.5 rounded-lg border relative ${lesson.status === 'COMPLETED' ? 'bg-green-50/30 border-green-100' :
                                                            lesson.status === 'NEXT' ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100' :
                                                                'bg-white border-slate-100 opacity-75 hover:opacity-100 transition-opacity'
                                                            }`}
                                                    >
                                                        {lesson.status === 'NEXT' && (
                                                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
                                                        )}
                                                        <div>
                                                            {lesson.status === 'COMPLETED' ? (
                                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                            ) : lesson.status === 'NEXT' ? (
                                                                <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center bg-white">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full border-2 border-slate-200 bg-slate-50" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className={`text-[13px] font-semibold truncate ${lesson.status === 'COMPLETED' ? 'text-slate-700' :
                                                                    lesson.status === 'NEXT' ? 'text-blue-800' :
                                                                        'text-slate-500'
                                                                    }`}>
                                                                    {lesson.title}
                                                                </p>
                                                                {lesson.status === 'COMPLETED' && lesson.completedAt && lesson.completedAt.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {lesson.completedAt.map((dateStr: string, i: number) => (
                                                                            <span key={i} className="text-[10px] text-green-600/80 font-medium whitespace-nowrap bg-green-100/50 px-2 py-0.5 rounded-md self-start">
                                                                                {new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {lesson.scheduledAt && lesson.scheduledAt.length > 0 && lesson.status !== 'COMPLETED' && (
                                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                                    {lesson.scheduledAt.map((dateStr: string, i: number) => (
                                                                        <p key={i} className={`text-[10px] font-medium flex items-center gap-1 ${lesson.status === 'NEXT' ? 'text-blue-600/80' : 'text-slate-400'}`}>
                                                                            <Calendar className="w-3 h-3" />
                                                                            {new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} • {new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                                    <p className="text-xs text-slate-500 font-medium">Belum ada daftar materi</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Coach Details (Pinned to bottom of gray box) */}
                                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200/60 flex-none bg-slate-50">
                                        {coach?.avatarUrl ? (
                                            <img src={coach.avatarUrl} alt={coach.name} className="w-9 h-9 rounded-full object-cover border-2 border-slate-200 shadow-sm" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shadow-sm">
                                                {coach?.name ? coach.name.charAt(0).toUpperCase() : '?'}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Coach Pendamping</p>
                                            <p className="text-[13px] font-bold text-slate-700">{coach?.name || 'Belum ada Coach'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-2 mt-4 flex-none">
                                    <Link
                                        href={`/coder/materials`} // Could route specifically if lesson ID available
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25 group"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <span>Mulai Belajar</span>
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence >
        </>
    );
}
