import * as lessonTemplatesDao from '@/lib/dao/lessonTemplatesDao';
import { shouldPreserveArchivedClassLesson } from '@/lib/services/lessonArchivePolicy';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export type LessonArchiveImpact = {
  preservedHistoricalLessons: number;
  removedFutureLessons: number;
  reflowedClasses: number;
};

export async function archiveLessonSafely(lessonId: string): Promise<{
  lesson: Awaited<ReturnType<typeof lessonTemplatesDao.archiveLessonTemplate>>;
  impact: LessonArchiveImpact;
}> {
  const lesson = await lessonTemplatesDao.archiveLessonTemplate(lessonId);
  const supabase = getSupabaseAdmin();
  const { data: classLessons, error: classLessonsError } = await supabase
    .from('class_lessons')
    .select('id, class_block_id, session_id')
    .eq('lesson_template_id', lessonId);

  if (classLessonsError) {
    throw new Error(`Failed to inspect assigned class lessons: ${classLessonsError.message}`);
  }

  if (!classLessons || classLessons.length === 0) {
    return {
      lesson,
      impact: { preservedHistoricalLessons: 0, removedFutureLessons: 0, reflowedClasses: 0 },
    };
  }

  const classBlockIds = Array.from(new Set(classLessons.map((item) => item.class_block_id)));
  const sessionIds = Array.from(new Set(classLessons.map((item) => item.session_id).filter((id): id is string => Boolean(id))));
  const classLessonIds = classLessons.map((item) => item.id);

  const [{ data: classBlocks, error: classBlocksError }, sessionResult, makeUpResult] = await Promise.all([
    supabase.from('class_blocks').select('id, class_id, status').in('id', classBlockIds),
    sessionIds.length > 0
      ? supabase.from('sessions').select('id, date_time, status').in('id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('make_up_tasks').select('class_lesson_id').in('class_lesson_id', classLessonIds),
  ]);

  if (classBlocksError) throw new Error(`Failed to inspect class blocks: ${classBlocksError.message}`);
  if (sessionResult.error) throw new Error(`Failed to inspect lesson sessions: ${sessionResult.error.message}`);
  if (makeUpResult.error) throw new Error(`Failed to inspect make-up tasks: ${makeUpResult.error.message}`);

  const blockById = new Map((classBlocks ?? []).map((item) => [item.id, item]));
  const sessionById = new Map((sessionResult.data ?? []).map((item) => [item.id, item]));
  const lessonsWithMakeUp = new Set((makeUpResult.data ?? []).map((item) => item.class_lesson_id));
  const removableIds: string[] = [];
  const impactedClassIds = new Set<string>();
  let preservedHistoricalLessons = 0;
  const now = new Date();

  for (const classLesson of classLessons) {
    const block = blockById.get(classLesson.class_block_id);
    if (!block) {
      preservedHistoricalLessons += 1;
      continue;
    }
    const session = classLesson.session_id ? sessionById.get(classLesson.session_id) : null;
    const preserve = shouldPreserveArchivedClassLesson({
      blockStatus: block.status,
      hasMakeUpTask: lessonsWithMakeUp.has(classLesson.id),
      sessionDateTime: session?.date_time ?? null,
      sessionStatus: session?.status ?? null,
    }, now);

    if (preserve) {
      preservedHistoricalLessons += 1;
      continue;
    }

    removableIds.push(classLesson.id);
    if (block.status === 'CURRENT' || block.status === 'UPCOMING') {
      impactedClassIds.add(block.class_id);
    }
  }

  if (removableIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('class_lessons')
      .delete()
      .in('id', removableIds);
    if (deleteError) {
      throw new Error(`Failed to remove future lesson assignments: ${deleteError.message}`);
    }
  }

  if (impactedClassIds.size > 0) {
    const { autoAssignLessonsForClass } = await import('@/lib/services/lessonAutoAssign');
    for (const classId of impactedClassIds) {
      await autoAssignLessonsForClass(classId, { mode: 'rebuild_future' });
    }
  }

  return {
    lesson,
    impact: {
      preservedHistoricalLessons,
      removedFutureLessons: removableIds.length,
      reflowedClasses: impactedClassIds.size,
    },
  };
}

export async function restoreLessonSafely(lessonId: string) {
  const lesson = await lessonTemplatesDao.restoreLessonTemplate(lessonId);
  const { syncClassesForBlockTemplate } = await import('@/lib/services/lessonRebalancer');
  await syncClassesForBlockTemplate(lesson.block_id);
  return lesson;
}
