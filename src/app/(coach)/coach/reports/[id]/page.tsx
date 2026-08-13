import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSessionOrThrow } from '@/lib/auth';
import ReportReviewClient from './ReportReviewClient';
import { classesDao, sessionsDao } from '@/lib/dao';
import { readdir } from 'fs/promises';
import { buildAvatarPublicPath, getAvatarUploadDir, resolveAvatarPublicUrl } from '@/lib/services/avatarStorage';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';

type ReportClass = {
  id: string;
  name: string;
  coach_id: string | null;
  type: string | null;
  level_id: string | null;
  ekskul_lesson_plan_id: string | null;
};
type ReportBlock = { name: string | null };
type ReportCoder = { id: string | null; full_name: string | null };
type ReportRecord = {
  id: string;
  status: string;
  coder_id: string | null;
  block_id: string | null;
  grade: string | null;
  average_score: number | null;
  class: ReportClass | ReportClass[] | null;
  block: ReportBlock | ReportBlock[] | null;
  coder: ReportCoder | ReportCoder[] | null;
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

export default async function CoachReportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrThrow();
  const coachId = session.user.id;

  const resolvedParams = await params;
  const { id } = resolvedParams;

  const supabase = getSupabaseAdmin();

  const { data: report, error } = await supabase
    .from('block_reports')
    .select(`
      *,
      class:classes(id, name, coach_id, type, level_id, ekskul_lesson_plan_id),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name, id)
    `)
    .eq('id', id)
    .single();

  if (error || !report) redirect('/coach/reports');

  const reportRecord = report as ReportRecord;
  const klass = Array.isArray(reportRecord.class) ? reportRecord.class[0] : reportRecord.class;
  if (!klass) redirect('/coach/reports');

  const coachClasses = await classesDao.listClassesForCoach(coachId);
  const isAuthorized = coachClasses.some(c => c.id === klass.id);
  if (!isAuthorized) redirect('/coach/reports');

  if (reportRecord.status === 'PUBLISHED') redirect('/coach/reports');

  const criteriaData = await import('@/lib/dao/reportsDao').then(r => r.getEvaluationCriteria());
  const descriptionsData = await import('@/lib/dao/reportsDao').then(r => r.getBlockReportDescriptions(reportRecord.id));

  const initialDescriptions = criteriaData.map(c => {
    const savedDesc = descriptionsData.find(d => d.criteria_id === c.id);
    return {
      criteriaId: c.id,
      criteriaName: c.name,
      criteriaDescription: c.description ?? '',
      score: savedDesc?.score || 0,
      description: savedDesc?.description || '',
    };
  });

  // A block report aggregates evaluations from multiple completed sessions. Link
  // to the most recent source session so Coach can jump back to the scoring form.
  let assessmentSessionId: string | null = null;
  if (reportRecord.coder_id && reportRecord.block_id) {
    try {
      const [lessonMap, classSessions] = await Promise.all([
        computeLessonSchedule(klass.id, klass.level_id, klass.ekskul_lesson_plan_id),
        sessionsDao.listSessionsByClass(klass.id),
      ]);

      const candidateSessions = classSessions
        .filter((candidate) => (
          candidate.status === 'COMPLETED'
          && lessonMap.get(candidate.id)?.block.id === reportRecord.block_id
        ))
        .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());

      if (candidateSessions.length > 0) {
        const { data: evaluatedSessions } = await supabase
          .from('lesson_evaluations')
          .select('session_id')
          .eq('coder_id', reportRecord.coder_id)
          .in('session_id', candidateSessions.map((candidate) => candidate.id));
        const evaluatedSessionIds = new Set((evaluatedSessions ?? []).map((row) => row.session_id));
        assessmentSessionId = candidateSessions.find((candidate) => evaluatedSessionIds.has(candidate.id))?.id ?? null;
      }
    } catch {
      // The report remains usable if historical session mapping is unavailable.
    }
  }

  // Fetch coder's evaluasi block (refleksi) answers
  type EvalAnswer = { question: string; answer: string };
  let evaluationAnswers: EvalAnswer[] = [];
  try {
    const queryTable = (table: string) => (supabase as unknown as { from: (table: string) => LooseQueryBuilder }).from(table);
    const coderId = reportRecord.coder_id;
    const { data: evalData } = await queryTable('block_evaluations')
      .select('answers')
      .eq('coder_id', coderId)
      .eq('block_id', reportRecord.block_id)
      .maybeSingle();

    const answers = isRecord(evalData) ? toStringMap(evalData.answers) : null;

    if (answers) {
      // Try to get actual questions from template
      let evalQuestions: { id: string; question: string }[] = [];
      const { data: evalSession } = await queryTable('block_evaluation_sessions')
        .select('template_id')
        .eq('block_id', reportRecord.block_id)
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
      if (evalQuestions.length === 0) {
        evalQuestions = [
          { id: 'q1', question: 'Apa hal baru yang paling kamu sukai dari block ini?' },
          { id: 'q2', question: 'Di bagian mana kamu merasa paling kesulitan?' },
          { id: 'q3', question: 'Apa yang sudah berhasil kamu buat atau selesaikan di block ini?' },
          { id: 'q4', question: 'Apa yang ingin kamu coba pelajari lebih lanjut?' },
          { id: 'q5', question: 'Pesan untuk dirimu sendiri di block berikutnya:' },
        ];
      }
      evaluationAnswers = evalQuestions
        .filter(q => answers[q.id]?.trim())
        .map(q => ({ question: q.question, answer: answers[q.id] }));
    }
  } catch {
    // ignore if tables don't exist
  }


  const coder = Array.isArray(reportRecord.coder) ? reportRecord.coder[0] : reportRecord.coder;
  const block = Array.isArray(reportRecord.block) ? reportRecord.block[0] : reportRecord.block;

  const coderName = coder?.full_name || 'Coder';

  // Build the coder's avatar public URL if they have one
  let coderAvatarUrl: string | null = null;
  if (coder?.id) {
    const { data: coderUser } = await supabase
      .from('users')
      .select('avatar_path, avatar_url')
      .eq('id', coder.id)
      .maybeSingle();
    const coderUserRecord = coderUser as { avatar_path?: string | null; avatar_url?: string | null } | null;
    const rawAvatarUrl: string | null = coderUserRecord?.avatar_path || coderUserRecord?.avatar_url || null;
    if (rawAvatarUrl) {
      coderAvatarUrl = resolveAvatarPublicUrl(rawAvatarUrl);
    } else {
      // Fallback: scan local avatars folder for files matching the coder's ID prefix
      try {
        const avatarsDir = getAvatarUploadDir();
        const files = await readdir(avatarsDir);
        const coderFiles = files
          .filter(f => f.startsWith(coder.id ?? ''))
          .sort()
          .reverse();
        if (coderFiles.length > 0) {
          coderAvatarUrl = buildAvatarPublicPath(coderFiles[0]);
        }
      } catch {
        // avatars folder not accessible — skip silently
      }
    }
  }

  return (
    <div className="-mx-8 -mb-8">
      <ReportReviewClient
        reportId={reportRecord.id}
        initialDescriptions={initialDescriptions}
        coderName={coderName}
        coderAvatarUrl={coderAvatarUrl}
        className={klass.name}
        blockName={block?.name ?? ''}
        grade={reportRecord.grade}
        averageScore={reportRecord.average_score}
        status={reportRecord.status}
        evaluationAnswers={evaluationAnswers}
        assessmentHref={assessmentSessionId ? `/coach/rubrics/${assessmentSessionId}` : null}
      />
    </div>
  );
}
