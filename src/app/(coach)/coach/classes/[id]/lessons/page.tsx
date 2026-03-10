import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { classLessonsDao, classesDao, lessonTemplatesDao, sessionsDao, coderProgressDao, usersDao } from '@/lib/dao';
import type { ExtendedSession } from '@/lib/services/coach';
import type { EnrollmentRecord } from '@/lib/dao/classesDao';
import type { ClassLessonWithTemplate } from '@/lib/dao/classLessonsDao';
import type { CoderClassProgress } from '@/lib/services/coder';

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ block?: string }>;
};

export default async function AllLessonsPage({ params, searchParams }: PageProps) {
    const session = await getSessionOrThrow();
    const resolvedParams = await params;
    const resolvedSearch = await searchParams;
    const classIdParam = decodeURIComponent(resolvedParams.id ?? '').trim();
    const blockIdParam = resolvedSearch.block ?? null;

    if (!classIdParam || !isValidUuid(classIdParam)) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
                <p style={{ color: '#64748b', fontSize: '1.25rem', marginBottom: '1rem' }}>Invalid class ID.</p>
                <Link href="/coach/dashboard" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>← Kembali ke Dashboard</Link>
            </div>
        );
    }

    const classRecord = await classesDao.getClassById(classIdParam);

    if (!classRecord || classRecord.coach_id !== session.user.id) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Class not found</h1>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>You are not assigned to this class.</p>
                <Link href="/coach/dashboard" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>← Kembali ke Dashboard</Link>
            </div>
        );
    }

    const classBlocks = await classesDao.getClassBlocks(classIdParam);
    const sessions = await sessionsDao.listSessionsByClass(classIdParam);
    const enrollments = await classesDao.listEnrollmentsByClass(classIdParam);
    const coders = await usersDao.getUsersByIds(enrollments.map((e) => e.coder_id));
    const coderMap = new Map(coders.map((c) => [c.id, c.full_name]));

    // Compute schedule
    let nextSession = null;
    const now = new Date();
    const sortedSessions = sessions
        .filter((s: ExtendedSession) => s.status !== 'CANCELLED')
        .sort((a: ExtendedSession, b: ExtendedSession) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    nextSession = sortedSessions.find((s: ExtendedSession) => new Date(s.date_time) >= now && s.status !== 'COMPLETED');
    const displayNextSession = nextSession || sortedSessions[sortedSessions.length - 1]; // Fallback to last session if all finished

    // Map lessons for the Next Session Card (if we need template details)
    let nextSessionLessonTemplate: any = null;
    let fallbackLessonTemplate: any = null;

    const blockLessons = await Promise.all(
        classBlocks.map(async (block) => {
            const [lessons, templateLessons] = await Promise.all([
                classLessonsDao.listLessonsByClassBlock(block.id),
                block.block_id ? lessonTemplatesDao.listLessonsByBlock(block.block_id) : [],
            ]);
            const templateById = new Map(templateLessons.map((template) => [template.id, template]));
            const orderedLessons = lessons.slice().sort((a, b) => a.order_index - b.order_index);
            const lessonsWithTemplate = orderedLessons.map((lesson) => {
                const template = lesson.lesson_template_id ? templateById.get(lesson.lesson_template_id) ?? null : null;
                // Basic matching for Next Session
                if (displayNextSession && lesson.session_id === displayNextSession.id) {
                    nextSessionLessonTemplate = template;
                } else if (!displayNextSession && !fallbackLessonTemplate) {
                    fallbackLessonTemplate = template; // Just pick the first as fallback
                }
                return {
                    lesson,
                    template,
                };
            });
            return {
                block,
                lessons: lessonsWithTemplate,
            };
        }),
    );

    // Filter to specific block if provided
    const filteredBlockLessons = blockIdParam
        ? blockLessons.filter(({ block }) => block.id === blockIdParam)
        : blockLessons;

    const currentBlockDisplay = classBlocks.find(b => b.status === 'CURRENT') || classBlocks[0];

    // Coder Progress Calculations
    // Fetch individual progress to accurately determine completed blocks for each coder.
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


    return (
        <div style={{ fontFamily: "'Inter', sans-serif", margin: '0 -2rem', paddingBottom: '2rem' }}>
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

                {/* Lesson Plan */}
                <section style={{ padding: '3rem 2rem' }}>
                    <div style={{ maxWidth: '80rem', margin: '0 auto' }}>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Lesson Plan</h3>
                                <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage your sessions and curriculum path</p>
                            </div>
                        </div>

                        {filteredBlockLessons.length === 0 ? (
                            <p style={{ color: '#6b7280' }}>Belum ada block yang diinstansiasi.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                                {filteredBlockLessons.map(({ block, lessons }) => (
                                    <div key={block.id}>
                                        <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', display: 'inline-block' }}>
                                            {block.block_name ?? 'Block'} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b', marginLeft: '0.5rem' }}>({block.status})</span>
                                        </h4>

                                        {lessons.length === 0 ? (
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Lesson template belum tersedia.</p>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                                {lessons.map(({ lesson, template }, index) => {
                                                    const session = sessions.find(s => s.id === lesson.session_id);
                                                    const isCompleted = session?.status === 'COMPLETED';
                                                    const isLocked = session === undefined || session?.status === 'CANCELLED';
                                                    const isActive = !isCompleted && !isLocked && (displayNextSession?.id === session?.id);

                                                    const cardBg = isActive ? 'white' : (isCompleted ? 'white' : '#f8fafc');
                                                    const cardBorder = isActive ? '1px solid #e2e8f0' : (isCompleted ? '1px solid #e2e8f0' : '1px solid #e2e8f0');
                                                    const cardBorderLeft = isActive ? '4px solid #10b981' : (isCompleted ? '4px solid #cbd5e1' : '4px solid #e2e8f0');
                                                    const cardShadow = isActive ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                                                    const cardOpacity = isCompleted ? 0.75 : 1;
                                                    const textTitleColor = isLocked ? '#94a3b8' : '#0f172a';

                                                    return (
                                                        <div key={lesson.id} style={{ backgroundColor: cardBg, borderRadius: '1rem', border: cardBorder, borderLeft: cardBorderLeft, padding: '1.5rem', boxShadow: cardShadow, opacity: cardOpacity, display: 'flex', flexDirection: 'column' }}>

                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                                <div style={{ fontSize: '10px', fontWeight: 700, color: isActive ? '#10b981' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
                                                                    Sesi {lesson.order_index} {session ? `• ${formatDateShort(session.date_time)}` : ''}
                                                                </div>
                                                                {isCompleted && <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '1.25rem' }}>check_circle</span>}
                                                                {isLocked && <span className="material-symbols-outlined" style={{ color: '#cbd5e1', fontSize: '1.25rem' }}>lock</span>}
                                                                {isActive && <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '10px', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '9999px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>NEXT</span>}
                                                            </div>

                                                            <h4 style={{ fontWeight: 700, color: textTitleColor, fontSize: '1.125rem', marginBottom: '0.5rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                                {template?.title || lesson.title}
                                                            </h4>

                                                            <div style={{ marginTop: 'auto' }}>
                                                                <span style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '10px', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block' }}>
                                                                    BLOCK {block.block_order_index}
                                                                </span>

                                                                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.5rem' }}>
                                                                    {isLocked ? (
                                                                        <button disabled style={{ width: '100%', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: '#94a3b8', padding: '0.5rem 0', borderRadius: '0.75rem', backgroundColor: 'transparent', border: 'none', cursor: 'not-allowed' }}>
                                                                            Locked
                                                                        </button>
                                                                    ) : isActive && session ? (
                                                                        <>
                                                                            <Link href={`/coach/sessions/${session.id}/attendance`} style={{ flex: 1, textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'white', backgroundColor: '#10b981', padding: '0.625rem 0', borderRadius: '0.75rem', textDecoration: 'none' }}>
                                                                                Presensi
                                                                            </Link>
                                                                            <Link href={`/coach/lesson/${lesson.id}`} style={{ padding: '0 0.75rem', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', textDecoration: 'none' }}>
                                                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>more_vert</span>
                                                                            </Link>
                                                                        </>
                                                                    ) : (
                                                                        <Link href={`/coach/lesson/${lesson.id}`} style={{ width: '100%', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: '#64748b', padding: '0.5rem 0', borderRadius: '0.75rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>
                                                                            Detail Sesi
                                                                        </Link>
                                                                    )}
                                                                </div>
                                                            </div>

                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </section>

            </main>
        </div>
    );
}

// Helper formatting functions
function formatDateShort(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '');
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
