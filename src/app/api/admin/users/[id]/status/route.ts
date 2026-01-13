import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { updateUserStatusSchema } from '@/lib/validation/admin';

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  console.log('[API] PATCH User Status:', params.id);
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const userId = params.id;
    const user = await usersDao.getUserById(userId);
    if (!user) {
      console.log('[API] User not found:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateUserStatusSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[API] Validation failed:', parsed.error);
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    console.log('[API] Updating status to:', parsed.data.isActive);
    await usersDao.setActive(userId, parsed.data.isActive);

    console.log('[API] Status updated successfully');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error updating user status:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
