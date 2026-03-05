'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, Palette, Star, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

type UpcomingLesson = {
    title: string;
    status: 'NEXT' | 'UPCOMING' | 'LOCKED';
    scheduledAt?: string[];
    className?: string;
};

type UpcomingLessonsModalProps = {
    lessons: UpcomingLesson[];
};

export default function UpcomingLessonsModal({ lessons }: UpcomingLessonsModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full py-5 rounded-[2.5rem] border-4 border-dashed border-pastel-blue/50 bg-white text-sm font-black text-slate-400 text-center hover:text-sky hover:border-sky/30 hover:bg-pastel-blue/20 transition-all uppercase tracking-widest cursor-pointer"
            >
                Lihat Materi Block Saat Ini
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-clevio-navy/40 backdrop-blur-sm"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border-4 border-white ring-4 ring-sky/10"
                        >
                            {/* Header */}
                            <div className="flex-none p-8 pb-6 border-b-2 border-dashed border-slate-100 flex items-center justify-between bg-pastel-blue/30">
                                <div>
                                    <h3 className="text-2xl font-black text-clevio-navy flex items-center gap-3">
                                        <Star className="text-amber-500" size={24} /> Peta Materi Block Saat Ini
                                    </h3>
                                    <p className="text-sm font-bold text-slate-500 mt-1">
                                        Daftar materi dan jadwal belajar pada block saat ini
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-3 bg-white hover:bg-slate-50 text-slate-400 hover:text-coral rounded-2xl transition-colors shadow-sm"
                                >
                                    <X size={24} strokeWidth={3} />
                                </button>
                            </div>

                            {/* Content / List */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                {lessons.length > 0 ? (
                                    lessons.map((lesson, idx) => {
                                        const isNext = lesson.status === 'NEXT';
                                        const dates = lesson.scheduledAt && lesson.scheduledAt.length > 0
                                            ? lesson.scheduledAt.map(d => format(new Date(d), 'dd MMM yyyy • HH:mm', { locale: idLocale }))
                                            : ['Belum Dijadwalkan'];

                                        const schemes = [
                                            { border: 'border-sky', text: 'text-sky', icon: <Rocket className="text-sky" size={24} strokeWidth={2.5} /> },
                                            { border: 'border-amber-400', text: 'text-amber-600', icon: <Palette className="text-amber-500" size={24} strokeWidth={2.5} /> },
                                            { border: 'border-coral', text: 'text-orange-600', icon: <Star className="text-orange-600" size={24} strokeWidth={2.5} /> },
                                        ];
                                        const scheme = schemes[idx % 3];

                                        return (
                                            <div className="relative flex items-center gap-6" key={`${lesson.title}-${idx}`}>
                                                {/* Icon Badge */}
                                                <div className={`shrink-0 size-20 bg-white border-4 ${scheme.border} rounded-[2rem] z-10 flex items-center justify-center shadow-lg -rotate-6`}>
                                                    {scheme.icon}
                                                </div>

                                                {/* Content Card */}
                                                <div className={`flex-1 bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100/60 ${isNext ? 'shadow-sm bg-white border-slate-200' : 'opacity-80'} transition-all`}>
                                                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                                        <div className="flex flex-wrap gap-2">
                                                            {dates.map((d, i) => (
                                                                <span key={i} className={`text-[11px] font-black ${scheme.text} bg-white px-3 py-1.5 border border-slate-100 rounded-xl uppercase tracking-wider shadow-sm`}>
                                                                    {d}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {lesson.className && (
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-50 rounded-lg">
                                                                {lesson.className}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h5 className="font-black text-clevio-navy text-xl leading-tight mt-3">{lesson.title || 'Materi Belum Berjudul'}</h5>

                                                    {isNext && (
                                                        <div className="mt-3 inline-block px-3 py-1 bg-green-50 border border-green-200 text-clevio-green text-xs font-black rounded-lg uppercase tracking-wider">
                                                            Materi Selanjutnya
                                                        </div>
                                                    )}
                                                    {!isNext && lesson.status === 'LOCKED' && (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-slate-400 mt-4 px-3 py-1.5 bg-slate-100 rounded-xl">
                                                            <Lock size={14} /> MATERI TERKUNCI
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="size-20 mx-auto bg-slate-50 rounded-[2rem] flex items-center justify-center mb-4">
                                            <Star className="text-slate-300" size={32} />
                                        </div>
                                        <p className="text-lg font-black text-slate-600">Belum ada daftar materi</p>
                                        <p className="text-sm font-bold text-slate-400 mt-2">Perjalanan belajarmu akan muncul di sini</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
