import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSessionOrThrow } from '@/lib/auth';
import ReportReviewClient from './ReportReviewClient';
import { classesDao } from '@/lib/dao';
import { readdir } from 'fs/promises';
import path from 'path';

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
      class:classes(id, name, coach_id),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name, id)
    `)
    .eq('id', id)
    .single();

  if (error || !report) redirect('/coach/reports');

  const klass = Array.isArray(report.class) ? report.class[0] : report.class;
  if (!klass) redirect('/coach/reports');

  const coachClasses = await classesDao.listClassesForCoach(coachId);
  const isAuthorized = coachClasses.some(c => c.id === klass.id);
  if (!isAuthorized) redirect('/coach/reports');

  if (report.status === 'PUBLISHED') redirect('/coach/reports');

  const criteriaData = await import('@/lib/dao/reportsDao').then(r => r.getEvaluationCriteria());
  const descriptionsData = await import('@/lib/dao/reportsDao').then(r => r.getBlockReportDescriptions(report.id));

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

  // Fetch coder's evaluasi block (refleksi) answers
  type EvalAnswer = { question: string; answer: string };
  let evaluationAnswers: EvalAnswer[] = [];
  try {
    const coderId = report.coder_id;
    const { data: evalData } = await (supabase as any)
      .from('block_evaluations')
      .select('answers')
      .eq('coder_id', coderId)
      .eq('block_id', report.block_id)
      .maybeSingle();

    if (evalData?.answers) {
      // Try to get actual questions from template
      let evalQuestions: { id: string; question: string }[] = [];
      const { data: evalSession } = await (supabase as any)
        .from('block_evaluation_sessions')
        .select('template_id')
        .eq('block_id', report.block_id)
        .limit(1)
        .maybeSingle();
      if (evalSession?.template_id) {
        const { data: tmpl } = await (supabase as any)
          .from('block_evaluation_templates')
          .select('questions')
          .eq('id', evalSession.template_id)
          .single();
        if (tmpl?.questions) {
          const qs = typeof tmpl.questions === 'string' ? JSON.parse(tmpl.questions) : tmpl.questions;
          evalQuestions = qs.map((q: any) => ({ id: q.id, question: q.question }));
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
      const answers = evalData.answers as Record<string, string>;
      evaluationAnswers = evalQuestions
        .filter(q => answers[q.id]?.trim())
        .map(q => ({ question: q.question, answer: answers[q.id] }));
    }
  } catch {
    // ignore if tables don't exist
  }


  const coder = Array.isArray(report.coder) ? report.coder[0] : report.coder;
  const block = Array.isArray(report.block) ? report.block[0] : report.block;

  const coderName = (coder as any)?.full_name || 'Coder';
  const coderInitials = coderName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('');

  // Build the coder's avatar public URL if they have one
  let coderAvatarUrl: string | null = null;
  if ((coder as any)?.id) {
    const { data: coderUser } = await supabase
      .from('users')
      .select('avatar_path, avatar_url')
      .eq('id', (coder as any).id)
      .maybeSingle();
    const rawAvatarUrl: string | null = (coderUser as any)?.avatar_path || (coderUser as any)?.avatar_url || null;
    if (rawAvatarUrl) {
      if (rawAvatarUrl.startsWith('http')) {
        coderAvatarUrl = rawAvatarUrl;
      } else {
        // Local storage: served via /api/avatars/[filename]
        const filename = rawAvatarUrl.split('/').pop();
        coderAvatarUrl = `/api/avatars/${filename}`;
      }
    } else {
      // Fallback: scan local avatars folder for files matching the coder's ID prefix
      try {
        const avatarsDir = path.join(process.cwd(), 'public/uploads/avatars');
        const files = await readdir(avatarsDir);
        const coderFiles = files
          .filter(f => f.startsWith((coder as any).id))
          .sort()
          .reverse();
        if (coderFiles.length > 0) {
          coderAvatarUrl = `/api/avatars/${coderFiles[0]}`;
        }
      } catch {
        // avatars folder not accessible — skip silently
      }
    }
  }

  return (
    <div className="-mx-8 -mb-8">
      <ReportReviewClient
        reportId={report.id}
        initialDescriptions={initialDescriptions}
        coderName={coderName}
        coderInitials={coderInitials}
        coderAvatarUrl={coderAvatarUrl}
        className={klass.name}
        blockName={(block as any)?.name ?? ''}
        grade={report.grade}
        averageScore={report.average_score}
        status={report.status}
        evaluationAnswers={evaluationAnswers}
      />
    </div>
  );
}

