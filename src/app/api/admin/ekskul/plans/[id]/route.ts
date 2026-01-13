import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteParams = {
    params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, { params }: RouteParams) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const resolvedParams = await params;
    const planId = resolvedParams.id;

    const supabase = getSupabaseAdmin();

    // Delete plan (lessons will cascade delete if FK set up)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('ekskul_lesson_plans')
        .delete()
        .eq('id', planId);

    if (error) {
        console.error('[Delete Ekskul Plan] Error:', error);
        return NextResponse.json({ error: 'Gagal menghapus plan' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
