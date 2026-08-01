/**
 * POST /api/admin/classes/[id]/enrollments
 * Enroll a coder to a class
 */

import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id: classId } = await context.params;

    let body: { coderId?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.coderId) {
        return NextResponse.json({ error: 'coderId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if class exists
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('id', classId)
        .single();

    if (classError || !classData) {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('class_id', classId)
        .eq('coder_id', body.coderId)
        .eq('status', 'ACTIVE')
        .single();

    if (existingEnrollment) {
        return NextResponse.json({ error: 'Coder already enrolled in this class' }, { status: 400 });
    }

    let enrollment;
    try {
        enrollment = await classesDao.enrollCoder({
            classId,
            coderId: body.coderId,
            syncActivePaymentPeriod: true,
        });
    } catch (error) {
        console.error('[Create Enrollment] Error:', error);
        return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
    }

    return NextResponse.json({ enrollment }, { status: 201 });
}
