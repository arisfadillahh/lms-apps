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

        await lessonTemplatesDao.deleteLessonTemplatesBulk(lessonIds);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Bulk delete error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
