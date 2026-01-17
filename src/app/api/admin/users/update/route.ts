import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
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

    // Security check: Only superadmin (username 'admin') can update permissions
    // And they can only update permissions provided the target is also an ADMIN (though the UI handles this, strictly enforcing here is good)
    // For now, simplistically check if adminPermissions is present
    if (parsed.data.adminPermissions && session.user.username !== 'admin') {
        return NextResponse.json({ error: 'Only Super Admin can update permissions' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

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
