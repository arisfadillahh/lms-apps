import { addWeeks } from 'date-fns';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, classesDao, lessonTemplatesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { createClassSchema } from '@/lib/validation/admin';
import { autoPlanWeeklyClass } from '@/lib/services/classAutoPlanner';

const DEFAULT_CLASS_DURATION_WEEKS = 12;

function computeTentativeEndDate(startDate: string): string {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }
  const tentative = addWeeks(start, DEFAULT_CLASS_DURATION_WEEKS);
  return tentative.toISOString().slice(0, 10);
}

// GET: List all classes
export async function GET() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseServer');
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        type,
        schedule_day,
        schedule_time,
        level_id,
        coach_id,
        levels ( name ),
        users!classes_coach_id_fkey ( full_name )
      `)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    // Transform to include coach_name and level_name
    const classes = (data || []).map((cls: any) => ({
      id: cls.id,
      name: cls.name,
      type: cls.type,
      level_name: cls.levels?.name || null,
      coach_name: cls.users?.full_name || 'Unknown',
      schedule_day: cls.schedule_day,
      schedule_time: cls.schedule_time,
    }));

    return NextResponse.json({ classes });
  } catch (error) {
    console.error('[List Classes] Error:', error);
    return NextResponse.json({ error: 'Failed to list classes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createClassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const start = new Date(input.startDate);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
  }

  let endDate = input.endDate;
  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid end date' }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
    }
    endDate = end.toISOString().slice(0, 10);
  } else {
    endDate = computeTentativeEndDate(input.startDate);
  }

  if (input.type === 'WEEKLY' && !input.levelId) {
    return NextResponse.json({ error: 'levelId is required for weekly classes' }, { status: 400 });
  }

  let initialBlockId: string | undefined;
  let initialLessonId: string | undefined;
  if (input.initialBlockId) {
    if (input.type !== 'WEEKLY') {
      return NextResponse.json({ error: 'initialBlockId is only valid for weekly classes' }, { status: 400 });
    }
    if (!input.levelId) {
      return NextResponse.json({ error: 'levelId is required when specifying initial block' }, { status: 400 });
    }
    const block = await blocksDao.getBlockById(input.initialBlockId);
    if (!block || block.level_id !== input.levelId) {
      return NextResponse.json({ error: 'Initial block does not belong to selected level' }, { status: 400 });
    }
    initialBlockId = block.id;

    // Validate initialLessonId if provided
    if (input.initialLessonId) {
      const lessons = await lessonTemplatesDao.listLessonsByBlock(input.initialBlockId);
      const lessonExists = lessons.some(l => l.id === input.initialLessonId);
      if (!lessonExists) {
        return NextResponse.json({ error: 'Initial lesson does not belong to selected block' }, { status: 400 });
      }
      initialLessonId = input.initialLessonId;
    }
  }

  const created = await classesDao.createClass({
    name: input.name,
    type: input.type,
    levelId: input.levelId ?? null,
    ekskulLessonPlanId: input.ekskulLessonPlanId ?? null,
    coachId: input.coachId,
    scheduleDay: input.scheduleDay,
    scheduleTime: input.scheduleTime,
    zoomLink: input.zoomLink,
    startDate: input.startDate,
    endDate,
  });

  if (created.type === 'WEEKLY') {
    try {
      console.log('[Create Class] Auto planning with initialBlockId:', initialBlockId, 'initialLessonId:', initialLessonId);
      await autoPlanWeeklyClass(created, initialBlockId, initialLessonId);
    } catch (error) {
      console.error('Auto planning weekly class failed', error);
    }
  } else if (created.type === 'EKSKUL') {
    try {
      const { autoPlanEkskulClass } = await import('@/lib/services/classAutoPlanner');
      await autoPlanEkskulClass(created);
    } catch (error) {
      console.error('Auto planning ekskul class failed', error);
    }
  }

  return NextResponse.json({ class: created }, { status: 201 });
}
