import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import BlockEvaluationClient from './BlockEvaluationClient';
import { isCoderEvaluationSelfPaced } from '@/lib/coderEvaluationMode';

type EvaluationContext = { id: string; status: string; created_at: string; template_id: string | null };
type EvaluationContextQuery = {
  select: (columns: string) => EvaluationContextQuery;
  eq: (column: string, value: string) => EvaluationContextQuery;
  maybeSingle: () => Promise<{ data: EvaluationContext | null; error: unknown }>;
};

export default async function BlockEvaluationPage({
  params,
  searchParams
}: {
  params: Promise<{ classId: string; blockId: string; sessionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSessionOrThrow();
  const { classId, blockId, sessionId } = await params;
  const resolvedParams = await searchParams;
  const evalSessionId = typeof resolvedParams.evalSessionId === 'string' ? resolvedParams.evalSessionId : undefined;

  const supabase = getSupabaseAdmin();

  if (session.user.role !== 'CODER') {
    return <main className="p-8">Unauthorized.</main>;
  }

  const { data: enrollment } = await supabase.from('enrollments')
    .select('id')
    .eq('class_id', classId)
    .eq('coder_id', session.user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!enrollment) {
    return <main className="p-8">Kamu tidak memiliki akses ke kelas ini.</main>;
  }

  const { data: lessonAccess } = await supabase.from('class_lessons')
    .select('id,class_blocks!inner(class_id,block_id)')
    .eq('session_id', sessionId)
    .eq('class_blocks.class_id', classId)
    .eq('class_blocks.block_id', blockId)
    .maybeSingle();
  if (!lessonAccess) {
    return <main className="p-8">Sesi evaluasi tidak ditemukan.</main>;
  }
  const { data: evaluationContext, error: evaluationContextError } = evalSessionId
    ? await (supabase as unknown as { from: (table: 'block_evaluation_sessions') => EvaluationContextQuery }).from('block_evaluation_sessions')
      .select('id,status,created_at,template_id')
      .eq('id', evalSessionId)
      .eq('class_id', classId)
      .eq('block_id', blockId)
      .eq('session_id', sessionId)
      .maybeSingle()
    : { data: null, error: null };
  if (evalSessionId && (evaluationContextError || !evaluationContext)) {
    return <main className="p-8">Sesi evaluasi tidak ditemukan untuk kelas ini.</main>;
  }
  const { data: meeting, error: meetingError } = evaluationContext
    ? await supabase.from('sessions').select('date_time,status').eq('id', sessionId).eq('class_id', classId).maybeSingle()
    : { data: null, error: null };
  if (meetingError) return <main className="p-8">Status sesi belum dapat dimuat. Silakan coba lagi.</main>;
  const selfPaced = evaluationContext ? isCoderEvaluationSelfPaced({
    status: evaluationContext.status,
    createdAt: evaluationContext.created_at,
    meetingAt: meeting?.date_time,
    meetingStatus: meeting?.status,
  }, new Date()) : false;

  const { data: existingEvaluation } = await supabase
    .from('block_evaluations')
    .select('id')
    .eq('coder_id', session.user.id)
    .eq('class_id', classId)
    .eq('block_id', blockId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existingEvaluation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#162b46] p-6 text-center text-white">
        <section className="w-full max-w-lg rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-sm">
          <CheckCircle2 className="mx-auto mb-5 text-clevio-green" size={64} aria-hidden="true" />
          <h1 className="text-3xl font-black">Evaluasi sudah selesai</h1>
          <p className="mt-3 text-white/70">
            Jawaban evaluasimu sudah tersimpan. Kamu tidak perlu mengisi sesi yang sama lagi.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/coder/materials"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-6 py-3 font-black text-clevio-navy transition-colors hover:bg-slate-100"
            >
              Buka Materi
            </Link>
            <Link
              href="/coder/dashboard"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl px-6 py-3 font-bold hover:bg-white/10"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // Fetch class, block, coach, level data in parallel
  const [{ data: classData }, { data: blockData }] = await Promise.all([
    supabase
      .from('classes')
      .select('name, coach_id, levels(name)')
      .eq('id', classId)
      .single(),
    supabase
      .from('blocks')
      .select('name')
      .eq('id', blockId)
      .single(),
  ]);

  let coachName = 'Coach';
  if (classData?.coach_id) {
    const { data: coachData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', classData.coach_id)
      .single();
    if (coachData?.full_name) {
      coachName = coachData.full_name.split(' ')[0];
    }
  }

  const levelName = (classData?.levels as any)?.name ?? null;
  const blockName = blockData?.name ?? 'Block Evaluasi';

  // Fetch evaluation template questions
  let questions: any[] = [];
  let templateId: string | null = null;
  if (evaluationContext?.template_id) {
    const { data: originalTemplate } = await supabase.from('block_evaluation_templates')
      .select('id,questions').eq('id', evaluationContext.template_id).maybeSingle();
    if (originalTemplate) {
      questions = originalTemplate.questions ?? [];
      templateId = originalTemplate.id;
    }
  }

  // Try to find a template for this class's level
  const { data: levelRow } = await supabase
    .from('classes')
    .select('level_id')
    .eq('id', classId)
    .single();

  if (questions.length === 0 && levelRow?.level_id) {
    const { data: tmpl } = await supabase
      .from('block_evaluation_templates')
      .select('*')
      .eq('level_id', levelRow.level_id)
      .maybeSingle();
    if (tmpl) {
      questions = tmpl.questions ?? [];
      templateId = tmpl.id;
    }
  }

  if (questions.length === 0) {
    const { data: fallbackTmpl } = await supabase
      .from('block_evaluation_templates')
      .select('*')
      .is('level_id', null)
      .maybeSingle();
    if (fallbackTmpl) {
      questions = fallbackTmpl.questions ?? [];
      templateId = fallbackTmpl.id;
    }
  }

  // Absolute hardcoded fallback
  if (questions.length === 0) {
    questions = [
      { id: 'q1', question: 'Apa hal baru yang paling kamu sukai dari block ini?', hint: 'Ceritakan hal yang paling seru atau menarik buatmu!', placeholder: 'Contoh: Aku suka waktu belajar bikin animasi...' },
      { id: 'q2', question: 'Di bagian mana kamu merasa paling kesulitan?', hint: 'Tidak apa-apa kalau ada yang susah — justru itu yang membuat kita belajar!', placeholder: 'Contoh: Yang paling susah pas bagian coding...' },
      { id: 'q3', question: 'Apa yang sudah kamu berhasil buat atau selesaikan di block ini?', hint: 'Bisa berupa project, game, atau fitur.', placeholder: 'Di block ini aku udah selesai bikin...' },
      { id: 'q4', question: 'Apa yang ingin kamu coba pelajari lebih lanjut?', hint: 'Ada hal yang bikin kamu penasaran ga?', placeholder: 'Aku penasaran pengen tau cara...' },
      { id: 'q5', question: 'Pesan untuk dirimu sendiri di block berikutnya:', hint: 'Tulis target atau penyemangat biar block depan makin jago!', placeholder: 'Contoh: Semoga block besok bisa...' },
    ];
  }

  return (
    <BlockEvaluationClient 
      classId={classId} 
      blockId={blockId} 
      sessionId={sessionId}
      coachName={coachName}
      blockName={blockName}
      levelName={levelName}
      questions={questions}
      templateId={templateId}
      evalSessionId={evalSessionId}
      selfPaced={selfPaced}
    />
  );
}
