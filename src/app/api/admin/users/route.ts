import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow, hashPassword } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { createUserSchema } from '@/lib/validation/admin';

export async function POST(request: NextRequest) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const bodyData = body as Record<string, unknown>;
  const adminPermissions = bodyData.adminPermissions as { menus: string[]; is_superadmin: boolean } | null | undefined;

  const existing = await usersDao.getUserByUsername(input.username);
  if (existing) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(input.password);
  const user = await usersDao.createUser({
    username: input.username,
    passwordHash,
    role: input.role,
    fullName: input.fullName,
    parentContactPhone: input.parentContactPhone,
    isActive: input.isActive,
    adminPermissions: input.role === 'ADMIN' ? (adminPermissions ?? null) : null,
  });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
        parentContactPhone: user.parent_contact_phone,
        createdAt: user.created_at,
      },
    },
    { status: 201 },
  );
}
