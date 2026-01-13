import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { updateBlockTemplateSchema } from '@/lib/validation/admin';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateBlockTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const block = await blocksDao.updateBlock(id, {
      name: parsed.data.name,
      summary: parsed.data.summary ?? null,
      orderIndex: parsed.data.orderIndex,
      estimatedSessions: parsed.data.estimatedSessions ?? null,
      isPublished: parsed.data.isPublished,
    });

    return NextResponse.json({ block });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to update block' }, { status: 400 });
  }
}
