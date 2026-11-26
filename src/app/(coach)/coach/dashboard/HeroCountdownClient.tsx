'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SubstituteBadge from '@/components/coach/SubstituteBadge';
import MitraBadge from '@/components/coach/MitraBadge';
import { format, differenceInSeconds } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { BookOpen, CalendarDays, DoorOpen, Hourglass } from 'lucide-react';

interface LessonInfo {
    title: string;
    slide_url?: string | null;
}

interface NextSessionProps {
    id: string;
    class_name?: string;
    isMitraSession?: boolean;
    isSubstitute?: boolean;
    replacedCoachName?: string;
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

    const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white/5';

    return (
        <div className="@container relative z-10 grid min-w-0 gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-bold text-emerald-200">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-400" />
                    {timeLeft.isLive ? 'Sesi berlangsung' : 'Sesi mendatang'}
                </span>
                <time dateTime={session.date_time} className="inline-flex min-w-0 items-center gap-1.5 text-slate-200">
                    <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                    <span>{format(new Date(session.date_time), "EEEE, dd MMM \u2022 HH:mm 'WIB'", { locale: localeId })}</span>
                </time>
                {!timeLeft.isLive && (
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-300">
                        <span className="inline-flex items-center gap-1.5"><Hourglass size={13} aria-hidden="true" /> Mulai dalam</span>
                        <strong className="tabular-nums text-white">
                            {timeLeft.days > 0 ? `${String(timeLeft.days).padStart(2, '0')}d ` : ''}
                            {String(timeLeft.hours).padStart(2, '0')}h{' '}
                            {String(timeLeft.minutes).padStart(2, '0')}m{' '}
                            {String(timeLeft.seconds).padStart(2, '0')}s
                        </strong>
                    </span>
                )}
            </div>
            <div className="grid min-w-0 gap-3 @min-[32rem]:flex @min-[32rem]:flex-wrap @min-[32rem]:items-end @min-[32rem]:justify-between">
                <div className="min-w-0 @min-[32rem]:flex-[1_1_12rem]">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        <h2 className="min-w-0 wrap-anywhere text-xl font-extrabold leading-tight tracking-tight @min-[32rem]:text-2xl">{session.class_name}</h2>
                        {(session.isMitraSession || session.isSubstitute) && (
                            <div className="flex min-w-0 flex-wrap items-center gap-2 wrap-anywhere [&>*]:my-0 [&_svg]:shrink-0 @max-[22rem]:[&_span[aria-hidden=true]]:hidden">
                                {session.isMitraSession && <MitraBadge />}
                                {session.isSubstitute && <SubstituteBadge coachName={session.replacedCoachName} />}
                            </div>
                        )}
                    </div>
                    {session.lesson && (
                        <p className="mt-1 wrap-anywhere text-sm leading-snug text-slate-200">
                            <span className="mr-1.5 font-semibold text-emerald-200">Materi</span>
                            {session.lesson.title}
                        </p>
                    )}
                </div>
                <div className="grid max-w-full grid-cols-[repeat(auto-fit,minmax(min(100%,7.75rem),1fr))] gap-2 @min-[25rem]:flex @min-[25rem]:flex-wrap">
                    {timeLeft.isZoomActive ? (
                        <Link href={`/coach/sessions/${session.id}/attendance`} className={actionClass}>
                            <DoorOpen size={16} aria-hidden="true" /> Buka Kelas
                        </Link>
                    ) : (
                        <button type="button" disabled title="Tersedia saat 30 menit sebelum kelas" className={actionClass}>
                            <DoorOpen size={16} aria-hidden="true" /> Buka Kelas
                        </button>
                    )}
                    {session.lesson?.slide_url && (
                        <a href={session.lesson.slide_url} target="_blank" rel="noreferrer" className={actionClass}>
                            <BookOpen size={16} aria-hidden="true" /> Buka Modul
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
