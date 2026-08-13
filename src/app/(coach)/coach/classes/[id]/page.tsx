import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, sessionsDao, coderProgressDao, usersDao } from '@/lib/dao';
import type { ExtendedSession } from '@/lib/services/coach';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';
import type { EnrollmentRecord } from '@/lib/dao/classesDao';

export const dynamic = 'force-dynamic';

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function ClassDetailPage({ params }: PageProps) {
    const session = await getSessionOrThrow();
    const resolvedParams = await params;
    const classIdParam = decodeURIComponent(resolvedParams.id ?? '').trim();

    if (!classIdParam || !isValidUuid(classIdParam)) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
                <p style={{ color: '#64748b', fontSize: '1.25rem', marginBottom: '1rem' }}>Invalid class ID.</p>
                <Link href="/coach/dashboard" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>← Kembali ke Dashboard</Link>
            </div>
        );
    }

    const classRecord = await classesDao.getClassById(classIdParam);

    if (!classRecord) {
        notFound();
    }

    // Verify ownership or substitute access
    const substituteSessions = await sessionsDao.listSubstituteSessionsForCoach(classIdParam, session.user.id);
    const isMainCoach = classRecord.coach_id === session.user.id;
    const isSubstitute = substituteSessions.length > 0;

    if (!isMainCoach && !isSubstitute) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem' }}>Akses Ditolak</h1>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Anda tidak memiliki akses ke kelas ini.</p>
                <Link href="/coach/dashboard" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>← Kembali ke Dashboard</Link>
            </div>
        );
    }

    const allowedSessionIds = !isMainCoach && isSubstitute ? substituteSessions.map((s) => s.id) : undefined;

    const classBlocks = await classesDao.getClassBlocks(classIdParam);
    const allSessions = await sessionsDao.listSessionsByClass(classIdParam);
    const enrollments = await classesDao.listEnrollmentsByClass(classIdParam);
    const coders = await usersDao.getUsersByIds(enrollments.map((e) => e.coder_id));
    const coderMap = new Map(coders.map((c) => [c.id, c.full_name]));

    // Focus only on allowed substitute sessions if applicable, otherwise all active sessions
    let sessions = allSessions;
    if (allowedSessionIds) {
        sessions = sessions.filter((s) => allowedSessionIds.includes(s.id));
    }

    // Compute schedule
    const isEkskulClass = classRecord.type === 'EKSKUL';
    const ekskulLessonPlanId =
        (classRecord as { ekskul_lesson_plan_id?: string | null }).ekskul_lesson_plan_id ?? null;
    const lessonSchedule = await computeLessonSchedule(classIdParam, classRecord.level_id, ekskulLessonPlanId);
    let nextSession = null;
    const now = new Date();
    const scheduledSessions = isEkskulClass
        ? sessions.filter((sessionItem) => lessonSchedule.has(sessionItem.id))
        : sessions;
    const sortedSessions = scheduledSessions
        .filter((s: ExtendedSession) => s.status !== 'CANCELLED')
        .sort((a: ExtendedSession, b: ExtendedSession) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    nextSession = sortedSessions.find((s: ExtendedSession) => new Date(s.date_time) >= now && s.status !== 'COMPLETED');
    const displayNextSession = nextSession || sortedSessions[sortedSessions.length - 1]; // Fallback to last session if all finished

    const nextSessionLessonTemplate = displayNextSession
        ? lessonSchedule.get(displayNextSession.id)?.lessonTemplate ?? null
        : null;

    const currentBlockDisplay = classBlocks.find((b) => b.status === 'CURRENT') || classBlocks[0];

    // ... Coder Progress Calculations ...
    const codersWithProgress = await Promise.all(
        enrollments.map(async (enrollment: EnrollmentRecord) => {
            const journey = classRecord.level_id ? await coderProgressDao.getCoderJourney(enrollment.coder_id, classRecord.level_id) : [];
            const completedBlocks = journey.filter((j) => j.status === 'COMPLETED').length;
            const totalBlocks = classBlocks.length;
            const percentage = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;
            return {
                coder_id: enrollment.coder_id,
                coder_name: coderMap.get(enrollment.coder_id) ?? 'Unknown',
                progressPercentage: percentage,
            };
        })
    );

    // Time helper — used to determine if a session is past/today for the Presensi button
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    // Compute unlocked sessions logic:
    // Display all sessions so that past sessions are visible and their attendance can be updated.
    // Show the next 12 upcoming sessions (starting from the next one)
    const nextSessionIndex = sortedSessions.findIndex(s => s.id === nextSession?.id);
    const focusIndex = nextSessionIndex >= 0 ? nextSessionIndex : sortedSessions.length;
    // Take up to 12 sessions from the next one forward
    const upcomingSessions = sortedSessions.slice(focusIndex, focusIndex + 12);
    // Past sessions (completed/before next) — for presensi access, most recent first
    const pastSessions = sortedSessions.slice(0, focusIndex).reverse();

    return (
        <div className="coach-class-page" style={{ fontFamily: "'Inter', sans-serif", margin: '0 -2rem', paddingBottom: '2rem' }}>
            {/* Main Content Area */}
            <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>

                {/* Hero Mission Control */}
                <section style={{ backgroundColor: '#1e293b', backgroundImage: 'radial-gradient(circle at top right, #334155, #0f172a 70%)', color: 'white', paddingTop: '1.5rem', paddingBottom: '6rem', paddingLeft: '2rem', paddingRight: '2rem' }}>
                    <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
                        <nav style={{ display: 'flex', marginBottom: '2rem' }}>
                            <Link href="/coach/dashboard" style={{ display: 'flex', alignItems: 'center', color: '#e2e8f0', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, gap: '0.5rem', transition: 'color 0.2s' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
                                Back to Dashboard
                            </Link>
                        </nav>

                        <div className="flex flex-col gap-8 lg:flex-row lg:justify-between lg:items-start">

                            {/* Left Hero */}
                            <div style={{ flex: 1, marginTop: '2rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                    <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', padding: '0.35rem 0.75rem', borderRadius: '0.25rem', border: '1px solid rgba(16, 185, 129, 0.4)', textTransform: 'uppercase' }}>
                                        {classRecord.type}
                                    </span>
                                    {isSubstitute && (
                                        <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', padding: '0.35rem 0.75rem', borderRadius: '0.25rem', border: '1px solid rgba(239, 68, 68, 0.4)', textTransform: 'uppercase' }}>
                                            SUBSTITUTE COACH
                                        </span>
                                    )}
                                    {displayNextSession && (
                                        <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', padding: '0.35rem 0.75rem', borderRadius: '0.25rem', border: '1px solid rgba(59, 130, 246, 0.3)', textTransform: 'uppercase' }}>
                                            {formatDateShort(displayNextSession.date_time).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                <h2 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, margin: 0, letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                                    {classRecord.name}
                                </h2>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '2rem', color: '#cbd5e1' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="material-symbols-outlined cursor-default" style={{ color: '#10b981', fontSize: '1.25rem' }}>location_on</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{classRecord.zoom_link ? 'Online (Zoom Zoom)' : 'Offline / TBD'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="material-symbols-outlined cursor-default" style={{ color: '#10b981', fontSize: '1.25rem' }}>group</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{enrollments.length} Active Coders</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Hero (Next Session Card) */}
                            {displayNextSession && (
                                <div style={{ width: '100%', maxWidth: '22rem', backgroundColor: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(16px)', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            {displayNextSession.status === 'COMPLETED' ? 'Sesi Terakhir' : 'Sesi Berikutnya'}
                                        </span>
                                        {displayNextSession.status !== 'COMPLETED' && (
                                            <span style={{ backgroundColor: '#f97316', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '9999px', letterSpacing: '0.05em' }}>
                                                LIVE SOON
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                            {formatTimeOnly(displayNextSession.date_time)}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 500, marginTop: '0.25rem' }}>
                                            {formatDateLong(displayNextSession.date_time)}
                                        </div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '1rem' }}>
                                            {nextSessionLessonTemplate?.title || currentBlockDisplay?.block_name || 'Pembelajaran'}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
                                        <Link href={`/coach/sessions/${displayNextSession.id}/attendance`} className="active:scale-95 transition-transform" style={{ backgroundColor: '#10b981', color: 'white', fontWeight: 700, fontSize: '0.9rem', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>adjust</span>
                                            {displayNextSession.status === 'COMPLETED' ? 'Lihat/Edit Presensi' : 'Presensi & Mulai Kelas'}
                                        </Link>

                                        {nextSessionLessonTemplate?.slide_url && (
                                            <a href={nextSessionLessonTemplate.slide_url} target="_blank" rel="noopener noreferrer" className="hover:bg-white/10 transition-colors" style={{ border: '1px solid rgba(255, 255, 255, 0.2)', backgroundColor: 'transparent', color: 'white', fontWeight: 700, fontSize: '0.9rem', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>slideshow</span>
                                                Lihat Slide
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </section>

                {/* Student Progress Monitor */}
                <section style={{ padding: '0 2rem', marginTop: '-4rem', position: 'relative', zIndex: 10 }}>
                    <div style={{ maxWidth: '80rem', margin: '0 auto', backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>

                        <div style={{ padding: '1.5rem 1.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>monitoring</span>
                                <h3 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.25rem', margin: 0 }}>Monitor Progress Siswa</h3>
                            </div>
                            <button style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 700, border: 'none', background: 'transparent', cursor: 'pointer' }}>Lihat Semua Siswa</button>
                        </div>

                        <div style={{ display: 'flex', overflowX: 'auto', padding: '0.5rem 1.5rem 2rem', gap: '1.5rem', scrollbarWidth: 'none' }} className="scrollbar-hide">
                            {codersWithProgress.length === 0 ? (
                                <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', width: '100%' }}>Belum ada siswa di kelas ini.</p>
                            ) : (
                                codersWithProgress.map((coder) => (
                                    <div key={coder.coder_id} style={{ flexShrink: 0, width: '12rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                        <div style={{ width: '4rem', height: '4rem', borderRadius: '9999px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem' }}>
                                            {coder.coder_name.charAt(0).toUpperCase()}
                                        </div>
                                        <p style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                                            {coder.coder_name}
                                        </p>
                                        <div style={{ width: '100%', backgroundColor: '#f1f5f9', height: '0.375rem', borderRadius: '9999px', marginTop: '0.75rem', marginBottom: '0.25rem', overflow: 'hidden' }}>
                                            <div style={{ backgroundColor: coder.progressPercentage === 100 ? '#10b981' : coder.progressPercentage > 0 ? '#10b981' : '#f1f5f9', height: '100%', borderRadius: '9999px', width: `${coder.progressPercentage}%` }}></div>
                                        </div>
                                        <p style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>
                                            {coder.progressPercentage}% COMPLETE
                                        </p>
                                        <button className="hover:bg-slate-50 hover:border-slate-300 transition-all" style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', backgroundColor: 'transparent', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                            Buka Profil
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Scrollbar Indicator (Visual only mimic) */}
                        <div style={{ margin: '0 1.5rem 1rem', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '60%', backgroundColor: '#cbd5e1', borderRadius: '2px' }}></div>
                        </div>

                    </div>
                </section>

                {/* ═══════ Lesson Plan: Block Grouped Cards ═══════ */}
                <section style={{ padding: '3rem 2rem' }}>
                    <div style={{ maxWidth: '80rem', margin: '0 auto' }}>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Lesson Plan</h3>
                                <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>Eksplorasi kurikulum per blok proyek</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {upcomingSessions.length === 0 && (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>Tidak ada sesi mendatang.</p>
                                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Semua sesi telah selesai.</p>
                                </div>
                            )}
                            {upcomingSessions.map((sessionInfo) => {
                                const lessonSlot = lessonSchedule.get(sessionInfo.id);
                                const template = lessonSlot?.lessonTemplate;

                                const templateTitle = template?.title || 'Belum ada materi';
                                const totalParts = lessonSlot?.totalParts ?? 1;
                                const partIndex = lessonSlot?.partNumber ?? 1;
                                const partLabel = totalParts > 1 ? ` (Part ${partIndex})` : '';
                                const lessonTitle = `${templateTitle}${partLabel}`;

                                const isCompleted = sessionInfo.status === 'COMPLETED';
                                const isCancelled = sessionInfo.status === 'CANCELLED';
                                const isNext = displayNextSession && sessionInfo.id === displayNextSession.id && !isCompleted;

                                const sessDate = new Date(sessionInfo.date_time);
                                const isAllowed = !isSubstitute || (allowedSessionIds?.includes(sessionInfo.id));
                                const showPresensi = (sessDate <= todayEnd || isCompleted) && !isCancelled && isAllowed;
                                const showDetail = !!template && !isCancelled && isAllowed;

                                return (
                                    <div
                                        key={sessionInfo.id}
                                        style={{
                                            backgroundColor: isNext ? '#f0fdf9' : 'white',
                                            borderRadius: '1rem',
                                            border: isNext ? '2px solid #10b981' : '1px solid #e2e8f0',
                                            padding: '1.5rem',
                                            boxShadow: isNext ? '0 4px 6px -1px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
                                            opacity: isCancelled ? 0.45 : isCompleted ? 0.75 : 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            position: 'relative',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <span className="material-symbols-outlined" style={{
                                                fontSize: '1.5rem',
                                                color: isCompleted ? '#10b981' : isCancelled ? '#94a3b8' : '#3b82f6'
                                            }}>
                                                {isCompleted ? 'check_circle' : isCancelled ? 'cancel' : 'menu_book'}
                                            </span>
                                            {isNext && (
                                                <span style={{ backgroundColor: '#10b981', color: 'white', fontSize: '10px', fontWeight: 800, padding: '0.25rem 0.5rem', borderRadius: '4px' }}>NEXT SESSION</span>
                                            )}
                                        </div>

                                        <h5 style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.125rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                            {lessonTitle}
                                        </h5>

                                        <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '0.875rem' }}>calendar_today</span>
                                            {formatDateShort(sessionInfo.date_time)}
                                        </p>

                                        <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                                            {!isCancelled ? (
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {showDetail && (
                                                        <Link
                                                            href={`/coach/lesson/${template!.id}?classId=${classIdParam}&sessionId=${sessionInfo.id}`}
                                                            style={{ flex: 1, textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: '#475569', padding: '0.625rem 0', borderRadius: '0.75rem', textDecoration: 'none', border: '1px solid #e2e8f0', backgroundColor: 'white' }}
                                                        >
                                                            Detail
                                                        </Link>
                                                    )}
                                                    {showPresensi && (
                                                        <Link
                                                            href={`/coach/sessions/${sessionInfo.id}/attendance`}
                                                            style={{ flex: 1, textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'white', backgroundColor: '#1e293b', padding: '0.625rem 0', borderRadius: '0.75rem', textDecoration: 'none' }}
                                                        >
                                                            Presensi
                                                        </Link>
                                                    )}
                                                </div>
                                            ) : (
                                                <button disabled style={{ width: '100%', padding: '0.625rem 0', backgroundColor: '#f1f5f9', color: '#94a3b8', borderRadius: '0.75rem', border: 'none', fontWeight: 700, fontSize: '0.875rem', cursor: 'not-allowed' }}>
                                                    Cancelled
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Past Sessions — collapsed by default, for presensi access */}
                        {pastSessions.length > 0 && (
                            <details style={{ marginTop: '2rem' }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, color: '#64748b', padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>history</span>
                                    {pastSessions.length} Sesi Lampau — Klik untuk akses presensi
                                </summary>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                                    {pastSessions.map(s => {
                                        const isAllowed = !isSubstitute || (allowedSessionIds?.includes(s.id));
                                        if (!isAllowed) return null;
                                        const slot = lessonSchedule.get(s.id);
                                        const title = slot?.lessonTemplate?.title || 'Tidak ada materi';
                                        return (
                                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>{title}</p>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{formatDateShort(s.date_time)}</p>
                                                </div>
                                                <Link href={`/coach/sessions/${s.id}/attendance`}
                                                    style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', backgroundColor: '#475569', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                                    Lihat Presensi
                                                </Link>
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                        )}
                    </div>
                </section>

            </main>
        </div>
    );
}

// Helper formatting functions
function formatDateShort(dateString: string) {
    const d = new Date(dateString);
    const idDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const idMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const hr = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');

    return `${idDays[d.getDay()]}, ${d.getDate()} ${idMonths[d.getMonth()]} ${d.getFullYear()} • ${hr}:${min} WIB`;
}

function formatDateLong(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeOnly(dateString: string) {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function isValidUuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
