"use server";

import { addDays } from 'date-fns';

import { blocksDao, classLessonsDao, classesDao, coderProgressDao, lessonTemplatesDao, sessionsDao } from '@/lib/dao';
import type { ClassLessonRecord } from '@/lib/dao/classLessonsDao';
import type { ClassRecord } from '@/lib/dao/classesDao';
import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import type { SessionRecord } from '@/lib/dao/sessionsDao';

type ClassBlockRow = Awaited<ReturnType<typeof classesDao.getClassBlocks>>[number];
type BlockTemplate = Awaited<ReturnType<typeof blocksDao.listBlocksByLevel>>[number];

export async function autoAssignLessonsForClass(classId: string): Promise<{ assigned: number }> {
  const klass = await classesDao.getClassById(classId);
  if (!klass || klass.type !== 'WEEKLY' || !klass.level_id) {
    return { assigned: 0 };
  }

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

  // FORCE RESCHEDULE: Unassign all FUTURE scheduled sessions to ensure strict curriculum order
  const now = new Date();
  const futureSessions = sessions.filter(
    (s) => new Date(s.date_time) > now && s.status === 'SCHEDULED'
  );

  if (futureSessions.length > 0) {
    await classLessonsDao.unassignLessonsFromSessions(futureSessions.map(s => s.id));
  }

  const { blocks, lessonsByBlock, unassignedSessions } = await ensureLessonCapacity(
    klass,
    sessions,
    blockTemplates,
  );

  if (unassignedSessions.length === 0) {
    console.log("No unassigned sessions found.");
    await syncBlockStatuses(blocks, lessonsByBlock, sessions);
    return { assigned: 0 };
  }

  const lessonQueue = buildLessonQueue(blocks, lessonsByBlock);
  console.log(`Debug Queue: ${lessonQueue.length} lessons. Unassigned Sessions: ${unassignedSessions.length}`);

  let assigned = 0;

  for (const session of unassignedSessions) {
    const lesson = lessonQueue.shift();
    if (!lesson) {
      console.log("Queue exhausted.");
      break;
    }
    console.log(`Assigning lesson ${lesson.title} to session ${session.id}`);
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
};

async function ensureLessonCapacity(
  klass: ClassRecord,
  sessions: SessionRecord[],
  blockTemplates: BlockTemplate[],
): Promise<EnsureResult> {
  let blocks = await classesDao.getClassBlocks(klass.id);
  const lessonsByBlock = await loadLessons(blocks);
  const lessonTemplateCache = new Map<string, LessonTemplateRecord[]>();
  await syncLessonsWithTemplates(blocks, lessonsByBlock, lessonTemplateCache);

  const sessionAlreadyUsed = collectAssignedSessionIds(lessonsByBlock);
  const unassignedSessions = sessions.filter((session) => !sessionAlreadyUsed.has(session.id));

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
  }

  let lessonQueue = buildLessonQueue(blocks, lessonsByBlock);

  let templateIndex = getNextTemplateIndex(blocks, blockTemplates);
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
    lessonQueue = buildLessonQueue(blocks, lessonsByBlock);
  }

  if (!blocks.some((block) => block.status === 'UPCOMING') && blockTemplates.length > 0) {
    const template = blockTemplates[getNextTemplateIndex(blocks, blockTemplates)];
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

  return { blocks, lessonsByBlock, unassignedSessions };
}

function collectAssignedSessionIds(lessonsByBlock: Map<string, ClassLessonRecord[]>): Set<string> {
  const sessionIds = new Set<string>();
  lessonsByBlock.forEach((lessons) => {
    lessons.forEach((lesson) => {
      if (lesson.session_id) {
        sessionIds.add(lesson.session_id);
      }
    });
  });
  return sessionIds;
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


function buildLessonQueue(
  blocks: ClassBlockRow[],
  lessonsByBlock: Map<string, ClassLessonRecord[]>,
): ClassLessonRecord[] {
  return blocks
    .slice()
    // Changed sort logic to use DATE instead of ORDER INDEX
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .flatMap((block) => {
      const lessons = lessonsByBlock.get(block.id) ?? [];
      return lessons.slice().sort((a, b) => a.order_index - b.order_index);
    })
    .filter((lesson) => !lesson.session_id);
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
  const firstSession =
    targetSessions[desiredSessionIndex] ??
    targetSessions[targetSessions.length - 1] ??
    allSessions[allSessions.length - 1] ??
    null;
  const lastSession =
    targetSessions[Math.min(desiredSessionIndex + templateLessons.length - 1, targetSessions.length - 1)] ??
    firstSession;

  const startDate = firstSession
    ? formatDateOnly(new Date(firstSession.date_time))
    : fallbackStartDate ?? klass.start_date;
  const endDate = lastSession
    ? formatDateOnly(new Date(lastSession.date_time))
    : formatDateOnly(addDays(new Date(startDate), Math.max(templateLessons.length - 1, 0) * 7));

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

  const createdLessonsPayload = templateLessons.flatMap((lesson) => {
    const sessionCount = Math.max(1, lesson.estimated_meeting_count || 1);
    const parts = [];

    for (let i = 1; i <= sessionCount; i++) {
      let title = lesson.title;
      if (sessionCount > 1) {
        title = `${lesson.title} (Part ${i})`;
      }

      parts.push({
        class_block_id: block.id,
        lesson_template_id: lesson.id,
        title: title,
        summary: lesson.summary ?? null,
        order_index: (lesson.order_index * 1000) + i, // Spaced index to allow multiple parts without collision
        make_up_instructions: lesson.make_up_instructions ?? null,
        slide_url: lesson.slide_url ?? null,
        coach_example_url: lesson.example_url ?? null,
        coach_example_storage_path: lesson.example_storage_path ?? null,
      });
    }
    return parts;
  });

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
      const newLessonsPayload: any[] = [];

      for (const lesson of templateLessons) {
        const expectedCount = Math.max(1, lesson.estimated_meeting_count || 1);
        const existingMatches = existing.filter((l) => l.lesson_template_id === lesson.id);

        if (existingMatches.length < expectedCount) {
          // We need to create the missing parts
          for (let i = existingMatches.length + 1; i <= expectedCount; i++) {
            let title = lesson.title;
            if (expectedCount > 1) {
              title = `${lesson.title} (Part ${i})`;
            }

            newLessonsPayload.push({
              class_block_id: block.id,
              lesson_template_id: lesson.id,
              title: title,
              summary: lesson.summary ?? null,
              order_index: (lesson.order_index * 1000) + i,
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

function getNextTemplateIndex(blocks: ClassBlockRow[], templates: BlockTemplate[]): number {
  if (blocks.length === 0) {
    return 0;
  }
  const lastBlock = blocks[blocks.length - 1];
  const index = templates.findIndex((template) => template.id === lastBlock.block_id);
  if (index < 0) {
    return 0;
  }
  return (index + 1) % templates.length;
}

function computeNextBlockStartDate(blocks: ClassBlockRow[], klass: ClassRecord): string {
  if (blocks.length === 0) {
    return klass.start_date;
  }
  const sorted = blocks
    .slice()
    .sort((a, b) => (a.block_order_index ?? 0) - (b.block_order_index ?? 0));
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

  // Update: Sort by start_date to respect the class schedule (e.g. starting at Block 3)
  const sortedBlocks = blocks
    .slice()
    // Changed sort logic to use DATE instead of ORDER INDEX
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());


  const blockStates = sortedBlocks.map((block) => {
    const lessons = lessonsByBlock.get(block.id) ?? [];
    const hasFutureLesson = lessons.some((lesson) => {
      if (!lesson.session_id) {
        return true;
      }
      const session = sessionMap.get(lesson.session_id);
      if (!session) {
        return true;
      }
      return new Date(session.date_time).getTime() >= now;
    });
    return { block, hasFutureLesson };
  });

  let currentIndex = blockStates.findIndex((state) => state.hasFutureLesson);
  if (currentIndex === -1) {
    currentIndex = blockStates.length - 1;
  }

  const updates: Promise<void>[] = [];
  const completedBlocks: ClassBlockRow[] = [];
  blockStates.forEach((state, index) => {
    let desired: ClassBlockRow['status'];
    if (index < currentIndex) {
      desired = 'COMPLETED';
    } else if (index === currentIndex) {
      desired = 'CURRENT';
    } else {
      desired = 'UPCOMING';
    }

    if (state.block.status !== desired) {
      updates.push(classesDao.updateClassBlock(state.block.id, { status: desired }));
      if (desired === 'COMPLETED') {
        completedBlocks.push(state.block);
      }
      state.block.status = desired;
    }
  });

  await Promise.all(updates);

  if (completedBlocks.length > 0) {
    await Promise.all(
      completedBlocks.map((block) => coderProgressDao.markBlockCompletedForClass(block.class_id, block.block_id ?? null)),
    );
  }
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
