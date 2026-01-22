/**
 * GET /api/admin/curriculum/levels/[id]/blocks
 * List all blocks for a specific level
 */

import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id: levelId } = await context.params;

    if (!levelId) {
        return NextResponse.json({ error: 'Level ID required' }, { status: 400 });
    }

    try {
        const blocks = await blocksDao.listBlocksByLevel(levelId);
        return NextResponse.json({ blocks });
    } catch (error) {
        console.error('[List Blocks by Level] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to list blocks';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
