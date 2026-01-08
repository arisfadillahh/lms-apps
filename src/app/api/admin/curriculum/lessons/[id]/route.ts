import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { classLessonsDao, lessonTemplatesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { updateLessonTemplateSchema } from '@/lib/validation/admin';
import { normalizeSlideUrl } from '@/lib/slides';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams.id ?? '';
  const lessonId = decodeURIComponent(rawId).trim();
  if (!isValidUuid(lessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const normalizedBody =
    body && typeof body === 'object'
      ? (() => {
          const candidate = { ...(body as Record<string, unknown>) };
          if (typeof candidate.slideUrl === 'string') {
            const normalized = normalizeSlideUrl(candidate.slideUrl);
            if (normalized) {
              candidate.slideUrl = normalized;
            } else {
              delete candidate.slideUrl;
            }
          }
          return candidate;
        })()
      : body;

  const parsed = updateLessonTemplateSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Parameters<typeof lessonTemplatesDao.updateLessonTemplate>[1] = {
    title: parsed.data.title,
    summary: parsed.data.summary ?? null,
    orderIndex: parsed.data.orderIndex,
    durationMinutes: parsed.data.durationMinutes ?? null,
    makeUpInstructions: parsed.data.makeUpInstructions ?? null,
  };

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'slideUrl')) {
    updates.slideUrl = parsed.data.slideUrl ?? null;
  }

  try {
    const lesson = await lessonTemplatesDao.updateLessonTemplate(lessonId, updates);

    if (Object.prototype.hasOwnProperty.call(updates, 'slideUrl')) {
      await classLessonsDao.syncTemplateLessonSlide(lessonId, lesson.slide_url);
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update lesson';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
