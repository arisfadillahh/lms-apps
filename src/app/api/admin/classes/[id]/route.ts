import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const params = await context.params;
  const classId = params.id;

  if (!classId) {
    return NextResponse.json({ error: 'Invalid class id' }, { status: 400 });
  }

  try {
    await classesDao.deleteClass(classId);
  } catch (error) {
    console.error('Failed to delete class', error);
    return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
