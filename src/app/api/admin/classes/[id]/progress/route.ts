import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = {
    params: Promise<{ id: string }>;
};

// Re-export PATCH because we are in the same route file structure
// Next.js App Router allows multiple methods in one file
export { PATCH } from './bypass/route';
// WAIT: The component fetches from `/api/admin/classes/:id/progress`, NOT `/api/admin/classes/:id/progress/bypass`.
// I should put the GET in `progress/route.ts` OR change the fetch URL.
// The PATCH was in `progress/bypass/route.ts`. 
// It is cleaner to have `progress/route.ts` handle GET (fetch generic) and maybe PATCH (update generic).
// But for now, I'll create `src/app/api/admin/classes/[id]/progress/route.ts` processing GET.

export async function GET(request: NextRequest, context: RouteContext) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const coderId = searchParams.get('coderId');

    const resolvedParams = await context.params;
    const classId = resolvedParams.id;

    if (!classId || !coderId) {
        return NextResponse.json({ error: 'Missing classId or coderId' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get Level ID
    const { data: classData } = await supabase
        .from('classes')
        .select('level_id')
        .eq('id', classId)
        .single();

    if (!classData?.level_id) {
        return NextResponse.json({ error: 'Class level not found' }, { status: 404 });
    }

    // 2. Fetch Journey with Block Names
    const { data: journey, error } = await supabase
        .from('coder_block_progress')
        .select(`
      block_id,
      status,
      journey_order,
      blocks!inner (
        name
      )
    `)
        .eq('coder_id', coderId)
        .eq('level_id', classData.level_id)
        .order('journey_order', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format
    const formatted = (journey || []).map((row: any) => ({
        block_id: row.block_id,
        block_name: row.blocks?.name ?? 'Unknown Block',
        status: row.status,
        journey_order: row.journey_order
    }));

    return NextResponse.json({ journey: formatted });
}
