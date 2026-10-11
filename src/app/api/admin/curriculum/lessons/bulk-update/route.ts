import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, lessonTemplatesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { normalizeSlideUrl } from '@/lib/slides';

const bulkUpdateSchema = z.object({
    updates: z.array(z.object({
        id: z.string().uuid(),
        title: z.string().min(1, "Title is required"),
        summary: z.string().nullable().optional(),
        slideUrl: z.string().nullable().optional(),
        makeUpInstructions: z.string().nullable().optional(),
        estimatedMeetingCount: z.number().int().min(0).nullable().optional(),
        orderIndex: z.number().int().min(0),
    }))
});

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();
        await assertRole(session, 'ADMIN');

        const body = await request.json();

        // Normalizing slide URLs in the input
        if (body.updates && Array.isArray(body.updates)) {
            body.updates = body.updates.map((u: any) => ({
                ...u,
                slideUrl: u.slideUrl ? normalizeSlideUrl(u.slideUrl) : u.slideUrl
            }));
        }

        const parsed = bulkUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        await lessonTemplatesDao.updateLessonTemplatesBulk(parsed.data.updates);

        // Sync changes to active classes (reorder, duration changes etc)
        // We assume all updates are for the same block (UI enforces this)
        if (parsed.data.updates.length > 0) {
            const firstId = parsed.data.updates[0].id;
            const lesson = await lessonTemplatesDao.getLessonTemplateById(firstId);
            if (lesson && lesson.block_id) {
                await blocksDao.updateBlock(lesson.block_id, { isPublished: true });
                const { syncClassesForBlockTemplate } = await import('@/lib/services/lessonRebalancer');
                await syncClassesForBlockTemplate(lesson.block_id);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Bulk Update Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
