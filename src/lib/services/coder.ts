import { attendanceDao, classLessonsDao, classesDao, coderProgressDao, lessonTemplatesDao, materialsDao, rubricsDao, sessionsDao } from '@/lib/dao';
import { getSoftwareByBlockId } from '@/lib/dao/blockSoftwareDao';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';

export type CoderClassProgress = {
  classId: string;
  name: string;
  type: 'WEEKLY' | 'EKSKUL';
  currentBlockName?: string | null;
  upcomingBlockName?: string | null;
  upNext?: {
    blockId: string;
    name: string;
    status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    startDate: string;
    endDate: string;
    estimatedSessions?: number | null;
    software?: Array<{
      id: string;
      name: string;
      version: string | null;
      description: string | null;
      installation_url: string | null;
      installation_instructions: string | null;
      minimum_specs: Record<string, string> | null;
      access_info: string | null;
    }>;
    completedLessons?: Array<{
      title: string;
      summary: string | null;
      completedAt: string;
    }>;
    nextLesson?: {
      title: string;
      summary: string | null;
      slideUrl: string | null;
    } | null;
  } | null;
  completedBlocks: number;
  totalBlocks: number | null;
  lastAttendanceAt?: string | null;
  semesterTag?: string | null;
  pendingBlocks?: Array<{
    blockId: string;
    name: string;
    status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    startDate: string;
    endDate: string;
  }>;
  journeyBlocks: Array<{
    blockId: string;
    name: string;
    status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    startDate: string;
    endDate: string;
    orderIndex: number | null;
  }>;
};

export async function getCoderProgress(coderId: string): Promise<CoderClassProgress[]> {
  const classes = await classesDao.listClassesForCoder(coderId);
  const attendance = await attendanceDao.listAttendanceByCoder(coderId);

  return Promise.all(
    classes.map(async (klass) => {
      const submissions = await rubricsDao.listRubricSubmissionsByCoder(klass.id, coderId);
      const blocks = await classesDao.getClassBlocks(klass.id);
      const sessions = await sessionsDao.listSessionsByClass(klass.id);
      const lessonMap = klass.level_id ? await computeLessonSchedule(klass.id, klass.level_id) : new Map();

      // Fetch personalized journey order
      const journey = klass.level_id ? await coderProgressDao.getCoderJourney(coderId, klass.level_id) : [];
      const journeyOrderMap = new Map(journey.map(j => [j.block_id, j.journey_order]));

      const completedBlocks = submissions.filter((submission) => submission.block_id).length;
      const totalBlocks = klass.type === 'WEEKLY' ? blocks.length : null;
      const currentBlock = blocks.find((block) => block.status === 'CURRENT');
      const upcomingBlock = blocks.find((block) => block.status === 'UPCOMING');

      // Sort blocks by journey_order if available, else standard order
      const sortedBlocks = [...blocks].sort((a, b) => {
        const orderA = journeyOrderMap.get(a.block_id);
        const orderB = journeyOrderMap.get(b.block_id);

        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB;
        }
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;

        // Fallback: Priority to Date (Chronological)
        const dateA = new Date(a.start_date).getTime();
        const dateB = new Date(b.start_date).getTime();
        if (dateA !== dateB) {
          return dateA - dateB;
        }

        // Tie-breaker
        if (a.block_order_index != null && b.block_order_index != null) {
          return a.block_order_index - b.block_order_index;
        }
        return 0;
      });

      const pendingBlocks =
        klass.type === 'WEEKLY'
          ? sortedBlocks.filter((block) => block.status !== 'COMPLETED').map((block) => ({
            blockId: block.block_id,
            name: block.block_name ?? 'Block',
            status: block.status,
            startDate: block.start_date,
            endDate: block.end_date,
          }))
          : [];

      // Use the sorted index as the display order
      const journeyBlocks = sortedBlocks.map((block, index) => ({
        blockId: block.block_id,
        name: block.block_name ?? 'Block',
        status: block.status,
        startDate: block.start_date,
        endDate: block.end_date,
        orderIndex: index,
      }));

      let upNext: CoderClassProgress['upNext'] = null;
      if (klass.type === 'WEEKLY') {
        const currentOrUpcoming =
          sortedBlocks.find((block) => block.status === 'CURRENT') ??
          sortedBlocks.find((block) => block.status === 'UPCOMING');

        if (currentOrUpcoming) {
          const software = await getSoftwareByBlockId(currentOrUpcoming.block_id);

          // Find next upcoming session and its lesson
          const now = new Date();
          const nextSession = sessions
            .filter(s => (new Date(s.date_time) >= now && s.status !== 'COMPLETED' && s.status !== 'CANCELLED')) // Fix: Don't show completed sessions as next
            .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];

          let nextLesson = null;
          if (nextSession) {
            const slot = lessonMap.get(nextSession.id);
            if (slot) {
              nextLesson = {
                title: formatLessonTitle(slot),
                summary: slot.lessonTemplate.summary,
                slideUrl: slot.lessonTemplate.slide_url,
              };
            }
          }

          // Fetch completed lessons for this block
          const completedLessons = sessions
            .filter(s => s.status === 'COMPLETED')
            .map(s => {
              const slot = lessonMap.get(s.id);
              if (!slot) return null;
              // Check if this session belongs to the current block?
              // The lesson map assigns a template. The template belongs to a block.
              // We should check if slot.lessonTemplate.block_id === currentOrUpcoming.block_id
              // But usually sessions are strictly ordered.
              // Let's rely on time range of the block?
              // Or better: filter by block_id if available in slot.
              if (slot.lessonTemplate.block_id === currentOrUpcoming.block_id) {
                return {
                  title: formatLessonTitle(slot),
                  summary: slot.lessonTemplate.summary,
                  completedAt: s.date_time,
                };
              }
              return null;
            })
            .filter((l): l is { title: string; summary: string | null; completedAt: string } => l !== null)
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()); // Newest first

          upNext = {
            blockId: currentOrUpcoming.block_id,
            name: currentOrUpcoming.block_name ?? 'Block',
            status: currentOrUpcoming.status,
            startDate: currentOrUpcoming.start_date,
            endDate: currentOrUpcoming.end_date,
            estimatedSessions: (await lessonTemplatesDao.listLessonsByBlock(currentOrUpcoming.block_id))
              .reduce((acc, l) => acc + (l.estimated_meeting_count || 1), 0),
            software: software.map(s => ({
              id: s.id,
              name: s.name,
              version: s.version,
              description: s.description,
              installation_url: s.installation_url,
              installation_instructions: s.installation_instructions,
              minimum_specs: s.minimum_specs as Record<string, string> | null,
              access_info: s.access_info,
            })),
            nextLesson,
            completedLessons,
          };
        } else if (sortedBlocks.length > 0) {
          const wrapAround = sortedBlocks[0];
          const software = await getSoftwareByBlockId(wrapAround.block_id);
          upNext = {
            blockId: wrapAround.block_id,
            name: wrapAround.block_name ?? 'Block',
            status: wrapAround.status,
            startDate: wrapAround.start_date,
            endDate: wrapAround.end_date,
            estimatedSessions: (await lessonTemplatesDao.listLessonsByBlock(wrapAround.block_id))
              .reduce((acc, l) => acc + (l.estimated_meeting_count || 1), 0),
            software: software.map(s => ({
              id: s.id,
              name: s.name,
              version: s.version,
              description: s.description,
              installation_url: s.installation_url,
              installation_instructions: s.installation_instructions,
              minimum_specs: s.minimum_specs as Record<string, string> | null,
              access_info: s.access_info,
            })),
            completedLessons: [],
          };
        }
      }

      const sessionIdSet = new Set(sessions.map((session) => session.id));
      const lastAttendance = attendance
        .filter(
          (record) =>
            (record.status === 'PRESENT' || record.status === 'LATE') &&
            sessionIdSet.has(record.session_id),
        )
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];

      const semesterTag = submissions.find((submission) => submission.semester_tag)?.semester_tag ?? null;

      return {
        classId: klass.id,
        name: klass.name,
        type: klass.type,
        currentBlockName: currentBlock?.block_name ?? null,
        upcomingBlockName: upcomingBlock?.block_name ?? null,
        upNext,
        completedBlocks,
        totalBlocks,
        lastAttendanceAt: lastAttendance?.recorded_at ?? null,
        semesterTag,
        pendingBlocks,
        journeyBlocks,
      };
    }),
  );
}

export type CoderLessonOverview = {
  classId: string;
  name: string;
  blocks: Array<{
    id: string;
    name: string;
    status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    startDate: string;
    endDate: string;
    lessons: Array<{
      id: string;
      title: string;
      summary: string | null;
      orderIndex: number;
      slideUrl: string | null;
      exampleUrl: string | null;
      sessionDate: string | null;
    }>;
  }>;
};

export async function getAccessibleLessonsForCoder(coderId: string): Promise<CoderLessonOverview[]> {
  const classes = await classesDao.listClassesForCoder(coderId);
  const now = new Date();

  return Promise.all(
    classes.map(async (klass) => {
      const [blocks, sessions] = await Promise.all([
        classesDao.getClassBlocks(klass.id),
        sessionsDao.listSessionsByClass(klass.id),
      ]);
      const sessionMap = new Map(sessions.map((session) => [session.id, session]));

      const blockEntries = await Promise.all(
        blocks.map(async (block) => {
          const lessons = await classLessonsDao.listLessonsByClassBlock(block.id);
          const accessibleLessons = lessons
            .filter((lesson) => {
              if (block.status === 'COMPLETED') {
                return true;
              }
              if (lesson.session_id && sessionMap.has(lesson.session_id)) {
                const session = sessionMap.get(lesson.session_id)!;
                if (session.status === 'COMPLETED') return true;
                return new Date(session.date_time) <= now;
              }
              if (lesson.unlock_at) {
                return new Date(lesson.unlock_at) <= now;
              }
              return false;
            })
            .sort((a, b) => a.order_index - b.order_index)
            .map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              summary: lesson.template_summary ?? null,
              orderIndex: lesson.order_index,
              slideUrl: lesson.slide_url ?? null,
              exampleUrl: (lesson as any).example_url ?? (lesson as any).coach_example_url ?? null,
              sessionDate: lesson.session_id && sessionMap.has(lesson.session_id)
                ? sessionMap.get(lesson.session_id)!.date_time
                : null,
            }));

          return {
            id: block.id,
            name: block.block_name ?? 'Block',
            status: block.status,
            startDate: block.start_date,
            endDate: block.end_date,
            lessons: accessibleLessons,
          };
        }),
      );

      return {
        classId: klass.id,
        name: klass.name,
        blocks: blockEntries,
      };
    }),
  );
}

export async function getVisibleMaterialsForCoder(coderId: string) {
  const classes = await classesDao.listClassesForCoder(coderId);
  const nowIso = new Date().toISOString();
  const results = await Promise.all(
    classes.map(async (klass) => {
      const sessions = await sessionsDao.listSessionsByClass(klass.id);
      const now = new Date();
      const accessibleSessions = new Set(
        sessions
          .filter((session) => new Date(session.date_time) <= now)
          .map((session) => session.id),
      );

      const materials = await materialsDao.listVisibleMaterialsForCoder({
        classId: klass.id,
        nowIso,
        lastAccessibleSessionIds: accessibleSessions,
      });

      return {
        classId: klass.id,
        name: klass.name,
        materials,
      };
    }),
  );

  return results;
}

export async function getLessonDetailForCoder(coderId: string, lessonId: string) {
  const lesson = await classLessonsDao.getClassLessonById(lessonId);
  if (!lesson) return null;

  const block = await classesDao.getClassBlockById(lesson.class_block_id);
  if (!block) return null;

  // Check enrollment
  const isEnrolled = await classesDao.isCoderEnrolled(block.class_id, coderId);
  if (!isEnrolled) return null;

  // Check access (Time or Status)
  const session = lesson.session_id ? await sessionsDao.getSessionById(lesson.session_id) : null;
  const now = new Date();

  const isAccessible = (() => {
    // If sessions status is completed, it is accessible
    if (session?.status === 'COMPLETED') return true;

    // If session time has passed
    if (session && new Date(session.date_time) <= now) return true;

    // If explicit unlock time has passed
    if (lesson.unlock_at && new Date(lesson.unlock_at) <= now) return true;

    return false;
  })();

  if (!isAccessible) return null;

  return {
    ...lesson,
    sessionDate: session?.date_time ?? null,
  };
}
