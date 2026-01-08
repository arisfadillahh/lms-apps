"use server";

import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { levelsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams.id ?? '';
  const levelId = decodeURIComponent(rawId).trim();

  if (!isValidUuid(levelId)) {
    return NextResponse.json({ error: 'Invalid level id' }, { status: 400 });
  }

  try {
    await levelsDao.deleteLevel(levelId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete level';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
