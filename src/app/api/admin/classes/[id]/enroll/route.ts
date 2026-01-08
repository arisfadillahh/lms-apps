import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { enrollCoderSchema } from '@/lib/validation/admin';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams?.id ?? '';
  const classIdParam = decodeURIComponent(rawId).trim();

  if (!classIdParam || !isValidUuid(classIdParam)) {
    return NextResponse.json({ error: 'Invalid class id parameter' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = enrollCoderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const coder = await usersDao.getUserById(parsed.data.coderId);
  if (!coder || coder.role !== 'CODER') {
    return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
  }

  try {
    const enrollment = await classesDao.enrollCoder({
      classId: classIdParam,
      coderId: parsed.data.coderId,
    });

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to enroll coder' }, { status: 400 });
  }
}
