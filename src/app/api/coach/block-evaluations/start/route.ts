import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== 'COACH') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, classId, blockId, templateId } = await req.json();
  if (!sessionId || !classId || !blockId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await (supabase as any)
    .from('block_evaluation_sessions')
    .select('id, status')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ evalSessionId: existing.id, status: existing.status });
  }

  const { data: newSession, error } = await (supabase as any)
    .from('block_evaluation_sessions')
    .insert({
      class_id: classId,
      block_id: blockId,
      session_id: sessionId,
      template_id: templateId ?? null,
      current_question_index: -1,
      status: 'in_progress',
      created_by: session.user.id,
    })
    .select('id')
    .single();

  if (error || !newSession) {
    console.error('Failed to start eval session:', error ? JSON.stringify(error, null, 2) : 'No session returned');
    return NextResponse.json({ error: 'Failed to start evaluation session', details: error }, { status: 500 });
  }

  return NextResponse.json({ evalSessionId: newSession.id, status: 'in_progress' });
}
