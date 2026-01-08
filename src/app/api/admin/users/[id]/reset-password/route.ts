import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow, hashPassword } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { resetPasswordSchema } from '@/lib/validation/admin';
import type { Role } from '@/types/supabase';

const RESETTABLE_ROLES: Role[] = ['CODER', 'COACH'];

interface RouteContext {
  params: { id: string };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const userId = context.params.id;
  const user = await usersDao.getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!RESETTABLE_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Only coder and coach passwords can be reset via this endpoint' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await usersDao.resetUserPassword(userId, passwordHash, [user.role]);

  return NextResponse.json({ success: true });
}
