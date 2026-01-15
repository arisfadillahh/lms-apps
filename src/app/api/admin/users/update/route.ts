import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const updateUserSchema = z.object({
    id: z.string().uuid(),
    fullName: z.string().min(1).max(100),
    parentContactPhone: z.string().nullable().optional(),
});

export async function PUT(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const updateData: Record<string, unknown> = {
        full_name: parsed.data.fullName,
    };

    if (parsed.data.parentContactPhone !== undefined) {
        updateData.parent_contact_phone = parsed.data.parentContactPhone;
    }

    const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', parsed.data.id)
        .select('*')
        .single();

    if (error) {
        console.error('[Update User] Error:', error);
        return NextResponse.json({ error: 'Gagal mengupdate user' }, { status: 500 });
    }

    return NextResponse.json({ user: data });
}
