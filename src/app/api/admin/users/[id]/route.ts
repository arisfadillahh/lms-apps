import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteContext = {
    params: { id: string };
};

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const userId = params.id;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        await usersDao.deleteUser(userId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 });
    }
}
