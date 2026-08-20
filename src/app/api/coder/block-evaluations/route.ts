import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { classId, blockId, sessionId, answers, templateId } = await req.json();

    if (!classId || !blockId || !sessionId || !answers) {
      return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('class_id', classId)
      .eq('coder_id', session.user.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (enrollmentError) {
      console.error('[block-evaluations POST] Enrollment check failed:', enrollmentError);
      return NextResponse.json({ error: 'Gagal memvalidasi akses kelas.' }, { status: 500 });
    }

    if (!enrollment) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: lessonAccess, error: lessonAccessError } = await supabase
      .from('class_lessons')
      .select('id, class_blocks!inner(id)')
      .eq('session_id', sessionId)
      .eq('class_blocks.class_id', classId)
      .eq('class_blocks.block_id', blockId)
      .maybeSingle();

    if (lessonAccessError) {
      console.error('[block-evaluations POST] Lesson access check failed:', lessonAccessError);
      return NextResponse.json({ error: 'Gagal memvalidasi akses sesi.' }, { status: 500 });
    }

    if (!lessonAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('block_evaluations')
      .select('id')
      .eq('coder_id', session.user.id)
      .eq('class_id', classId)
      .eq('block_id', blockId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existing) {
      // Already submitted — return success so the UI navigates away cleanly
      return NextResponse.json({ id: existing.id, alreadySubmitted: true });
    }

    const { data, error } = await supabase
      .from('block_evaluations')
      .insert({
        coder_id: session.user.id,
        class_id: classId,
        block_id: blockId,
        session_id: sessionId,
        template_id: templateId ?? null,
        answers,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[block-evaluations POST]', error);
      return NextResponse.json({ error: 'Gagal menyimpan evaluasi.' }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (e) {
    console.error('[block-evaluations POST] Unexpected:', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const blockId = searchParams.get('blockId');
    const sessionId = searchParams.get('sessionId');
    const serverTime = new Date().toISOString();

    if (!blockId) {
      return NextResponse.json({ submitted: false, serverTime });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('block_evaluations')
      .select('id')
      .eq('coder_id', session.user.id)
      .eq('block_id', blockId);

    if (classId) {
      query = query.eq('class_id', classId);
    }
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data } = await query.maybeSingle();

    return NextResponse.json({ submitted: !!data, id: data?.id ?? null, serverTime });
  } catch (e) {
    console.error('[block-evaluations GET] Unexpected:', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
