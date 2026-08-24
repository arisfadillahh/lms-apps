import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const session = await getSessionOrThrow();
  if (session.user.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const evalSessionId = new URL(request.url).searchParams.get('evalSessionId');
  if (!evalSessionId) return NextResponse.json({ error: 'Missing evalSessionId' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: evalSession, error } = await (supabase as any)
    .from('block_evaluation_sessions')
    .select('id,class_id,created_by,current_question_index,status')
    .eq('id', evalSessionId)
    .maybeSingle();
  if (error) throw error;
  if (!evalSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const { data: classRecord } = await supabase.from('classes')
    .select('coach_id')
    .eq('id', evalSession.class_id)
    .maybeSingle();
  if (evalSession.created_by !== session.user.id && classRecord?.coach_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const questionId = new URL(request.url).searchParams.get('questionId');
  let answeredCoderIds: string[] = [];
  if (questionId) {
    const { data: answers, error: answersError } = await (supabase as any)
      .from('block_evaluation_answers')
      .select('coder_id')
      .eq('eval_session_id', evalSessionId)
      .eq('question_id', questionId);
    if (answersError) throw answersError;
    const rows = (answers ?? []) as Array<{ coder_id: string }>;
    answeredCoderIds = [...new Set(rows.map((answer) => answer.coder_id))];
  }

  return NextResponse.json({
    currentQuestionIndex: evalSession.current_question_index,
    status: evalSession.status,
    answeredCoderIds,
  });
}
