import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, sessionsDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const updateSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  substituteCoachId: z.string().uuid().nullable().optional(),
});

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await coachLeaveDao.getLeaveRequestById(params.id);
  if (!existing) {
    return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  }

  const substituteCoachId = parsed.data.substituteCoachId ?? null;

  if (parsed.data.status === 'APPROVED' && !substituteCoachId) {
    return NextResponse.json({ error: 'Substitute coach is required when approving leave' }, { status: 400 });
  }

  if (substituteCoachId) {
    const substitute = await usersDao.getUserById(substituteCoachId);
    if (!substitute || substitute.role !== 'COACH') {
      return NextResponse.json({ error: 'Substitute must be a valid coach' }, { status: 400 });
    }
  }

  const updated = await coachLeaveDao.updateLeaveRequest(params.id, {
    status: parsed.data.status,
    substituteCoachId,
    approvedBy: session.user.id,
  });

  if (parsed.data.status === 'APPROVED') {
    await sessionsDao.assignSubstituteCoach(existing.session_id, substituteCoachId);
  } else if (parsed.data.status === 'REJECTED') {
    await sessionsDao.assignSubstituteCoach(existing.session_id, null);
  }

  return NextResponse.json({ request: updated });
}
