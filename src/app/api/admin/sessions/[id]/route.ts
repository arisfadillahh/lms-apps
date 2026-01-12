
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteParams = { id: string };
type RouteContext = { params: RouteParams | Promise<RouteParams> };

const updateSessionSchema = z.object({
    date_time: z.string().datetime(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const session = await getSessionOrThrow();
        await assertRole(session, 'ADMIN');

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

        console.log(`[PATCH Session] Updating session ${sessionId}`, body);

        const parsed = updateSessionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const updated = await sessionsDao.updateSession(sessionId, { date_time: parsed.data.date_time });

        return NextResponse.json({ success: true, session: updated });
    } catch (error) {
        console.error('Error updating session:', error);
        // Be careful not to expose internal errors if strict, but 'error.message' is useful for auth
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
