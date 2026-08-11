import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Code2,
  MessageSquare,
  MessagesSquare,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';
import DownloadPdfButton from './DownloadPdfButton';
import ReportStoryExperience from './ReportStoryExperience';
import StoryShareButton from './StoryShareButton';

const CLEVIO_LOGO_SRC = '/logo/innovator-camp-logo-dark.png';
const COMPETENCY_ICONS = [Code2, Sparkles, CircleHelp, Target, MessagesSquare];
const COMPETENCY_ACCENTS = ['#2563eb', '#00b0d7', '#ff9400', '#72bf44', '#4f46e5'];

const getGrade = (score: number) => {
  if (score >= 8.5) return 'A';
  if (score >= 7.0) return 'B';
  if (score >= 5.5) return 'C';
  return 'D';
};

type LooseQueryBuilder = {
  select: (columns: string) => LooseQueryBuilder;
  eq: (column: string, value: unknown) => LooseQueryBuilder;
  limit: (count: number) => LooseQueryBuilder;
  maybeSingle: () => Promise<{ data: unknown | null }>;
  single: () => Promise<{ data: unknown | null }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const toStringMap = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value)) return null;
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
};

const parseQuestionList = (value: unknown): { id: string; question: string }[] => {
  let rawQuestions: unknown;
  try {
    rawQuestions = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return [];
  }

  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions.flatMap((question) => (
    isRecord(question) && typeof question.id === 'string' && typeof question.question === 'string'
      ? [{ id: question.id, question: question.question }]
      : []
  ));
};

type LessonTitleRow = {
  title: string | null;
  order_index?: number | null;
  lesson_template_id?: string | null;
  lesson_template?: { title?: string | null; order_index?: number | null } | { title?: string | null; order_index?: number | null }[] | null;
};

const cleanLessonTitle = (title: string) => title
  .replace(/\s*[\(\[]\s*(?:part|sesi|session|pertemuan)\s*\d+\s*[\)\]]\s*$/i, '')
  .replace(/\s*[-–—:]\s*(?:part|sesi|session|pertemuan)\s*\d+\s*$/i, '')
  .trim();

const getParentLessonTitle = (lesson: LessonTitleRow) => {
  const template = Array.isArray(lesson.lesson_template)
    ? lesson.lesson_template[0]
    : lesson.lesson_template;
  return cleanLessonTitle(template?.title || lesson.title || '');
};

const getUniqueLessonTitles = (lessons: LessonTitleRow[]) => {
  const seen = new Set<string>();
  return lessons.flatMap((lesson) => {
    const title = getParentLessonTitle(lesson);
    if (!title) return [];
    const key = lesson.lesson_template_id || title.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [title];
  });
};

export default async function PublicReportView({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const supabase = getSupabaseAdmin();

  const { data: report, error } = await supabase
    .from('block_reports')
    .select(`
      *,
      class:classes(id, name, type, level:levels(name), coach:users!classes_coach_id_fkey(full_name)),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('[PublicReportView] Supabase Error:', error);
    return notFound();
  }

  const isPublished = report.status === 'PUBLISHED';
  if (!isPublished) {
    const { getSessionOrThrow } = await import('@/lib/auth');
    try {
      const session = await getSessionOrThrow();
      const role = session.user.role;
      if (role !== 'ADMIN' && role !== 'COACH') return notFound();
    } catch {
      return notFound();
    }
  }

  const klass = Array.isArray(report.class) ? report.class[0] : report.class;
  const block = Array.isArray(report.block) ? report.block[0] : report.block;
  const coder = Array.isArray(report.coder) ? report.coder[0] : report.coder;
  const coach = klass?.coach ? (Array.isArray(klass.coach) ? klass.coach[0] : klass.coach) : null;

  const [{ data: evalCriteria }, { data: reportClassBlocks }] = await Promise.all([
    supabase.from('evaluation_criteria').select('*').order('order_index'),
    supabase
      .from('class_blocks')
      .select('id, start_date')
      .eq('class_id', report.class_id)
      .eq('block_id', report.block_id)
      .order('start_date', { ascending: false })
      .limit(1),
  ]);

  const reportClassBlockId = reportClassBlocks?.[0]?.id ?? null;
  const { data: actualClassLessons } = reportClassBlockId
    ? await supabase
        .from('class_lessons')
        .select('title, order_index, lesson_template_id, lesson_template:lesson_templates(title, order_index)')
        .eq('class_block_id', reportClassBlockId)
        .order('order_index')
    : { data: null };
  const { data: fallbackLessonTemplates } = !actualClassLessons || actualClassLessons.length === 0
    ? await supabase
        .from('lesson_templates')
        .select('title, order_index')
        .eq('block_id', report.block_id)
        .eq('is_archived', false)
        .order('order_index')
    : { data: null };

  // Fetch block evaluation (reflection) submitted by the coder for this block
  let blockEvaluation: { answers: Record<string, string> } | null = null;
  let evalQuestions: { id: string; question: string }[] = [];
  try {
    const queryTable = (table: string) => (supabase as unknown as { from: (table: string) => LooseQueryBuilder }).from(table);

    const { data: evalData } = await queryTable('block_evaluations')
      .select('answers')
      .eq('coder_id', report.coder_id)
      .eq('block_id', report.block_id)
      .maybeSingle();
    const answers = isRecord(evalData) ? toStringMap(evalData.answers) : null;
    if (answers) blockEvaluation = { answers };

    // Try to fetch the evaluation template for this block to get actual questions
    const { data: evalSession } = await queryTable('block_evaluation_sessions')
      .select('template_id')
      .eq('block_id', report.block_id)
      .limit(1)
      .maybeSingle();

    const templateId = isRecord(evalSession) && typeof evalSession.template_id === 'string'
      ? evalSession.template_id
      : null;

    if (templateId) {
      const { data: tmpl } = await queryTable('block_evaluation_templates')
        .select('questions')
        .eq('id', templateId)
        .single();
      if (isRecord(tmpl) && tmpl.questions) {
        evalQuestions = parseQuestionList(tmpl.questions);
      }
    }

    // Fallback to hardcoded if no template found
    if (evalQuestions.length === 0) {
      evalQuestions = [
        { id: 'q1', question: 'Apa hal baru yang paling kamu sukai dari block ini?' },
        { id: 'q2', question: 'Di bagian mana kamu merasa paling kesulitan?' },
        { id: 'q3', question: 'Apa yang sudah berhasil kamu buat atau selesaikan di block ini?' },
        { id: 'q4', question: 'Apa yang ingin kamu coba pelajari lebih lanjut?' },
        { id: 'q5', question: 'Pesan untuk dirimu sendiri di block berikutnya:' },
      ];
    }
  } catch {
    // Table may not exist yet — gracefully ignore
  }


  const descriptionsData = await import('@/lib/dao/reportsDao').then(r => r.getBlockReportDescriptions(report.id));

  const breakdownData = evalCriteria?.map(c => {
    const desc = descriptionsData.find(d => d.criteria_id === c.id);
    return {
      name: c.name,
      average: Number((desc?.score || 0).toFixed(1)),
      description: desc?.description || '',
    };
  }) || [];

  const lessonTitles = getUniqueLessonTitles(actualClassLessons?.length ? actualClassLessons : fallbackLessonTemplates || []);

  const pubDate = new Date(report.updated_at || report.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const avgScore = Number((report.average_score || 0).toFixed(1));
  const grade = report.grade || getGrade(avgScore);
  const gradeMessage = avgScore >= 8.5
    ? 'Excellent Performance'
    : avgScore >= 7.0
      ? 'Good Performance'
      : avgScore >= 5.5
        ? 'Developing Performance'
         : 'Needs Support';
  const gradeSummary = avgScore >= 8.5
    ? 'Hasil belajar menunjukkan pemahaman yang kuat, kreativitas tinggi, dan perkembangan yang konsisten.'
    : avgScore >= 7.0
      ? 'Hasil belajar menunjukkan pemahaman yang baik dan perkembangan yang positif selama block berlangsung.'
      : avgScore >= 5.5
        ? 'Kemampuan utama mulai berkembang dan akan semakin kuat dengan latihan yang konsisten.'
        : 'Coder memerlukan pendampingan lanjutan untuk memperkuat pemahaman dan rasa percaya diri.';
  const reportTitle = klass?.type === 'EKSKUL' ? 'Performance Report' : 'Block Performance Report';
  const reportContextLabel = klass?.type === 'EKSKUL' ? 'Ekskul' : `${klass?.name ?? ''} - ${block?.name ?? ''}`;
  const lessonSectionTitle = klass?.type === 'EKSKUL' ? 'Materi Ekskul' : 'Materi yang Dibahas';
  const lessonSectionSubtitle = 'Daftar materi yang menjadi konteks penilaian laporan ini.';
  const scorePercentage = Math.max(0, Math.min(100, Math.round(avgScore * 10)));
  const storyCompetencies = breakdownData.map((item) => ({
    name: item.name,
    percentage: Math.round((item.average / 10) * 100),
    description: item.description,
  }));
  const reportReflections = blockEvaluation
    ? (() => {
        const answers = blockEvaluation.answers;
        const knownIds = new Set(evalQuestions.map((question) => question.id));
        const answeredQuestions = evalQuestions
          .filter((question) => answers[question.id]?.trim())
          .map((question) => ({ question: question.question, answer: answers[question.id] }));
        const extras = Object.entries(answers)
          .filter(([key, value]) => !knownIds.has(key) && value?.trim())
          .map(([, value]) => ({ question: 'Refleksi Tambahan', answer: value }));
        return [...answeredQuestions, ...extras];
      })()
    : [];

  return (
    <div className="report-root min-h-screen bg-[#eef6fb] font-sans text-[#17306b] antialiased">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { background: white !important; }
          body, .report-root {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          [data-purpose="report-topbar"],
          [data-purpose="report-actions"] { display: none !important; }
          .report-root { min-height: 0 !important; background: white !important; }
          .report-page { max-width: none !important; padding: 0 !important; }
          .report-hero {
            grid-template-columns: minmax(0, 1fr) 285px !important;
            gap: 18px !important;
            padding: 18px !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            break-inside: avoid !important;
          }
          .report-hero h1 { font-size: 24px !important; line-height: 1.1 !important; }
          .report-score-card {
            display: grid !important;
            grid-template-columns: 92px minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 14px !important;
            padding: 16px !important;
            min-height: 132px !important;
          }
          .report-score-card > div:first-child { width: 92px !important; height: 92px !important; }
          .report-score-card > div:first-child strong { font-size: 28px !important; }
          .report-score-card > div:last-child span { font-size: 9px !important; }
          .report-score-card > div:last-child p:first-of-type {
            margin-top: 9px !important;
            font-size: 16px !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }
          .report-score-card > div:last-child p:last-of-type {
            display: none !important;
          }
          .report-section { margin-top: 22px !important; }
          .report-section-heading { margin-bottom: 10px !important; }
          .report-section-heading h2 { font-size: 18px !important; }
          .report-competency-grid, .report-reflection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 9px !important; }
          .report-competency-card, .report-reflection-card, .report-lessons-panel {
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .report-competency-card { padding: 12px !important; }
          .report-competency-card p { font-size: 9.5px !important; line-height: 1.4 !important; }
          .report-lessons-panel { padding: 14px !important; }
          .report-lesson-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 7px !important; }
          .report-reflection-card { padding: 11px !important; }
          .report-reflection-card p { font-size: 9.5px !important; line-height: 1.4 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
      <header data-purpose="report-topbar" className="border-b border-[#dbe7ef] bg-white print:hidden">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <img src={CLEVIO_LOGO_SRC} alt="Clevio" className="h-8 w-auto shrink-0 object-contain" />
            <span className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <p className="truncate text-sm font-extrabold text-[#22367b] sm:text-base">{reportTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <ReportStoryExperience
              studentName={coder?.full_name ?? 'Coder Clevio'}
              reportTitle={reportTitle}
              contextLabel={reportContextLabel}
              coachName={coach?.full_name ?? 'Clevio Coach'}
              publishedDate={pubDate}
              score={scorePercentage}
              grade={grade}
              performanceLabel={gradeMessage}
              performanceSummary={gradeSummary}
              competencies={storyCompetencies}
              lessons={lessonTitles}
              reflections={reportReflections}
            />
            <DownloadPdfButton />
          </div>
        </div>
      </header>

      <div className="report-page mx-auto max-w-[1180px] px-4 py-7 sm:px-6 sm:py-10 lg:py-12">
        <header className="report-hero relative grid overflow-hidden rounded-2xl border border-[#dce8ef] bg-white p-6 shadow-[0_18px_45px_rgba(31,63,101,0.08)] md:grid-cols-[minmax(0,1fr)_360px] md:items-stretch md:gap-8 md:p-8" data-purpose="student-hero">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-48 bg-[#e8f6ec] [clip-path:polygon(34%_0,100%_0,100%_58%,0_72%)]" aria-hidden="true" />
          <div className="relative z-10 flex min-w-0 flex-col justify-center py-2">
            <div className="mb-4 inline-flex w-fit items-center rounded-full bg-[#e9f5ff] px-3 py-1.5 text-xs font-extrabold text-[#1478c9]">
              + Laporan Perkembangan Coder
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-[#152c64] sm:text-4xl lg:text-5xl">{coder?.full_name}</h1>
            <p className="mt-2 text-base font-extrabold text-[#22367b] sm:text-lg">{reportContextLabel}</p>
            <div className="mt-5 flex flex-wrap gap-2.5 text-xs font-bold text-[#526886] sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#dce7ef] bg-[#f8fbfd] px-3 py-2">
                <UserRound size={15} className="text-[#00a9ce]" aria-hidden="true" />
                Coach: {coach?.full_name ?? 'Clevio Coach'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#dce7ef] bg-[#f8fbfd] px-3 py-2">
                <CalendarDays size={15} className="text-[#ff7b6b]" aria-hidden="true" />
                {pubDate}
              </span>
            </div>
          </div>

          <div className="report-score-card relative z-10 mt-6 flex min-h-64 items-center gap-5 rounded-2xl bg-[#1d3475] p-5 text-white shadow-[0_14px_30px_rgba(24,49,111,0.24)] md:mt-0 md:p-6">
            <div className="relative h-32 w-32 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="12" />
                <circle cx="60" cy="60" r="48" fill="none" stroke="#9dc83b" strokeWidth="12" strokeLinecap="round" strokeDasharray="301.6" strokeDashoffset={301.6 - (301.6 * scorePercentage / 100)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-4xl font-black leading-none">{scorePercentage}</strong>
                <span className="mt-1 text-[10px] font-extrabold tracking-wider text-white/70">OVERALL</span>
              </div>
            </div>
            <div className="min-w-0">
              <span className="inline-flex rounded-md bg-[#a8d532] px-2 py-1 text-xs font-black text-[#17306b]">GRADE {grade}</span>
              <p className="mt-3 text-xl font-black leading-tight">{gradeMessage}</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-white/75">{gradeSummary}</p>
            </div>
          </div>
        </header>

        <main>
          <section className="report-section mt-12" data-purpose="competency-feedback">
            <div className="report-section-heading mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-[#00a9ce]">Kompetensi & Observasi</p>
                <h2 className="mt-1 text-2xl font-black text-[#152c64] sm:text-3xl">Catatan perkembangan dari Coach</h2>
                <p className="mt-1 text-sm font-medium text-[#7184a0]">Setiap area menampilkan nilai dan observasi pembelajaran selama block berlangsung.</p>
              </div>
              <span className="hidden shrink-0 rounded-full border border-[#d9e6ee] bg-white px-3 py-1.5 text-xs font-bold text-[#7184a0] sm:inline-flex">{breakdownData.length} area kompetensi</span>
            </div>

            <div className="report-competency-grid grid gap-4 md:grid-cols-2" data-purpose="competency-list">
              {breakdownData.map((item, idx) => {
                const pct = Math.round((item.average / 10) * 100);
                const CompetencyIcon = COMPETENCY_ICONS[idx % COMPETENCY_ICONS.length];
                const accent = COMPETENCY_ACCENTS[idx % COMPETENCY_ACCENTS.length];
                return (
                  <article key={item.name} className={`${idx === breakdownData.length - 1 && breakdownData.length % 2 === 1 ? 'md:col-span-2' : ''} report-competency-card rounded-xl border border-[#dbe7ef] bg-white p-5 shadow-[0_8px_24px_rgba(31,63,101,0.05)]`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: accent }}>
                          <CompetencyIcon size={22} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <span className="text-[10px] font-extrabold uppercase text-[#8796ac]">Competency</span>
                          <h3 className="text-base font-black leading-tight text-[#22367b] sm:text-lg">{item.name}</h3>
                        </div>
                      </div>
                      <strong className="shrink-0 text-2xl font-black text-[#22367b]">{pct}%</strong>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e8eef3]">
                      <div className="h-full rounded-full bg-[#00b0d7]" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                    </div>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-[#60728f]">{item.description || 'Tidak ada catatan khusus dari coach untuk poin ini.'}</p>
                  </article>
                );
              })}
            </div>
          </section>

          {lessonTitles.length > 0 && (
            <section className="report-section mt-12" data-purpose="lesson-list">
              <div className="report-section-heading mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase text-[#00a9ce]">Materi yang Dibahas</p>
                  <h2 className="mt-1 text-2xl font-black text-[#152c64] sm:text-3xl">Perjalanan belajar dalam block ini</h2>
                  <p className="mt-1 text-sm font-medium text-[#7184a0]">{lessonSectionSubtitle}</p>
                </div>
                <span className="hidden shrink-0 rounded-full border border-[#d9e6ee] bg-white px-3 py-1.5 text-xs font-bold text-[#7184a0] sm:inline-flex">{lessonTitles.length} materi</span>
              </div>
              <div className="report-lessons-panel rounded-xl border border-[#dbe7ef] bg-white p-4 shadow-[0_8px_24px_rgba(31,63,101,0.05)] sm:p-6">
                <div className="mb-4 flex items-center gap-3 text-[#22367b]">
                  <ClipboardList size={20} aria-hidden="true" />
                  <span className="text-sm font-extrabold">{lessonSectionTitle}</span>
                </div>
                <div className="report-lesson-grid grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {lessonTitles.map((title, idx) => (
                    <div key={`${title}-${idx}`} className="min-h-24 rounded-lg border border-[#dfe9f0] bg-[#f6f9fd] p-3">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-[#22367b] px-1.5 text-xs font-black text-white">{(idx + 1).toString().padStart(2, '0')}</span>
                      <p className="mt-3 text-sm font-extrabold leading-snug text-[#22367b]">{title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {reportReflections.length > 0 && (
              <section className="report-section mt-12" data-purpose="reflection-qa">
                <div className="report-section-heading mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase text-[#00a9ce]">Refleksi Coder</p>
                    <h2 className="mt-1 text-2xl font-black text-[#152c64] sm:text-3xl">Catatan refleksi yang dikirim oleh coder</h2>
                    <p className="mt-1 text-sm font-medium text-[#7184a0]">Jawaban tentang proses, tantangan, dan perkembangan project.</p>
                  </div>
                  <span className="hidden shrink-0 rounded-full border border-[#d9e6ee] bg-white px-3 py-1.5 text-xs font-bold text-[#7184a0] sm:inline-flex">{reportReflections.length} pertanyaan</span>
                </div>
                <div className="report-reflection-grid grid gap-4 md:grid-cols-2">
                  {reportReflections.map((reflection, idx) => (
                    <article key={`${reflection.question}-${idx}`} className={`${idx === reportReflections.length - 1 && reportReflections.length % 2 === 1 ? 'md:col-span-2' : ''} report-reflection-card rounded-xl border border-[#dbe7ef] bg-white p-5 shadow-[0_8px_24px_rgba(31,63,101,0.05)]`}>
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-[#1861bd] px-1 text-xs font-black text-white">{(idx + 1).toString().padStart(2, '0')}</span>
                        <div>
                          <h3 className="text-sm font-black leading-snug text-[#17306b]">{reflection.question}</h3>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-[#60728f]">{reflection.answer}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
          )}
        </main>

        <footer className="mt-12 rounded-xl bg-[#1d3475] px-5 py-5 text-white shadow-[0_12px_28px_rgba(24,49,111,0.18)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7" data-purpose="report-actions">
          <div className="mb-4 sm:mb-0">
            <div className="flex items-center gap-3">
              <MessageSquare size={22} className="text-[#9dc83b]" aria-hidden="true" />
              <p className="text-lg font-black">Laporan perkembangan siap dibagikan</p>
            </div>
            <p className="mt-1 text-sm font-medium text-white/70">Bagikan ringkasan 9:16 yang siap digunakan untuk story media sosial.</p>
          </div>
          <StoryShareButton
            studentName={coder?.full_name ?? 'Coder Clevio'}
            reportTitle={reportTitle}
            contextLabel={reportContextLabel}
            coachName={coach?.full_name ?? 'Clevio Coach'}
            publishedDate={pubDate}
            score={scorePercentage}
            grade={grade}
            performanceLabel={gradeMessage}
            competencies={storyCompetencies}
          />
        </footer>
      </div>
    </div>
  );
}
