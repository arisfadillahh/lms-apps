import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { sessionsDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { assignSubstituteSchema } from '@/lib/validation/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = assignSubstituteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { substituteCoachId } = parsed.data;

  if (substituteCoachId) {
    const substitute = await usersDao.getUserById(substituteCoachId);
    if (!substitute || substitute.role !== 'COACH') {
      return NextResponse.json({ error: 'Substitute coach must be an active coach user' }, { status: 400 });
    }
  }

  await sessionsDao.assignSubstituteCoach(params.id, substituteCoachId ?? null);
  return NextResponse.json({ success: true });
}
