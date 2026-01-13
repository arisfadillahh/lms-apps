import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, lessonTemplatesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { createLessonTemplateSchema } from '@/lib/validation/admin';
import { normalizeSlideUrl } from '@/lib/slides';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const { id } = await context.params;
  const rawBlockId = id ?? '';
  const blockId = decodeURIComponent(rawBlockId).trim();
  if (!blockId || !isValidUuid(blockId)) {
    return NextResponse.json({ error: 'Invalid block id' }, { status: 400 });
  }

  const block = await blocksDao.getBlockById(blockId);
  if (!block) {
    return NextResponse.json({ error: 'Block tidak ditemukan' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const normalizedInput =
    body && typeof body === 'object'
      ? (() => {
        const candidate = { ...(body as Record<string, unknown>) };
        if (typeof candidate.slideUrl === 'string') {
          const normalized = normalizeSlideUrl(candidate.slideUrl);
          candidate.slideUrl = normalized ?? undefined;
        }
        return candidate;
      })()
      : body;

  const parsed = createLessonTemplateSchema.safeParse({
    ...normalizedInput,
    blockId,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const lesson = await lessonTemplatesDao.createLessonTemplate({
      blockId: parsed.data.blockId,
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      slideUrl: parsed.data.slideUrl || null,
      exampleUrl: null, // Initialize as null
      exampleStoragePath: null, // Initialize as null
      orderIndex: parsed.data.orderIndex,
      estimatedMeetingCount: parsed.data.estimatedMeetingCount ?? null,
      makeUpInstructions: parsed.data.makeUpInstructions || null,
    });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
