import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { createClassSchema } from '@/lib/validation/admin';
import { autoPlanWeeklyClass } from '@/lib/services/classAutoPlanner';

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
  const end = new Date(input.endDate);
  if (start > end) {
    return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
  }

  if (input.type === 'WEEKLY' && !input.levelId) {
    return NextResponse.json({ error: 'levelId is required for weekly classes' }, { status: 400 });
  }

  const created = await classesDao.createClass({
    name: input.name,
    type: input.type,
    levelId: input.levelId ?? null,
    coachId: input.coachId,
    scheduleDay: input.scheduleDay,
    scheduleTime: input.scheduleTime,
    zoomLink: input.zoomLink,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (created.type === 'WEEKLY') {
    try {
      await autoPlanWeeklyClass(created);
    } catch (error) {
      console.error('Auto planning weekly class failed', error);
    }
  }

  return NextResponse.json({ class: created }, { status: 201 });
}
