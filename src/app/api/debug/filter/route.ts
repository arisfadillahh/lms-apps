import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { classesDao, classLessonsDao, sessionsDao } from '@/lib/dao';

export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await getServerAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const classId = '23a83a47-b026-4ead-9d26-50ed8a56a5ef'; // Explorer Sabtu
  
  const blocks = await classesDao.getClassBlocks(classId);
  const sessions = await sessionsDao.listSessionsByClass(classId);
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const now = new Date();

  // Find Block 3 (CURRENT)
  const block3 = blocks.find(b => b.status === 'CURRENT');
  if (!block3) return NextResponse.json({ error: 'No CURRENT block', blocks: blocks.map(b => ({ id: b.id, status: b.status, start: b.start_date, end: b.end_date })) });

  const lessons = await classLessonsDao.listLessonsByClassBlock(block3.id);
  const lessonsSorted = [...lessons].sort((a, b) => a.order_index - b.order_index);
  
  const blockStart = new Date(block3.start_date);
  const blockEnd = new Date(new Date(block3.end_date).getTime() + 86400000);

  const blockSessionsSorted = sessions
    .filter(s =>
      new Date(s.date_time) >= blockStart &&
      new Date(s.date_time) <= blockEnd
    )
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

  // Simulate the filter
  const filterResult = lessonsSorted.map((lesson, index) => {
    // CURRENT block logic
    let sessionToCheck: { date_time: string; status: string } | null = null;

    if (lesson.session_id && sessionMap.has(lesson.session_id)) {
      const session = sessionMap.get(lesson.session_id)!;
      const sessionDate = new Date(session.date_time);
      if (sessionDate >= blockStart && sessionDate <= blockEnd) {
        sessionToCheck = session;
      }
    }

    if (!sessionToCheck && index < blockSessionsSorted.length) {
      sessionToCheck = blockSessionsSorted[index];
    }

    let accessible = false;
    let reason = 'no_session';
    if (sessionToCheck) {
      if (sessionToCheck.status === 'COMPLETED') {
        accessible = true;
        reason = 'session_completed';
      } else if (new Date(sessionToCheck.date_time) <= now) {
        accessible = true;
        reason = 'session_past';
      } else {
        reason = 'session_future';
      }
    }

    return {
      index,
      title: lesson.title,
      has_explicit_session: !!lesson.session_id,
      explicit_in_range: lesson.session_id ? (sessionMap.has(lesson.session_id) ? 
        (new Date(sessionMap.get(lesson.session_id)!.date_time) >= blockStart && new Date(sessionMap.get(lesson.session_id)!.date_time) <= blockEnd)
        : false) : false,
      used_fallback: sessionToCheck !== null && (!lesson.session_id || !sessionMap.has(lesson.session_id) || !(new Date(sessionMap.get(lesson.session_id)!.date_time) >= blockStart && new Date(sessionMap.get(lesson.session_id)!.date_time) <= blockEnd)),
      session_date: sessionToCheck?.date_time ?? null,
      session_status: sessionToCheck?.status ?? null,
      accessible,
      reason,
    };
  });

  return NextResponse.json({
    now: now.toISOString(),
    block: { id: block3.id, status: block3.status, start: block3.start_date, end: block3.end_date, name: block3.block_name },
    lessonsTotal: lessonsSorted.length,
    blockSessionsTotal: blockSessionsSorted.length,
    accessibleCount: filterResult.filter(f => f.accessible).length,
    filterResult,
  });
}
