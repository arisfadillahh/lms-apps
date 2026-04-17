import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { lessonTemplatesDao } from '@/lib/dao';

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();
        await assertRole(session, 'ADMIN');

        const body = await request.json();
        const { lessonIds } = body;

        if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
            return NextResponse.json({ error: 'Invalid lesson IDs' }, { status: 400 });
        }

        // Capture block_id BEFORE deleting — need it to sync active classes after.
        // Assumes all lessons belong to the same block (enforced by the UI).
        const firstLesson = await lessonTemplatesDao.getLessonTemplateById(lessonIds[0]);
        const blockId = firstLesson?.block_id ?? null;

        await lessonTemplatesDao.deleteLessonTemplatesBulk(lessonIds);

        // Propagate deletion to active classes: remove orphaned class_lessons and rebalance.
        if (blockId) {
            try {
                const { syncClassesForBlockTemplate } = await import('@/lib/services/lessonRebalancer');
                await syncClassesForBlockTemplate(blockId);
            } catch (syncError) {
                console.error('[bulk-delete] Failed to sync classes after deletion:', syncError);
                // Non-fatal: templates are deleted. Orphaned class_lessons will be cleaned next sync.
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Bulk delete error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
