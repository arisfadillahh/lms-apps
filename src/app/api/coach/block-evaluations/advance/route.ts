import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== 'COACH') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { evalSessionId } = await req.json();
  if (!evalSessionId) {
    return NextResponse.json({ error: 'Missing evalSessionId' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: evalSession, error: fetchError } = await (supabase as any)
    .from('block_evaluation_sessions')
    .select('current_question_index,status,class_id,created_by,template_id')
    .eq('id', evalSessionId)
    .single();

  if (fetchError || !evalSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: classRecord } = await supabase.from('classes')
    .select('coach_id')
    .eq('id', evalSession.class_id)
    .maybeSingle();
  if (evalSession.created_by !== session.user.id && classRecord?.coach_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let totalQuestions = 5;
  if (evalSession.template_id) {
    const { data: template } = await supabase.from('block_evaluation_templates')
      .select('questions')
      .eq('id', evalSession.template_id)
      .maybeSingle();
    if (Array.isArray(template?.questions) && template.questions.length > 0) {
      totalQuestions = Math.min(template.questions.length, 100);
    }
  }

  const nextIndex = evalSession.current_question_index + 1;
  const isCompleted = nextIndex >= totalQuestions;

  const { error: updateError } = await (supabase as any)
    .from('block_evaluation_sessions')
    .update({
      current_question_index: isCompleted ? evalSession.current_question_index : nextIndex,
      status: isCompleted ? 'completed' : 'in_progress',
    })
    .eq('id', evalSessionId);

  if (updateError) {
    console.error('Failed to advance eval session:', updateError);
    return NextResponse.json({ error: 'Failed to advance' }, { status: 500 });
  }

  return NextResponse.json({
    current_question_index: isCompleted ? evalSession.current_question_index : nextIndex,
    status: isCompleted ? 'completed' : 'in_progress',
  });
}
