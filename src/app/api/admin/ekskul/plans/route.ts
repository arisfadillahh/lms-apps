import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const createPlanSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).nullable().optional(),
    softwareIds: z.array(z.string().uuid()).optional().default([]),
});

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Create Plan
    const { data: plan, error: planError } = await supabase
        .from('ekskul_lesson_plans')
        .insert({
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            total_lessons: 0,
            is_active: true,
        })
        .select('*')
        .single();

    if (planError) {
        console.error('[Create Ekskul Plan] Error:', planError);
        return NextResponse.json({ error: `Gagal membuat plan: ${planError.message}` }, { status: 500 });
    }

    // 2. Insert Software Associations
    if (parsed.data.softwareIds.length > 0) {
        const softwareInserts = parsed.data.softwareIds.map(swId => ({
            plan_id: plan.id,
            software_id: swId,
        }));

        const { error: swError } = await supabase
            .from('ekskul_plan_software')
            .insert(softwareInserts);

        if (swError) {
            console.error('[Create Ekskul Plan] Software Insert Error:', swError);
            // Non-fatal, return success but log error? Or fail? 
            // Better to return warning or just log, since plan is created.
        }
    }

    return NextResponse.json({ plan }, { status: 201 });
}

export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('ekskul_lesson_plans')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
    }

    return NextResponse.json(data);
}
