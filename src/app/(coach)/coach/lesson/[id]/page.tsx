import { notFound } from 'next/navigation';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { lessonTemplatesDao, blocksDao, classesDao } from '@/lib/dao';
import { splitEkskulLessonMakeUp } from '@/lib/ekskulMakeUpInstructions';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import ReportLessonButton from './ReportLessonButton';

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ classId?: string; sessionId?: string }>;
};

function getSlideEmbedUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('docs.google.com') && parsed.pathname.includes('/presentation/d/')) {
            if (parsed.pathname.includes('/d/e/')) {
                const segments = parsed.pathname.split('/');
                const eIndex = segments.indexOf('e');
                if (eIndex !== -1 && segments[eIndex + 1]) {
                    const presentationId = segments[eIndex + 1];
                    return `https://docs.google.com/presentation/d/e/${presentationId}/embed${parsed.search}`;
                }
            }
            const segments = parsed.pathname.split('/');
            const dIndex = segments.indexOf('d');
            if (dIndex !== -1 && segments[dIndex + 1]) {
                const presentationId = segments[dIndex + 1];
                if (presentationId !== 'e') {
                    return `https://docs.google.com/presentation/d/${presentationId}/embed${parsed.search}`;
                }
            }
        }
    } catch {
        // ignore
    }
    return url.replace('/edit', '/embed');
}

export default async function CoachLessonDetailPage({ params, searchParams }: PageProps) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'COACH');

    const resolvedParams = await params;
    const resolvedSearch = await searchParams;
    const lessonId = resolvedParams.id;

    // classId and sessionId passed from the class detail page via query params
    const classIdFromUrl = resolvedSearch.classId ?? null;
    const sessionIdFromUrl = resolvedSearch.sessionId ?? null;

    let lesson = await lessonTemplatesDao.getLessonTemplateById(lessonId);
    let isEkskulLesson = false;

    if (!lesson && classIdFromUrl) {
        const classRecord = await classesDao.getClassById(classIdFromUrl);
        if (classRecord?.type === 'EKSKUL' && classRecord.ekskul_lesson_plan_id) {
            const supabase = getSupabaseAdmin();
            const { data: ekskulLesson } = await supabase
                .from('ekskul_lessons')
                .select('*')
                .eq('id', lessonId)
                .eq('plan_id', classRecord.ekskul_lesson_plan_id)
                .maybeSingle();

            if (ekskulLesson) {
                const lessonParts = splitEkskulLessonMakeUp(ekskulLesson.summary, ekskulLesson.make_up_instructions);
                isEkskulLesson = true;
                lesson = {
                    id: ekskulLesson.id,
                    block_id: '',
                    title: ekskulLesson.title,
                    summary: lessonParts.summary,
                    slide_url: ekskulLesson.slide_url,
                    example_url: ekskulLesson.example_url,
                    example_storage_path: null,
                    order_index: ekskulLesson.order_index,
                    estimated_meeting_count: ekskulLesson.estimated_meetings,
                    make_up_instructions: lessonParts.makeUpInstructions,
                    created_at: ekskulLesson.created_at,
                    updated_at: ekskulLesson.created_at,
                };
            }
        }
    }

    if (!lesson) {
        notFound();
    }

    const block = lesson.block_id ? await blocksDao.getBlockById(lesson.block_id) : null;

    // Get class name from URL param if provided, otherwise fall back to DB lookup
    let className: string | null = null;
    let sessionId: string | null = sessionIdFromUrl;

    if (classIdFromUrl) {
        const cls = await classesDao.getClassById(classIdFromUrl);
        className = cls?.name ?? null;
    } else {
        // Fallback: find class through class_lessons → class_blocks → classes
        const supabase = getSupabaseAdmin();
        const { data: classLessonRow } = await supabase
            .from('class_lessons')
            .select('class_block_id, class_blocks:class_block_id(class_id, classes:class_id(name))')
            .eq('lesson_template_id', lessonId)
            .limit(1)
            .maybeSingle();
        const classBlock = classLessonRow?.class_blocks as unknown as {
            class_id?: string | null;
            classes?: { name?: string | null } | null;
        } | null;
        const classId: string | null = classBlock?.class_id ?? null;
        className = classBlock?.classes?.name ?? null;

        if (!sessionId && classId) {
            const supabase2 = getSupabaseAdmin();
            // eslint-disable-next-line react-hooks/purity -- This server-only fallback resolves a recent scheduled session.
            const recentSessionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: sessionRow } = await supabase2
                .from('sessions')
                .select('id')
                .eq('class_id', classId)
                .gte('date_time', recentSessionCutoff)
                .order('date_time', { ascending: true })
                .limit(1)
                .maybeSingle();
            sessionId = sessionRow?.id ?? null;
        }
    }

    return (
        <div className="-mx-8 -mt-0 pb-20 font-sans">

            {/* Dark Hero Section */}
            <section
                className="px-8 py-10 lg:py-14 text-white"
                style={{ background: 'linear-gradient(to bottom right, #0f172a, #1e293b)' }}
            >
                <div className="max-w-6xl mx-auto">
                    {/* Back link */}
                    <Link
                        href="/coach/dashboard"
                        className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-8 transition-colors text-sm font-medium"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Kembali ke Dashboard
                    </Link>

                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        {/* Title area */}
                        <div className="flex-1">
                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {lesson.estimated_meeting_count && lesson.estimated_meeting_count > 1 && (
                                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold tracking-wide uppercase border border-emerald-500/30">
                                        {lesson.estimated_meeting_count} Pertemuan
                                    </span>
                                )}
                                {className && (
                                    <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold tracking-wide uppercase border border-white/20">
                                        {className}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight">
                                {lesson.title}
                            </h1>
                            {lesson.summary && (
                                <p className="text-slate-400 mt-3 text-base max-w-2xl line-clamp-2">{lesson.summary}</p>
                            )}
                        </div>

                        {/* Action buttons — right side */}
                        <div className="flex flex-wrap gap-3">
                            {sessionId && (
                                <Link
                                    href={`/coach/sessions/${sessionId}/attendance`}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/30 bg-white/5 hover:bg-white/10 text-white font-semibold transition-all text-sm"
                                >
                                    <span className="material-symbols-outlined text-xl">how_to_reg</span>
                                    Presensi
                                </Link>
                            )}
                            {lesson.example_url && (
                                <a
                                    href={lesson.example_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/30 bg-white/5 hover:bg-white/10 text-white font-semibold transition-all text-sm"
                                >
                                    <span className="material-symbols-outlined text-xl">sports_esports</span>
                                    Game Sample
                                </a>
                            )}
                            {!isEkskulLesson && (
                                <ReportLessonButton lessonId={lesson.id} lessonTitle={lesson.title} coachId={session.user.id} />
                            )}
                        </div>

                    </div>
                </div>
            </section>

            {/* Content Area */}
            <div className="max-w-6xl mx-auto w-full px-8 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">

                    {/* Left Column: Slide Viewer */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:p-8">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                <span className="material-symbols-outlined text-emerald-600">auto_awesome_motion</span>
                                <h2 className="text-xl font-bold text-slate-800">Slide Materi Utama</h2>
                            </div>

                            {lesson.slide_url ? (
                                <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900"
                                    style={{ paddingTop: '62.5%', minHeight: '360px' }}
                                >
                                    <iframe
                                        src={getSlideEmbedUrl(lesson.slide_url)}
                                        title={lesson.title}
                                        allowFullScreen
                                        className="absolute inset-0 w-full h-full border-0"
                                    />
                                </div>
                            ) : (
                                <div className="aspect-video w-full bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-8">
                                    <span className="material-symbols-outlined text-7xl text-slate-300 mb-4">gallery_thumbnail</span>
                                    <p className="text-base font-semibold text-slate-600">Slide belum tersedia</p>
                                    <p className="text-sm text-slate-400 mt-1">Materi presentasi belum diunggah untuk lesson ini.</p>
                                </div>
                            )}

                            {lesson.summary && (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <h3 className="text-base font-bold text-slate-800 mb-2">Ringkasan Materi</h3>
                                    <p className="text-slate-600 leading-relaxed text-sm">{lesson.summary}</p>
                                </div>
                            )}
                        </div>

                        {/* Make-up Instructions */}
                        {lesson.make_up_instructions && (
                            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                                <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-600">assignment_late</span>
                                    Instruksi Make-Up
                                </h3>
                                <p className="text-amber-900 text-sm leading-relaxed">{lesson.make_up_instructions}</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* Game Sample Card */}
                        {lesson.example_url && (
                            <div className="bg-white rounded-xl shadow-sm border border-emerald-100 p-6">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-600">sports_esports</span>
                                    Game Sample
                                </h4>
                                <a
                                    href={lesson.example_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors justify-center"
                                >
                                    <span className="material-symbols-outlined text-base">play_arrow</span>
                                    Buka Game
                                </a>
                            </div>
                        )}

                        {/* Lesson Info Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">info</span>
                                Info Lesson
                            </h4>
                            <div className="space-y-3">
                                {block && (
                                    <div className="flex justify-between gap-2 text-sm">
                                        <span className="text-slate-500 shrink-0">Block</span>
                                        <span className="font-bold text-slate-800 text-right break-words min-w-0">{block.name}</span>
                                    </div>
                                )}
                                <div className="flex justify-between gap-2 text-sm">
                                    <span className="text-slate-500 shrink-0">Urutan</span>
                                    <span className="font-bold text-slate-800">Lesson {lesson.order_index}</span>
                                </div>
                                {lesson.estimated_meeting_count && (
                                    <div className="flex justify-between gap-2 text-sm">
                                        <span className="text-slate-500 shrink-0">Durasi</span>
                                        <span className="font-bold text-slate-800">{lesson.estimated_meeting_count} Pertemuan</span>
                                    </div>
                                )}
                                <div className="flex justify-between gap-2 text-sm">
                                    <span className="text-slate-500 shrink-0">Slide</span>
                                    <span className={`font-bold ${lesson.slide_url ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {lesson.slide_url ? 'Tersedia' : 'Belum ada'}
                                    </span>
                                </div>
                            </div>
                        </div>



                        {/* Game Sample Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">sports_esports</span>
                                Game Sample
                            </h4>
                            {lesson.example_url ? (
                                <a
                                    href={lesson.example_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors justify-center"
                                >
                                    <span className="material-symbols-outlined text-base">play_arrow</span>
                                    Buka Game Sample
                                </a>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-4 text-center">
                                    <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">videogame_asset_off</span>
                                    <p className="text-sm text-slate-400 font-medium">Belum tersedia</p>
                                    <p className="text-xs text-slate-300 mt-0.5">Link game sample belum ditambahkan</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
