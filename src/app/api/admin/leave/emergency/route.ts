import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, sessionsDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const emergencyLeaveSchema = z.object({
    coachId: z.string().uuid(),
    sessionId: z.string().uuid(),
    substituteCoachId: z.string().uuid(),
    note: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = emergencyLeaveSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { coachId, sessionId, substituteCoachId, note } = parsed.data;

    // Validate coach
    const coach = await usersDao.getUserById(coachId);
    if (!coach || coach.role !== 'COACH') {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Validate substitute coach
    const substitute = await usersDao.getUserById(substituteCoachId);
    if (!substitute || substitute.role !== 'COACH') {
        return NextResponse.json({ error: 'Substitute coach not found' }, { status: 404 });
    }

    if (coachId === substituteCoachId) {
        return NextResponse.json({ error: 'Coach and substitute cannot be the same' }, { status: 400 });
    }

    try {
        // Create the emergency leave request (already approved)
        const leaveRequest = await coachLeaveDao.createEmergencyLeaveRequest({
            coachId,
            sessionId,
            substituteCoachId,
            note,
            approvedBy: session.user.id,
        });

        // Assign substitute to the session
        await sessionsDao.assignSubstituteCoach(sessionId, substituteCoachId);

        return NextResponse.json({ success: true, leaveRequest });
    } catch (error: any) {
        console.error('[Emergency Leave] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create emergency leave' }, { status: 500 });
    }
}
