import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow, hashPassword, verifyPassword } from '@/lib/auth';
import { usersDao } from '@/lib/dao';

const schema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  if (session.user.role !== 'CODER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await usersDao.getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isValid = await verifyPassword(parsed.data.currentPassword, user.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 });
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await usersDao.resetUserPassword(user.id, newHash, ['CODER']);

  return NextResponse.json({ success: true });
}
