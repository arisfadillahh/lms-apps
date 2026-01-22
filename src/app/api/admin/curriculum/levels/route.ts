import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { levelsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const createLevelSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).nullable().optional(),
});

// GET: List all levels
export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    try {
        const levels = await levelsDao.listLevels();
        return NextResponse.json({ levels });
    } catch (error) {
        console.error('[List Levels] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to list levels';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createLevelSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    try {
        // Get the max order_index and add 1
        const levels = await levelsDao.listLevels();
        const maxOrder = levels.reduce((max, l) => Math.max(max, l.order_index), 0);

        const level = await levelsDao.createLevel({
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            orderIndex: maxOrder + 1,
        });

        return NextResponse.json({ level }, { status: 201 });
    } catch (error) {
        console.error('[Create Level] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to create level';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
