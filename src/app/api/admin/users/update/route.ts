import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/permissions';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const updateUserSchema = z.object({
    id: z.string().uuid(),
    fullName: z.string().min(1).max(100),
    parentContactPhone: z.string().nullable().optional(),
    adminPermissions: z.object({
        menus: z.array(z.string()),
        is_superadmin: z.boolean(),
    }).nullable().optional(),
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

    const superAdmin = isSuperAdmin(session.user.username, session.user.adminPermissions ?? null);
    if (parsed.data.adminPermissions !== undefined && !superAdmin) {
        return NextResponse.json({ error: 'Only Super Admin can update permissions' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: targetUser, error: targetError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', parsed.data.id)
        .maybeSingle();

    if (targetError) {
        console.error('[Update User] Failed to fetch target user:', targetError);
        return NextResponse.json({ error: 'Unable to fetch target user' }, { status: 500 });
    }

    if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (parsed.data.adminPermissions !== undefined && targetUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Permissions can only be set for admin users' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
        full_name: parsed.data.fullName,
    };

    if (parsed.data.parentContactPhone !== undefined) {
        updateData.parent_contact_phone = parsed.data.parentContactPhone;
    }

    if (parsed.data.adminPermissions !== undefined) {
        updateData.admin_permissions = parsed.data.adminPermissions;
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
