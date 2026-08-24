import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { z } from 'zod';

const startSchema = z.object({
  sessionId: z.string().uuid(),
  classId: z.string().uuid(),
  blockId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== 'COACH') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid evaluation input' }, { status: 400 });
  const { sessionId, classId, blockId, templateId } = parsed.data;

  const supabase = getSupabaseAdmin();

  const [{ data: classRecord }, { data: classSession }, { data: classBlock }] = await Promise.all([
    supabase.from('classes').select('id,coach_id').eq('id', classId).maybeSingle(),
    supabase.from('sessions').select('id').eq('id', sessionId).eq('class_id', classId).maybeSingle(),
    supabase.from('class_blocks').select('id').eq('class_id', classId).eq('block_id', blockId).maybeSingle(),
  ]);
  if (!classRecord || classRecord.coach_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!classSession || !classBlock) {
    return NextResponse.json({ error: 'Session or block does not belong to this class' }, { status: 400 });
  }

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
