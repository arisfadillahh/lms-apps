import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, lessonTemplatesDao } from '@/lib/dao';
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

  const updates: Parameters<typeof lessonTemplatesDao.updateLessonTemplate>[1] = {};

  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (Object.prototype.hasOwnProperty.call(parsed.data, 'summary')) updates.summary = parsed.data.summary ?? null;
  if (parsed.data.orderIndex !== undefined) updates.orderIndex = parsed.data.orderIndex;

  // For nullable meeting count, checking undefined is key (null is a valid value for "clear")
  if (Object.prototype.hasOwnProperty.call(parsed.data, 'estimatedMeetingCount')) {
    updates.estimatedMeetingCount = parsed.data.estimatedMeetingCount ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'makeUpInstructions')) {
    updates.makeUpInstructions = parsed.data.makeUpInstructions ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'slideUrl')) {
    updates.slideUrl = parsed.data.slideUrl ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'exampleUrl')) {
    updates.exampleUrl = (parsed.data as any).exampleUrl ?? null;
    updates.exampleStoragePath = null;
  }

  try {
    const hasContentUpdate =
      Object.prototype.hasOwnProperty.call(updates, 'title') ||
      Object.prototype.hasOwnProperty.call(updates, 'summary') ||
      Object.prototype.hasOwnProperty.call(updates, 'makeUpInstructions') ||
      Object.prototype.hasOwnProperty.call(updates, 'slideUrl') ||
      Object.prototype.hasOwnProperty.call(updates, 'exampleUrl') ||
      Object.prototype.hasOwnProperty.call(updates, 'exampleStoragePath');
    const requiresStructureSync =
      Object.prototype.hasOwnProperty.call(updates, 'orderIndex') ||
      Object.prototype.hasOwnProperty.call(updates, 'estimatedMeetingCount');

    const lesson = await lessonTemplatesDao.updateLessonTemplate(lessonId, updates);

    if ((requiresStructureSync || hasContentUpdate) && lesson.block_id) {
      await blocksDao.updateBlock(lesson.block_id, { isPublished: true });
      const { syncClassesForBlockTemplate } = await import('@/lib/services/lessonRebalancer');
      await syncClassesForBlockTemplate(lesson.block_id);
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update lesson';
    return NextResponse.json({ error: message }, { status: 400 });
  }

}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams.id ?? '';
  const lessonId = decodeURIComponent(rawId).trim();

  if (!isValidUuid(lessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  try {
    // Capture block_id BEFORE deleting — it won't be accessible after.
    const { archiveLessonSafely } = await import('@/lib/services/lessonArchive');
    const result = await archiveLessonSafely(lessonId);
    return NextResponse.json({ success: true, archived: true, impact: result.impact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to archive lesson';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
