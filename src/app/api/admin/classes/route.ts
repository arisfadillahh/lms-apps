import { addWeeks } from 'date-fns';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, classesDao } from '@/lib/dao';
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
      await autoPlanWeeklyClass(created, initialBlockId);
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
