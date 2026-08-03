import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';

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
        const { archiveLessonSafely } = await import('@/lib/services/lessonArchive');
        const impacts = [];
        for (const lessonId of lessonIds) {
            const result = await archiveLessonSafely(lessonId);
            impacts.push(result.impact);
        }

        return NextResponse.json({ success: true, archived: lessonIds.length, impacts });
    } catch (error) {
        console.error('Bulk delete error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
