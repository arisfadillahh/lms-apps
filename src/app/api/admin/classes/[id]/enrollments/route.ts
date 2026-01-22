/**
 * POST /api/admin/classes/[id]/enrollments
 * Enroll a coder to a class
 */

import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
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

    // Create enrollment
    const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .insert({
            class_id: classId,
            coder_id: body.coderId,
            status: 'ACTIVE',
            enrolled_at: new Date().toISOString()
        })
        .select()
        .single();

    if (enrollError) {
        console.error('[Create Enrollment] Error:', enrollError);
        return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
    }

    // Also update the coder's payment period if they have one without class_id
    await supabase
        .from('coder_payment_periods')
        .update({ class_id: classId })
        .eq('coder_id', body.coderId)
        .is('class_id', null)
        .eq('status', 'ACTIVE');

    return NextResponse.json({ enrollment }, { status: 201 });
}
