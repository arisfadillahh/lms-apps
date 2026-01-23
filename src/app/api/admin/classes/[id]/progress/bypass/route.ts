import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const bypassSchema = z.object({
    coderId: z.string().uuid(),
    completedBlockIds: z.array(z.string().uuid()),
});

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const resolvedParams = await context.params;
    const classId = resolvedParams.id;

    if (!classId) {
        return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = bypassSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { coderId, completedBlockIds } = parsed.data;
    const supabase = getSupabaseAdmin();

    // 1. Get Class Level to ensure we only touch blocks in this level
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('level_id')
        .eq('id', classId)
        .single();

    if (classError || !classData) {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const levelId = classData.level_id;
    if (!levelId) {
        return NextResponse.json({ error: 'Class has no level assigned' }, { status: 400 });
    }

    // 2. Fetch current journey to get IDs and order
    const { data: journey, error: journeyError } = await supabase
        .from('coder_block_progress')
        .select('id, block_id, journey_order')
        .eq('coder_id', coderId)
        .eq('level_id', levelId)
        .order('journey_order', { ascending: true });

    if (journeyError) {
        return NextResponse.json({ error: 'Failed to fetch journey' }, { status: 500 });
    }

    if (!journey || journey.length === 0) {
        return NextResponse.json({ error: 'Coder has no journey in this level' }, { status: 404 });
    }

    // 3. Update Statues
    // - If in completedBlockIds -> COMPLETED
    // - If first non-completed -> IN_PROGRESS
    // - Else -> PENDING

    const updates = [];
    let foundInProgress = false;
    const completedSet = new Set(completedBlockIds);

    for (const item of journey) {
        let newStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' = 'PENDING';

        if (completedSet.has(item.block_id)) {
            newStatus = 'COMPLETED';
        } else if (!foundInProgress) {
            newStatus = 'IN_PROGRESS';
            foundInProgress = true;
        } else {
            newStatus = 'PENDING';
        }

        updates.push({
            id: item.id,
            coder_id: coderId,
            level_id: levelId,
            block_id: item.block_id,
            journey_order: item.journey_order,
            status: newStatus,
            completed_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        });
    }

    // Perform updates
    // Supabase upsert/update options. Since we have IDs, we can use upsert or explicit updates.
    // Batch upsert is efficient.
    const { error: updateError } = await supabase
        .from('coder_block_progress')
        .upsert(updates);

    if (updateError) {
        return NextResponse.json({ error: `Failed to update progress: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
