"use server";

import { addDays } from 'date-fns';

import { blocksDao, classLessonsDao, classesDao, coderProgressDao, lessonTemplatesDao, sessionsDao } from '@/lib/dao';
import { buildClassLessonOrderIndex, buildClassLessonTitle } from '@/lib/dao/classLessonsDao';
import { resolveBlockRuntimeDates, resolveBlockStatus, resolveCurrentBlockIndex, resolveNextBlockTemplateIndex } from '@/lib/services/blockRuntime';
import { resolveForwardAssignmentWindow } from '@/lib/services/lessonAssignmentWindow';
import type { ClassLessonRecord } from '@/lib/dao/classLessonsDao';
import type { ClassRecord } from '@/lib/dao/classesDao';
import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import type { SessionRecord } from '@/lib/dao/sessionsDao';

type ClassBlockRow = Awaited<ReturnType<typeof classesDao.getClassBlocks>>[number];
type BlockTemplate = Awaited<ReturnType<typeof blocksDao.listBlocksByLevel>>[number];
type AutoAssignOptions = {
  mode?: 'preserve' | 'rebuild_future';
};

type ReflowLessonsResult = {
  assigned: number;
};

export async function autoAssignLessonsForClass(
  classId: string,
  options: AutoAssignOptions = {},
): Promise<{ assigned: number }> {
  const klass = await classesDao.getClassById(classId);
  if (!klass || klass.type !== 'WEEKLY' || !klass.level_id) {
    return { assigned: 0 };
  }
  const mode = options.mode ?? 'preserve';

  const [allSessions, blockTemplates] = await Promise.all([
    sessionsDao.listSessionsByClass(classId),
    blocksDao.listBlocksByLevel(klass.level_id),
  ]);

  if (blockTemplates.length === 0) {
    return { assigned: 0 };
  }

  // Filter out CANCELLED sessions - lessons should only be assigned to active sessions
  // This ensures when a session is cancelled (holiday), lessons shift to the next available session
  const sessions = allSessions.filter(s => s.status !== 'CANCELLED');

  if (mode === 'rebuild_future') {
    // Explicit rebuild: free only future scheduled sessions so completed history stays intact.
    const now = new Date();
    const futureSessions = sessions.filter(
      (s) => new Date(s.date_time) > now && s.status === 'SCHEDULED'
    );

    if (futureSessions.length > 0) {
      await classLessonsDao.unassignLessonsFromSessions(futureSessions.map(s => s.id));
    }
  }

  const { blocks, lessonsByBlock, unassignedSessions, lessonQueue } = await ensureLessonCapacity(
    klass,
    sessions,
    blockTemplates,
  );

  if (unassignedSessions.length === 0) {
    console.log("No unassigned sessions found.");
    await syncBlockStatuses(blocks, lessonsByBlock, sessions);
    return { assigned: 0 };
  }

  console.log(`[AutoAssign:${mode}] Queue=${lessonQueue.length}, UnassignedSessions=${unassignedSessions.length}`);

  let assigned = 0;

  for (const session of unassignedSessions) {
    const lesson = lessonQueue.shift();
    if (!lesson) {
      console.log("Queue exhausted.");
      break;
    }
    console.log(`[AutoAssign:${mode}] Assigning lesson ${lesson.title} to session ${session.id}`);
    await classLessonsDao.assignLessonToSession(lesson.id, session.id, session.date_time);
    lesson.session_id = session.id;
    lesson.unlock_at = session.date_time;
    assigned += 1;
  }

  await syncBlockStatuses(blocks, lessonsByBlock, sessions);

  return { assigned };
}

export async function reflowLessonsFromSession(
  sessionId: string,
  classLessonId: string,
): Promise<ReflowLessonsResult> {
  const targetSession = await sessionsDao.getSessionById(sessionId);
  if (!targetSession) {
    throw new Error('Session not found');
  }

  if (targetSession.status !== 'SCHEDULED') {
    throw new Error('Only scheduled sessions can be reflowed');
  }

  const klass = await classesDao.getClassById(targetSession.class_id);
  if (!klass || klass.type !== 'WEEKLY' || !klass.level_id) {
    throw new Error('Lesson reflow is only available for weekly classes');
  }

  const selectedLesson = await classLessonsDao.getClassLessonById(classLessonId);
  if (!selectedLesson) {
    throw new Error('Lesson not found');
  }

  const [allSessions, blockTemplates] = await Promise.all([
    sessionsDao.listSessionsByClass(klass.id),
    blocksDao.listBlocksByLevel(klass.level_id),
  ]);

  if (blockTemplates.length === 0) {
    throw new Error('No block templates found for this class level');
  }

  const sessions = allSessions
    .filter((session) => session.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  const targetSessionIndex = sessions.findIndex((session) => session.id === sessionId);
  if (targetSessionIndex < 0) {
    throw new Error('Cannot reflow a cancelled or invalid session');
  }

  const futureSessions = sessions
    .slice(targetSessionIndex)
    .filter((session) => session.status === 'SCHEDULED');
  if (futureSessions.length === 0) {
    throw new Error('No scheduled sessions available to reflow');
  }

  const initialBlocks = await classesDao.getClassBlocks(klass.id);
  const selectedBlock = initialBlocks.find((block) => block.id === selectedLesson.class_block_id);
  if (!selectedBlock || selectedBlock.class_id !== klass.id) {
    throw new Error('Lesson not found in this class');
  }

  if (selectedBlock.status === 'COMPLETED') {
    throw new Error('Cannot reflow from a completed block lesson');
  }

  const sessionOrder = new Map(sessions.map((session, index) => [session.id, index]));
  if (selectedLesson.session_id) {
    const selectedSessionIndex = sessionOrder.get(selectedLesson.session_id);
    if (selectedSessionIndex === undefined || selectedSessionIndex < targetSessionIndex) {
      throw new Error('Cannot move a lesson from a previous or completed session');
    }
  }

  await classLessonsDao.unassignLessonsFromSessions(futureSessions.map((session) => session.id));

  const { blocks, lessonsByBlock } = await ensureLessonCapacity(klass, sessions, blockTemplates);
  const futureSessionIds = new Set(futureSessions.map((session) => session.id));
  const lessonTemplateCache = new Map<string, LessonTemplateRecord[]>();
  let reflowQueue = buildReflowLessonQueue(blocks, lessonsByBlock, classLessonId, futureSessionIds);

  while (reflowQueue.length < futureSessions.length && blockTemplates.length > 0) {
    const template = blockTemplates[resolveNextBlockTemplateIndex(blocks, blockTemplates)];
    await instantiateBlockFromTemplate({
      klass,
      template,
      targetSessions: futureSessions,
      allSessions: sessions,
      desiredSessionIndex: Math.max(reflowQueue.length, futureSessions.length),
      status: 'UPCOMING',
      lessonsByBlock,
      blocks,
      lessonTemplateCache,
      fallbackStartDate: computeNextBlockStartDate(blocks, klass),
    });
    reflowQueue = buildReflowLessonQueue(blocks, lessonsByBlock, classLessonId, futureSessionIds);
  }

  let assigned = 0;
  for (let index = 0; index < futureSessions.length; index += 1) {
    const lesson = reflowQueue[index];
    const session = futureSessions[index];
    if (!lesson || !session) {
      break;
    }

    await classLessonsDao.assignLessonToSession(lesson.id, session.id, session.date_time);
    lesson.session_id = session.id;
    lesson.unlock_at = session.date_time;
    assigned += 1;
  }

  await syncBlockStatuses(blocks, lessonsByBlock, sessions);

  return { assigned };
}

type EnsureResult = {
  blocks: ClassBlockRow[];
  lessonsByBlock: Map<string, ClassLessonRecord[]>;
  unassignedSessions: SessionRecord[];
  lessonQueue: ClassLessonRecord[];
};

async function ensureLessonCapacity(
  klass: ClassRecord,
  sessions: SessionRecord[],
  blockTemplates: BlockTemplate[],
): Promise<EnsureResult> {
  const blocks = await classesDao.getClassBlocks(klass.id);
  const lessonsByBlock = await loadLessons(blocks);
  const lessonTemplateCache = new Map<string, LessonTemplateRecord[]>();
  await syncLessonsWithTemplates(blocks, lessonsByBlock, lessonTemplateCache);

  let assignmentWindow = buildForwardAssignmentWindow(blocks, lessonsByBlock, sessions);
  const unassignedSessions = assignmentWindow.unassignedSessions;

  if (blocks.length === 0) {
    const template = blockTemplates[0];
    await instantiateBlockFromTemplate({
      klass,
      template,
      targetSessions: unassignedSessions,
      allSessions: sessions,
      desiredSessionIndex: 0,
      status: 'CURRENT',
      lessonsByBlock,
      blocks,
      lessonTemplateCache,
    });
    assignmentWindow = buildForwardAssignmentWindow(blocks, lessonsByBlock, sessions);
  }

  let lessonQueue = assignmentWindow.lessonQueue;

  let templateIndex = resolveNextBlockTemplateIndex(blocks, blockTemplates);
  while (lessonQueue.length < unassignedSessions.length && blockTemplates.length > 0) {
    const template = blockTemplates[templateIndex];
    templateIndex = (templateIndex + 1) % blockTemplates.length;
    await instantiateBlockFromTemplate({
      klass,
      template,
      targetSessions: unassignedSessions,
      allSessions: sessions,
      desiredSessionIndex: lessonQueue.length,
      status: 'UPCOMING',
      lessonsByBlock,
      blocks,
      lessonTemplateCache,
    });
    assignmentWindow = buildForwardAssignmentWindow(blocks, lessonsByBlock, sessions);
    lessonQueue = assignmentWindow.lessonQueue;
  }

  if (!blocks.some((block) => block.status === 'UPCOMING') && blockTemplates.length > 0) {
    const template = blockTemplates[resolveNextBlockTemplateIndex(blocks, blockTemplates)];
    await instantiateBlockFromTemplate({
      klass,
      template,
      targetSessions: unassignedSessions,
      allSessions: sessions,
      desiredSessionIndex: Math.max(lessonQueue.length, unassignedSessions.length),
      status: 'UPCOMING',
      lessonsByBlock,
      blocks,
      lessonTemplateCache,
      fallbackStartDate: computeNextBlockStartDate(blocks, klass),
    });
  }

  return { blocks, lessonsByBlock, unassignedSessions, lessonQueue };
}

async function loadLessons(blocks: ClassBlockRow[]): Promise<Map<string, ClassLessonRecord[]>> {
  const lessonsByBlock = new Map<string, ClassLessonRecord[]>();
  await Promise.all(
    blocks.map(async (block) => {
      const lessons = await classLessonsDao.listLessonsByClassBlock(block.id);
      lessonsByBlock.set(block.id, lessons);
    }),
  );
  return lessonsByBlock;
}


function buildOrderedLessonList(
  blocks: ClassBlockRow[],
  lessonsByBlock: Map<string, ClassLessonRecord[]>,
): ClassLessonRecord[] {
  return blocks
    .slice()
    .sort(compareBlocksByScheduleOrder)
    .flatMap((block) => {
      const lessons = lessonsByBlock.get(block.id) ?? [];
      return lessons.slice().sort((a, b) => a.order_index - b.order_index);
    });
}

function buildForwardAssignmentWindow(
  blocks: ClassBlockRow[],
  lessonsByBlock: Map<string, ClassLessonRecord[]>,
  sessions: SessionRecord[],
) {
  return resolveForwardAssignmentWindow(buildOrderedLessonList(blocks, lessonsByBlock), sessions);
}

function buildReflowLessonQueue(
  blocks: ClassBlockRow[],
  lessonsByBlock: Map<string, ClassLessonRecord[]>,
  startLessonId: string,
  reflowSessionIds: Set<string>,
): ClassLessonRecord[] {
  const sortedBlocks = blocks.slice().sort(compareBlocksByScheduleOrder);
  const startBlockIndex = sortedBlocks.findIndex((block) => (
    lessonsByBlock.get(block.id)?.some((lesson) => lesson.id === startLessonId)
  ));

  if (startBlockIndex < 0) {
    return [];
  }

  const startLesson = lessonsByBlock
    .get(sortedBlocks[startBlockIndex].id)
    ?.find((lesson) => lesson.id === startLessonId);
  if (!startLesson) {
    return [];
  }

  return sortedBlocks
    .slice(startBlockIndex)
    .flatMap((block, blockOffset) => {
      const lessons = (lessonsByBlock.get(block.id) ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index);

      return blockOffset === 0
        ? lessons.filter((lesson) => lesson.order_index >= startLesson.order_index)
        : lessons;
    })
    .filter((lesson) => !lesson.session_id || reflowSessionIds.has(lesson.session_id));
}


type InstantiateInput = {
  klass: ClassRecord;
  template: BlockTemplate;
  targetSessions: SessionRecord[];
  allSessions: SessionRecord[];
  desiredSessionIndex: number;
  status: ClassBlockRow['status'];
  lessonsByBlock: Map<string, ClassLessonRecord[]>;
  blocks: ClassBlockRow[];
  lessonTemplateCache?: Map<string, LessonTemplateRecord[]>;
  fallbackStartDate?: string;
};

async function instantiateBlockFromTemplate({
  klass,
  template,
  targetSessions,
  allSessions,
  desiredSessionIndex,
  status,
  lessonsByBlock,
  blocks,
  lessonTemplateCache,
  fallbackStartDate,
}: InstantiateInput): Promise<void> {
  const templateLessons = await getLessonTemplates(template.id, lessonTemplateCache);
  const totalSessionCount = templateLessons.reduce(
    (sum, lesson) => sum + Math.max(1, lesson.estimated_meeting_count || 1),
    0,
  );
  const firstSession =
    targetSessions[desiredSessionIndex] ??
    targetSessions[targetSessions.length - 1] ??
    allSessions[allSessions.length - 1] ??
    null;
  const lastSession =
    targetSessions[Math.min(desiredSessionIndex + Math.max(totalSessionCount, 1) - 1, targetSessions.length - 1)] ??
    firstSession;

  const startDate = firstSession
    ? formatDateOnly(new Date(firstSession.date_time))
    : fallbackStartDate ?? klass.start_date;
  const endDate = lastSession
    ? formatDateOnly(new Date(lastSession.date_time))
    : formatDateOnly(addDays(new Date(startDate), Math.max(totalSessionCount - 1, 0) * 7));

  const block = await classesDao.createClassBlock({
    classId: klass.id,
    blockId: template.id,
    startDate,
    endDate,
    pitchingDayDate: endDate,
    status,
  });

  if (templateLessons.length === 0) {
    const normalizedBlock: ClassBlockRow = {
      ...block,
      block_name: template.name ?? undefined,
      block_order_index: template.order_index ?? null,
      block_estimated_sessions: template.estimated_sessions ?? null,
    };
    lessonsByBlock.set(block.id, []);
    blocks.push(normalizedBlock);
    return;
  }

  const createdLessonsPayload: any[] = [];

  for (const lesson of templateLessons) {
    const sessionCount = Math.max(1, lesson.estimated_meeting_count || 1);

    for (let i = 1; i <= sessionCount; i++) {
      createdLessonsPayload.push({
        class_block_id: block.id,
        lesson_template_id: lesson.id,
        title: buildClassLessonTitle(lesson.title, sessionCount, i),
        summary: lesson.summary ?? null,
        order_index: buildClassLessonOrderIndex(lesson.order_index, i),
        make_up_instructions: lesson.make_up_instructions ?? null,
        slide_url: lesson.slide_url ?? null,
        coach_example_url: lesson.example_url ?? null,
        coach_example_storage_path: lesson.example_storage_path ?? null,
      });
    }
  }

  const createdLessons = await classLessonsDao.createClassLessons(createdLessonsPayload);

  const normalizedBlock: ClassBlockRow = {
    ...block,
    block_name: template.name ?? undefined,
    block_order_index: template.order_index ?? null,
    block_estimated_sessions: template.estimated_sessions ?? null,
  };

  lessonsByBlock.set(block.id, createdLessons);
  blocks.push(normalizedBlock);
}

async function syncLessonsWithTemplates(
  blocks: ClassBlockRow[],
  lessonsByBlock: Map<string, ClassLessonRecord[]>,
  lessonTemplateCache: Map<string, LessonTemplateRecord[]>,
): Promise<void> {
  await Promise.all(
    blocks.map(async (block) => {
      if (!block.block_id) {
        lessonsByBlock.set(block.id, lessonsByBlock.get(block.id) ?? []);
        return;
      }
      const templateLessons = await getLessonTemplates(block.block_id, lessonTemplateCache);
      if (templateLessons.length === 0) {
        return;
      }
      const existing = lessonsByBlock.get(block.id) ?? [];

      // Get the set of lesson_template_ids that exist in this block
      // This respects filtered lessons when a starting lesson was set
      const existingTemplateIds = new Set(existing.map(l => l.lesson_template_id));

      const newLessonsPayload: any[] = [];

      for (const lesson of templateLessons) {
        // IMPORTANT: Only sync parts for lessons that already exist in the block
        // This prevents adding lessons that were filtered out by starting lesson selection
        if (!existingTemplateIds.has(lesson.id)) {
          continue;
        }

        const expectedCount = Math.max(1, lesson.estimated_meeting_count || 1);
        const existingMatches = existing
          .filter((l) => l.lesson_template_id === lesson.id)
          .slice()
          .sort((a, b) => a.order_index - b.order_index);

        for (let i = 0; i < existingMatches.length; i++) {
          const currentLesson = existingMatches[i];
          const partNumber = i + 1;
          const expectedOrderIndex = buildClassLessonOrderIndex(lesson.order_index, partNumber);
          const expectedTitle = buildClassLessonTitle(lesson.title, expectedCount, partNumber);
          const updates: Partial<ClassLessonRecord> = {};

          if (currentLesson.order_index !== expectedOrderIndex) {
            updates.order_index = expectedOrderIndex;
          }
          if (currentLesson.title !== expectedTitle) {
            updates.title = expectedTitle;
          }
          if (currentLesson.summary !== (lesson.summary ?? null)) {
            updates.summary = lesson.summary ?? null;
          }
          if (currentLesson.make_up_instructions !== (lesson.make_up_instructions ?? null)) {
            updates.make_up_instructions = lesson.make_up_instructions ?? null;
          }
          if (currentLesson.slide_url !== (lesson.slide_url ?? null)) {
            updates.slide_url = lesson.slide_url ?? null;
          }
          if (currentLesson.coach_example_url !== (lesson.example_url ?? null)) {
            updates.coach_example_url = lesson.example_url ?? null;
          }
          if (currentLesson.coach_example_storage_path !== (lesson.example_storage_path ?? null)) {
            updates.coach_example_storage_path = lesson.example_storage_path ?? null;
          }

          if (Object.keys(updates).length > 0) {
            await classLessonsDao.updateClassLesson(currentLesson.id, updates);
            Object.assign(currentLesson, updates);
          }
        }

        if (existingMatches.length < expectedCount) {
          // We need to create the missing parts
          for (let i = existingMatches.length + 1; i <= expectedCount; i++) {
            newLessonsPayload.push({
              class_block_id: block.id,
              lesson_template_id: lesson.id,
              title: buildClassLessonTitle(lesson.title, expectedCount, i),
              summary: lesson.summary ?? null,
              order_index: buildClassLessonOrderIndex(lesson.order_index, i),
              make_up_instructions: lesson.make_up_instructions ?? null,
              slide_url: lesson.slide_url ?? null,
              coach_example_url: lesson.example_url ?? null,
              coach_example_storage_path: lesson.example_storage_path ?? null,
            });
          }
        }
      }

      if (newLessonsPayload.length === 0) {
        return;
      }

      const created = await classLessonsDao.createClassLessons(newLessonsPayload);
      const updated = [...existing, ...created].sort((a, b) => a.order_index - b.order_index);
      lessonsByBlock.set(block.id, updated);
    }),
  );
}

async function getLessonTemplates(
  templateId: string,
  cache?: Map<string, LessonTemplateRecord[]>,
): Promise<LessonTemplateRecord[]> {
  if (!cache) {
    return lessonTemplatesDao.listLessonsByBlock(templateId);
  }
  if (!cache.has(templateId)) {
    cache.set(templateId, await lessonTemplatesDao.listLessonsByBlock(templateId));
  }
  return cache.get(templateId) ?? [];
}

function computeNextBlockStartDate(blocks: ClassBlockRow[], klass: ClassRecord): string {
  if (blocks.length === 0) {
    return klass.start_date;
  }
  const sorted = blocks
    .slice()
    .sort(compareBlocksByScheduleOrder);
  const last = sorted[sorted.length - 1];
  const base = last.end_date ?? last.start_date ?? klass.start_date;
  const baseDate = base ? new Date(base) : new Date(klass.start_date);
  return formatDateOnly(addDays(baseDate, 7));
}

async function syncBlockStatuses(
  blocks: ClassBlockRow[],
  lessonsByBlock: Map<string, ClassLessonRecord[]>,
  sessions: SessionRecord[],
): Promise<void> {
  if (blocks.length === 0) {
    return;
  }

  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const now = Date.now();

  const sortedBlocks = blocks
    .slice()
    .sort(compareBlocksByScheduleOrder);

  const forwardLessonIds = new Set(
    buildForwardAssignmentWindow(blocks, lessonsByBlock, sessions).lessonQueue.map((lesson) => lesson.id),
  );


  const blockStates = sortedBlocks.map((block) => {
    const lessons = lessonsByBlock.get(block.id) ?? [];
    const hasFutureLesson = lessons.some((lesson) => {
      if (!lesson.session_id) {
        return forwardLessonIds.has(lesson.id);
      }
      const session = sessionMap.get(lesson.session_id);
      if (!session) {
        return true;
      }
      return new Date(session.date_time).getTime() >= now;
    });
    return { block, hasFutureLesson };
  });

  const currentIndex = resolveCurrentBlockIndex(blockStates);

  const updates: Promise<void>[] = [];
  blockStates.forEach((state, index) => {
    const desired = resolveBlockStatus(index, currentIndex);
    const lessons = lessonsByBlock.get(state.block.id) ?? [];
    const runtimeDates = resolveBlockRuntimeDates(state.block, lessons, sessions);
    const needsDateSync =
      state.block.start_date !== runtimeDates.startDate ||
      state.block.end_date !== runtimeDates.endDate ||
      (state.block.pitching_day_date ?? null) !== runtimeDates.pitchingDayDate;

    if (state.block.status !== desired || needsDateSync) {
      updates.push(classesDao.updateClassBlock(state.block.id, {
        status: desired,
        startDate: runtimeDates.startDate,
        endDate: runtimeDates.endDate,
        pitchingDayDate: runtimeDates.pitchingDayDate,
      }));
      state.block.status = desired;
      state.block.start_date = runtimeDates.startDate;
      state.block.end_date = runtimeDates.endDate;
      state.block.pitching_day_date = runtimeDates.pitchingDayDate;
    }
  });

  await Promise.all(updates);

  const completedBlocks = blockStates
    .filter((_, index) => index < currentIndex)
    .map((state) => state.block);

  if (completedBlocks.length > 0) {
    await Promise.all(
      completedBlocks.map((block) => coderProgressDao.markBlockCompletedForClass(block.class_id, block.block_id ?? null)),
    );
  }
}

/**
 * Standalone exported function to sync class_blocks.status (CURRENT/UPCOMING/COMPLETED)
 * for a given class WITHOUT triggering a full lesson reassignment.
 *
 * Use this after a manual lesson-session swap (e.g. admin "Ubah Materi") so that
 * the block status card in the admin UI reflects the actual current lesson position.
 */
export async function syncBlockStatusesForClass(classId: string): Promise<void> {
  const [blocks, sessions] = await Promise.all([
    classesDao.getClassBlocks(classId),
    sessionsDao.listSessionsByClass(classId),
  ]);

  if (blocks.length === 0) return;

  // Load lessons per block
  const lessonsByBlock = await loadLessons(blocks);

  // Re-use existing private syncBlockStatuses logic
  await syncBlockStatuses(blocks, lessonsByBlock, sessions);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function compareBlocksByScheduleOrder(a: ClassBlockRow, b: ClassBlockRow): number {
  const createdAtDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  const startDateDiff = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  if (startDateDiff !== 0) {
    return startDateDiff;
  }

  return a.id.localeCompare(b.id);
}
