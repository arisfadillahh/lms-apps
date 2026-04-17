import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const classId = '23a83a47-b026-4ead-9d26-50ed8a56a5ef'; // Explorer Sabtu
  
  // Block 3 (CURRENT): id = df2b2191, start=2026-01-10, end=2026-04-04
  const blockId = 'df2b2191-fb2e-4411-a510-69dc42278774';
  const blockStart = new Date('2026-01-10');
  const blockEnd = new Date(new Date('2026-04-04').getTime() + 86400000);

  // Get sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, date_time, status')
    .eq('class_id', classId)
    .order('date_time');

  // Sessions within block date range
  const blockSessions = sessions?.filter(s =>
    new Date(s.date_time) >= blockStart &&
    new Date(s.date_time) <= blockEnd
  ) || [];

  // Get class_lessons for this block
  const { data: classLessons } = await supabase
    .from('class_lessons')
    .select('id, title, order_index, session_id, unlock_at, lesson_template_id')
    .eq('class_block_id', blockId)
    .order('order_index');

  // Check: which session_ids from class_lessons point to sessions in vs out of block range
  const lessonSessionAnalysis = classLessons?.map((cl, index) => {
    let sessionInRange = false;
    let sessionDate = null;
    let sessionStatus = null;
    
    if (cl.session_id) {
      const session = sessions?.find(s => s.id === cl.session_id);
      if (session) {
        sessionDate = session.date_time;
        sessionStatus = session.status;
        const sd = new Date(session.date_time);
        sessionInRange = sd >= blockStart && sd <= blockEnd;
      }
    }

    // Fallback session (chronological)
    const fallbackSession = index < blockSessions.length ? blockSessions[index] : null;

    return {
      index,
      title: cl.title,
      has_session_id: !!cl.session_id,
      session_in_range: sessionInRange,
      explicit_session_date: sessionDate,
      explicit_session_status: sessionStatus,
      fallback_session_date: fallbackSession?.date_time ?? null,
      fallback_session_status: fallbackSession?.status ?? null,
      has_template: !!cl.lesson_template_id,
    };
  });

  return NextResponse.json({
    blockStart: blockStart.toISOString(),
    blockEnd: blockEnd.toISOString(),
    blockSessionsCount: blockSessions.length,
    blockSessionsDates: blockSessions.map(s => ({
      date: s.date_time,
      local: new Date(s.date_time).toLocaleDateString('id-ID'),
      status: s.status
    })),
    classLessonsCount: classLessons?.length,
    lessonSessionAnalysis,
  });
}
