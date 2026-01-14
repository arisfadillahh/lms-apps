import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const updatePlanSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).nullable().optional(),
    softwareIds: z.array(z.string().uuid()).optional().default([]),
    is_active: z.boolean().optional(),
});

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const resolvedParams = await params;
    const planId = resolvedParams.id;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Update Plan Details
    const { error: updateError } = await supabase
        .from('ekskul_lesson_plans')
        .update({
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            is_active: parsed.data.is_active,
            updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

    if (updateError) {
        return NextResponse.json({ error: `Gagal update plan: ${updateError.message}` }, { status: 500 });
    }

    // 2. Update Software Associations (Full Replace)
    // Delete existing
    const { error: deleteSwError } = await supabase
        .from('ekskul_plan_software')
        .delete()
        .eq('plan_id', planId);

    if (deleteSwError) {
        console.error('Error clearing old software:', deleteSwError);
        return NextResponse.json({ error: 'Gagal update software list' }, { status: 500 });
    }

    // Insert new
    if (parsed.data.softwareIds.length > 0) {
        const softwareInserts = parsed.data.softwareIds.map(swId => ({
            plan_id: planId,
            software_id: swId,
        }));

        const { error: insertSwError } = await supabase
            .from('ekskul_plan_software')
            .insert(softwareInserts);

        if (insertSwError) {
            console.error('Error inserting new software:', insertSwError);
            return NextResponse.json({ error: 'Gagal menyimpan software baru' }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const resolvedParams = await params;
    const planId = resolvedParams.id;

    const supabase = getSupabaseAdmin();

    // Check if used? (Optional, but DB cascade might handle it or restrict it)
    // Let's rely on DB integrity or simple delete.

    // Manual check for safety if needed, but for now direct delete.
    const { error } = await supabase
        .from('ekskul_lesson_plans')
        .delete()
        .eq('id', planId);

    if (error) {
        return NextResponse.json({ error: `Gagal menghapus plan: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
