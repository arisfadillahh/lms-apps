import { getSessionOrThrow } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import BlockEvaluationClient from './BlockEvaluationClient';

export default async function BlockEvaluationPage({
  params,
  searchParams
}: {
  params: Promise<{ classId: string; blockId: string; sessionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await getSessionOrThrow();
  const { classId, blockId, sessionId } = await params;
  const resolvedParams = await searchParams;
  const evalSessionId = typeof resolvedParams.evalSessionId === 'string' ? resolvedParams.evalSessionId : undefined;

  const supabase = getSupabaseAdmin();

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

  // Try to find a template for this class's level
  const { data: levelRow } = await supabase
    .from('classes')
    .select('level_id')
    .eq('id', classId)
    .single();

  if (levelRow?.level_id) {
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
    />
  );
}
