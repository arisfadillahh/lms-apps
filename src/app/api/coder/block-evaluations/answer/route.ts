import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== 'CODER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { evalSessionId, questionId, questionIndex, answer } = await req.json();
  if (!evalSessionId || !questionId || answer === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: evalSession, error: evalSessionError } = await (supabase as any)
    .from('block_evaluation_sessions')
    .select('class_id, status')
    .eq('id', evalSessionId)
    .maybeSingle();

  if (evalSessionError) {
    console.error('Failed to validate eval session:', evalSessionError);
    return NextResponse.json({ error: 'Failed to validate evaluation session' }, { status: 500 });
  }

  if (!evalSession || evalSession.status !== 'in_progress') {
    return NextResponse.json({ error: 'Evaluation session not found' }, { status: 404 });
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('class_id', evalSession.class_id)
    .eq('coder_id', session.user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (enrollmentError) {
    console.error('Failed to validate evaluation enrollment:', enrollmentError);
    return NextResponse.json({ error: 'Failed to validate enrollment' }, { status: 500 });
  }

  if (!enrollment) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await (supabase as any)
    .from('block_evaluation_answers')
    .upsert({
      eval_session_id: evalSessionId,
      coder_id: session.user.id,
      question_id: questionId,
      question_index: questionIndex ?? 0,
      answer,
      answered_at: new Date().toISOString(),
    }, {
      onConflict: 'eval_session_id,coder_id,question_id',
    });

  if (error) {
    console.error('Failed to save answer:', error);
    return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
