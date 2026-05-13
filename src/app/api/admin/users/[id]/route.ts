import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import { isSuperAdmin } from '@/lib/permissions';
import { assertRole } from '@/lib/roles';

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const userId = params.id;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const targetUser = await usersDao.getUserById(userId);
        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (targetUser.role === 'ADMIN' && !isSuperAdmin(session.user.username, session.user.adminPermissions ?? null)) {
            return NextResponse.json({ error: 'Only Super Admin can delete admin users' }, { status: 403 });
        }
        await usersDao.deleteUser(userId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Delete user error:', error);
        const message = error instanceof Error ? error.message : 'Failed to delete user';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
