'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, differenceInSeconds } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface LessonInfo {
    title: string;
    slide_url?: string | null;
}

interface NextSessionProps {
    id: string;
    class_name?: string;
    date_time: string;
    lesson?: LessonInfo | null;
}

export default function HeroCountdownClient({ session }: { session: NextSessionProps }) {
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isLive: boolean; isZoomActive: boolean }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false, isZoomActive: false });

    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            const sessionDate = new Date(session.date_time);
            const diffSeconds = differenceInSeconds(sessionDate, now);

            if (diffSeconds <= 0 && diffSeconds >= -5400) {
                // Class is within 90 minutes of starting, consider it LIVE
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true, isZoomActive: true });
            } else if (diffSeconds < -5400) {
                // Class is over 90 mins old (should rarely hit this due to page.tsx filter)
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false, isZoomActive: false });
            } else {
                // Class is in the future
                const days = Math.floor(diffSeconds / 86400);
                const hours = Math.floor((diffSeconds % 86400) / 3600);
                const minutes = Math.floor((diffSeconds % 3600) / 60);
                const seconds = diffSeconds % 60;
                setTimeLeft({ days, hours, minutes, seconds, isLive: false, isZoomActive: diffSeconds <= 1800 });
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [session.date_time]);

    return (
        <div className="relative w-full z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-bold text-red-400 uppercase tracking-widest">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        {timeLeft.isLive ? 'LIVE NOW' : 'LIVE SOON'}
                    </span>
                    <div className="h-4 w-px bg-white/10"></div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
                        <span className="material-symbols-outlined text-sm">timer</span>
                        {timeLeft.isLive ? 'Sesi Berlangsung' : 'Sesi Mendatang'}
                    </div>
                </div>
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight mb-2">{session.class_name}</h2>
                    <div className="flex flex-wrap items-center gap-4 mb-3">
                        <p className="text-slate-300 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                            {format(new Date(session.date_time), "EEEE, dd MMMM \u2022 HH:mm 'WIB'", { locale: localeId })}
                        </p>
                        {session.lesson && (
                            <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase">Materi</span>
                                <span className="text-sm font-bold text-white">{session.lesson.title}</span>
                            </div>
                        )}
                    </div>
                    {!timeLeft.isLive && (
                        <div className="inline-flex bg-black/30 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-emerald-400 items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-400 animate-pulse text-sm">hourglass_empty</span>
                            MULAI DALAM
                            <span className="text-white ml-1 text-sm tracking-wider">
                                {timeLeft.days > 0 ? `${String(timeLeft.days).padStart(2, '0')}d ` : ''}
                                {String(timeLeft.hours).padStart(2, '0')}h{' '}
                                {String(timeLeft.minutes).padStart(2, '0')}m{' '}
                                {String(timeLeft.seconds).padStart(2, '0')}s
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-6 md:mt-0 w-full md:w-auto md:ml-auto md:justify-end">
                {timeLeft.isZoomActive ? (
                    <>
                        <Link href={`/coach/sessions/${session.id}/attendance`} className="w-full sm:w-auto justify-center px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white font-extrabold rounded-2xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)] transform hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-95 border border-orange-400/50">
                            <span className="material-symbols-outlined">how_to_reg</span>
                            <span className="hidden sm:inline">Isi Presensi</span>
                        </Link>
                        
                        {/* We use session zoom if needed, but the original logic didn't actually pull zoom_link for zoom button. It was a placeholder? The old link was /coach/sessions/${session.id}/attendance which makes no sense for 'Masuk Zoom'. I will change it to actually link to the class context or generic if zoom_link is missing. */}
                        {/* Wait, the original code had: href={`/coach/sessions/${session.id}/attendance`} with text "Masuk Zoom". Which means the original author mislabeled the button or linked it wrong. I'll fix it here: The Zoom link should open the zoom client or the class detail page. */}
                        <Link href={`/coach/classes/${session.id ?? ''}`} className="w-full sm:w-auto justify-center px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transform hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-95 border border-emerald-400/50 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                            <span className="material-symbols-outlined relative z-10">videocam</span>
                            <span className="relative z-10">Buka Kelas</span>
                        </Link>
                    </>
                ) : (
                    <div className="relative group">
                        <button disabled className="w-full sm:w-auto justify-center px-8 py-4 bg-slate-800/50 text-slate-500 font-bold rounded-2xl border border-slate-700/50 flex items-center gap-2 cursor-not-allowed">
                            <span className="material-symbols-outlined opacity-50">door_front</span>
                            Buka Kelas
                        </button>
                        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-xl whitespace-nowrap shadow-xl border border-slate-700 z-50">
                            Tersedia saat 30 menit sebelum kelas
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-slate-700 rotate-45"></div>
                        </div>
                    </div>
                )}
                {session.lesson?.slide_url && (
                    <a href={session.lesson.slide_url} target="_blank" rel="noreferrer" className="w-full sm:w-auto justify-center px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all flex items-center gap-2 backdrop-blur-sm transform hover:-translate-y-0.5 active:translate-y-0">
                        <span className="material-symbols-outlined">menu_book</span>
                        <span className="hidden sm:inline">Modul</span>
                    </a>
                )}
            </div>
        </div>
    );
}
