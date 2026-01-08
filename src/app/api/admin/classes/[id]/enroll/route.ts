import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, classesDao, coderProgressDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { enrollCoderSchema, updateEnrollmentStatusSchema } from '@/lib/validation/admin';

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

  const klass = await classesDao.getClassById(classIdParam);
  if (!klass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }
  if (!klass.level_id) {
    return NextResponse.json({ error: 'Class level missing' }, { status: 400 });
  }

  const [levelBlocks, classBlocks] = await Promise.all([
    blocksDao.listBlocksByLevel(klass.level_id),
    classesDao.getClassBlocks(classIdParam),
  ]);

  if (levelBlocks.length === 0) {
    return NextResponse.json({ error: 'No curriculum blocks configured for this level' }, { status: 400 });
  }

  try {
    const enrollment = await classesDao.enrollCoder({
      classId: classIdParam,
      coderId: parsed.data.coderId,
    });

    const currentBlockId =
      classBlocks.find((block) => block.status === 'CURRENT')?.block_id ??
      levelBlocks[0]?.id ??
      null;

    await coderProgressDao.ensureJourneyForCoder({
      coderId: parsed.data.coderId,
      levelId: klass.level_id,
      blocks: levelBlocks,
      entryBlockId: currentBlockId,
    });

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to enroll coder' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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
  } catch {
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

  const klass = await classesDao.getClassById(classIdParam);
  if (!klass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  try {
    await classesDao.deleteEnrollment(classIdParam, parsed.data.coderId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to remove enrollment' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateEnrollmentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const coder = await usersDao.getUserById(parsed.data.coderId);
  if (!coder || coder.role !== 'CODER') {
    return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
  }

  try {
    await classesDao.updateEnrollmentStatus(classIdParam, parsed.data.coderId, parsed.data.status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to update enrollment status' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
