import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteParams = { id: string };
type RouteContext = { params: RouteParams | Promise<RouteParams> };

const updateSessionStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'CANCELLED', 'COMPLETED']),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, ['ADMIN', 'COACH']);

  const params = await context.params;
  const sessionId = params.id;

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateSessionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await sessionsDao.updateSessionStatus(sessionId, parsed.data.status);
  } catch (error) {
    console.error('Failed to update session status', error);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
