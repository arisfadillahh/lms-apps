import { getSessionOrThrow } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import CoachPresenterClient from './CoachPresenterClient';

interface PageProps {
  params: Promise<{ evalSessionId: string }>;
}

export default async function CoachPresenterPage({ params }: PageProps) {
  const session = await getSessionOrThrow();
  if (session.user.role !== 'COACH') {
    return <div>Unauthorized. Only Coaches can present evaluations.</div>;
  }

  const { evalSessionId } = await params;

  const supabase = getSupabaseAdmin();

  // Fetch Eval Session
  const { data: evalSession, error: evalErr } = await (supabase as any)
    .from('block_evaluation_sessions')
    .select('*')
    .eq('id', evalSessionId)
    .single();

  if (evalErr || !evalSession) {
    return <div>Evaluation session not found.</div>;
  }

  const { data: classRecord } = await supabase.from('classes')
    .select('coach_id')
    .eq('id', evalSession.class_id)
    .maybeSingle();
  if (evalSession.created_by !== session.user.id && classRecord?.coach_id !== session.user.id) {
    return <div>Forbidden. Evaluation session is not assigned to this Coach.</div>;
  }

  // Fetch questions (either from template or fallback)
  let questions: any[] = [];
  if (evalSession.template_id) {
    const { data: tmpl } = await supabase
      .from('block_evaluation_templates')
      .select('questions')
      .eq('id', evalSession.template_id)
      .single();
    if (tmpl) questions = typeof tmpl.questions === 'string' ? JSON.parse(tmpl.questions) : tmpl.questions;
  }
  
  // Hardcoded fallback if no questions found in DB
  if (!questions || questions.length === 0) {
    questions = [
      { id: "q1", question: "Apa hal baru yang paling kamu sukai dari block ini?", hint: "Ceritakan hal yang paling seru!", placeholder: "..." },
      { id: "q2", question: "Di bagian mana kamu merasa paling kesulitan?", hint: "Gapapa susah juga!", placeholder: "..." },
      { id: "q3", "question": "Apa yang sudah berhasil kamu buat di block ini?", hint: "Fitur/game baru?", placeholder: "..." },
      { id: "q4", "question": "Apa yang pengen kamu pelajari lebih lanjut?", hint: "Ada yang bikin penasaran?", placeholder: "..." },
      { id: "q5", "question": "Pesan untuk dirimu di block depan:", hint: "Semangat terus!", placeholder: "..." }
    ];
  }

  // Fetch Coders enrolled in this class
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('coder_id')
    .eq('class_id', evalSession.class_id)
    .eq('status', 'ACTIVE');

  const coderIds = enrollments?.map((e: any) => e.coder_id) || [];
  
  let coders: any[] = [];
  if (coderIds.length > 0) {
    const { data: userData } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', coderIds);
    coders = userData || [];
  }

  // Fetch Coach Name
  const { data: coachData } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', evalSession.created_by)
    .single();

  return (
    <CoachPresenterClient
      evalSessionId={evalSessionId}
      initialIndex={evalSession.current_question_index}
      initialStatus={evalSession.status}
      questions={questions}
      coders={coders}
      coachName={coachData?.full_name || 'Coach'}
    />
  );
}
