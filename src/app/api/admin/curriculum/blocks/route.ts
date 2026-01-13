import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, blockSoftwareDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { createBlockTemplateSchema } from '@/lib/validation/admin';

const extendedSchema = createBlockTemplateSchema.extend({
  softwareIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = extendedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const block = await blocksDao.createBlock({
    levelId: payload.levelId,
    name: payload.name,
    summary: payload.summary ?? null,
    orderIndex: payload.orderIndex,
    estimatedSessions: payload.estimatedSessions ?? null,
    isPublished: payload.isPublished ?? false,
  });

  // Assign software to block if provided
  if (payload.softwareIds && payload.softwareIds.length > 0) {
    await blockSoftwareDao.setSoftwareForBlock(block.id, payload.softwareIds);
  }

  return NextResponse.json({ block }, { status: 201 });
}

