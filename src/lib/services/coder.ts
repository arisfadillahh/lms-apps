import { attendanceDao, classLessonsDao, classesDao, coderProgressDao, coderSessionAccessDao, lessonTemplatesDao, materialsDao, rubricsDao, sessionsDao } from '@/lib/dao';
import { getSoftwareByBlockId } from '@/lib/dao/blockSoftwareDao';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';

export type CoderClassProgress = {
  classId: string;
  name: string;
  type: 'WEEKLY' | 'EKSKUL';
  levelName?: string | null;
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
    lessons?: Array<{
      id: string;
      title: string;
      summary: string | null;
      orderIndex?: number;
      slideUrl: string | null;
      status: 'COMPLETED' | 'NEXT' | 'UPCOMING' | 'LOCKED';
      completedAt?: string[];
      scheduledAt?: string[];
    }>;
  } | null;
  coach?: {
    name: string;
    avatarUrl: string | null;
    whatsappNumber: string | null;
  } | null;
  schedule?: {
    days: string[];
    timeInfo: string | null;
    zoomLink?: string | null;
  } | null;
  completedBlocks: number;
  totalBlocks: number | null;
  lastAttendanceAt?: string | null;
  semesterTag?: string | null;
  // Fallback: last completed lesson from a previous block (when current block has none yet)
  lastCompletedLesson?: {
    title: string;
    summary: string | null;
    slideUrl: string | null;
  } | null;
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

export type CoderStoredLessonOverview = {
  classId: string;
  name: string;
  blocks: Array<{
    id: string;
    name: string;
    status: 'COMPLETED' | 'CURRENT';
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
      isAccessible: true;
    }>;
  }>;
};

type LessonSessionMap = Map<string, Awaited<ReturnType<typeof sessionsDao.listSessionsByClass>>[number]>;
type WeeklySession = Awaited<ReturnType<typeof sessionsDao.listSessionsByClass>>[number];
type WeeklyBlock = Awaited<ReturnType<typeof classesDao.getClassBlocks>>[number];
type ClassLesson = Awaited<ReturnType<typeof classLessonsDao.listLessonsByClassBlock>>[number];
type LessonSlotRecord = Awaited<ReturnType<typeof computeLessonSchedule>> extends Map<string, infer TValue>
  ? TValue
  : never;
type RuntimeBlockStatus = CoderClassProgress['journeyBlocks'][number]['status'];
type RuntimeBlockInfo = WeeklyBlock & {
  runtimeStatus: RuntimeBlockStatus;
  mappedSessions: WeeklySession[];
  firstSessionAt: string | null;
  lastSessionAt: string | null;
};
type MappedSessionEntry = {
  session: WeeklySession;
  slot: LessonSlotRecord;
  classBlock: WeeklyBlock;
};

function buildLessonToSessionMap(
  lessonMap: Awaited<ReturnType<typeof computeLessonSchedule>>,
  sessions: Awaited<ReturnType<typeof sessionsDao.listSessionsByClass>>,
): LessonSessionMap {
  const sessionMapDb = new Map(sessions.map((session) => [session.id, session]));
  const lessonToSessionMap = new Map<string, typeof sessions[0]>();

  for (const [sessionId, slot] of lessonMap.entries()) {
    const matchedSession = sessionMapDb.get(sessionId);
    if (!matchedSession) {
      continue;
    }
    if (slot.classLessonId) {
      lessonToSessionMap.set(slot.classLessonId, matchedSession);
    } else {
      lessonToSessionMap.set(slot.lessonTemplate.id, matchedSession);
    }
  }

  return lessonToSessionMap;
}

function buildClassLessonSessionMap(
  lessonToSessionMap: LessonSessionMap,
  classLessons: ClassLesson[],
  sessions: Awaited<ReturnType<typeof sessionsDao.listSessionsByClass>>,
): LessonSessionMap {
  const sessionMapDb = new Map(sessions.map((session) => [session.id, session]));
  const result = new Map(lessonToSessionMap);

  for (const lesson of classLessons) {
    if (!lesson.session_id) {
      continue;
    }

    const matchedSession = sessionMapDb.get(lesson.session_id);
    if (matchedSession) {
      result.set(lesson.id, matchedSession);
    }
  }

  return result;
}

type PersonalJourneyStatus = Awaited<ReturnType<typeof coderProgressDao.getCoderJourney>>[number]['status'];

function mergeJourneyStatus(
  runtimeStatus: RuntimeBlockStatus,
  personalStatus?: PersonalJourneyStatus,
): RuntimeBlockStatus {
  if (!personalStatus) {
    return runtimeStatus;
  }

  if (personalStatus === 'COMPLETED') {
    return 'COMPLETED';
  }

  if (personalStatus === 'IN_PROGRESS') {
    return runtimeStatus === 'COMPLETED' ? 'COMPLETED' : 'CURRENT';
  }

  return runtimeStatus === 'CURRENT' ? 'CURRENT' : 'UPCOMING';
}

function compareBlocksByCurriculumOrder(a: WeeklyBlock, b: WeeklyBlock): number {
  if (a.block_order_index != null && b.block_order_index != null && a.block_order_index !== b.block_order_index) {
    return a.block_order_index - b.block_order_index;
  }

  const dateDiff = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  if (dateDiff !== 0) {
    return dateDiff;
  }

  return a.id.localeCompare(b.id);
}

function buildDisplayedJourneyBlocks(
  curriculumBlocks: WeeklyBlock[],
  journeyOrderedBlocks: WeeklyBlock[],
  journeyStatusMap: Map<string, PersonalJourneyStatus>,
): WeeklyBlock[] {
  if (curriculumBlocks.length === 0) {
    return journeyOrderedBlocks;
  }

  const currentIndex = curriculumBlocks.findIndex(
    (block) => journeyStatusMap.get(block.block_id) === 'IN_PROGRESS',
  );

  if (currentIndex < 0) {
    const allCompleted = curriculumBlocks.every(
      (block) => journeyStatusMap.get(block.block_id) === 'COMPLETED',
    );
    return allCompleted ? curriculumBlocks : journeyOrderedBlocks;
  }

  let startIndex = currentIndex;
  while (true) {
    const previousIndex = (startIndex - 1 + curriculumBlocks.length) % curriculumBlocks.length;
    if (previousIndex === currentIndex) {
      break;
    }
    if (journeyStatusMap.get(curriculumBlocks[previousIndex].block_id) !== 'COMPLETED') {
      break;
    }
    startIndex = previousIndex;
  }

  return [
    ...curriculumBlocks.slice(startIndex),
    ...curriculumBlocks.slice(0, startIndex),
  ];
}

function hasCompletedBlockAccess(
  journeyStatusMap: Map<string, PersonalJourneyStatus>,
  blockId: string | null | undefined,
): boolean {
  if (!blockId) {
    return false;
  }

  return journeyStatusMap.get(blockId) === 'COMPLETED';
}

function buildMappedSessionEntries(
  blocks: WeeklyBlock[],
  sessions: WeeklySession[],
  lessonMap: Awaited<ReturnType<typeof computeLessonSchedule>>,
): MappedSessionEntry[] {
  const classBlockByBlockId = new Map(
    blocks
      .filter((block) => Boolean(block.block_id))
      .map((block) => [block.block_id, block] as const),
  );

  return sessions
    .filter((session) => session.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
    .map((session) => {
      const slot = lessonMap.get(session.id);
      if (!slot) {
        return null;
      }

      const classBlock = classBlockByBlockId.get(slot.block.id);
      if (!classBlock) {
        return null;
      }

      return {
        session,
        slot,
        classBlock,
      };
    })
    .filter((entry): entry is MappedSessionEntry => entry !== null);
}

function buildRuntimeBlocks(
  blocks: WeeklyBlock[],
  mappedEntries: MappedSessionEntry[],
  now: Date,
): RuntimeBlockInfo[] {
  const entriesByClassBlockId = mappedEntries.reduce((map, entry) => {
    if (!map.has(entry.classBlock.id)) {
      map.set(entry.classBlock.id, []);
    }
    map.get(entry.classBlock.id)!.push(entry.session);
    return map;
  }, new Map<string, WeeklySession[]>());

  return blocks.map((block) => {
    const mappedSessions = [...(entriesByClassBlockId.get(block.id) ?? [])].sort(
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
    );
    const firstSessionAt = mappedSessions[0]?.date_time ?? null;
    const lastSessionAt = mappedSessions[mappedSessions.length - 1]?.date_time ?? null;
    const allCompleted = mappedSessions.length > 0 && mappedSessions.every((session) => session.status === 'COMPLETED');

    let runtimeStatus: RuntimeBlockStatus = 'UPCOMING';
    if (allCompleted) {
      runtimeStatus = 'COMPLETED';
    } else if (firstSessionAt && new Date(firstSessionAt).getTime() <= now.getTime()) {
      runtimeStatus = 'CURRENT';
    } else if (block.status === 'COMPLETED' && mappedSessions.length === 0) {
      runtimeStatus = 'COMPLETED';
    }

    return {
      ...block,
      runtimeStatus,
      mappedSessions,
      firstSessionAt,
      lastSessionAt,
    };
  });
}

function resolveBlockDisplayDates(
  block: Pick<WeeklyBlock, 'start_date' | 'end_date'>,
  runtimeBlock?: Pick<RuntimeBlockInfo, 'firstSessionAt' | 'lastSessionAt'> | null,
) {
  return {
    startDate: runtimeBlock?.firstSessionAt ?? block.start_date,
    endDate: runtimeBlock?.lastSessionAt ?? block.end_date,
  };
}

function findEntryBlockBySchedule(
  runtimeBlocks: RuntimeBlockInfo[],
  enrollmentAt: Date,
): RuntimeBlockInfo | null {
  const enrollmentMs = enrollmentAt.getTime();
  const blocksWithSessions = runtimeBlocks.filter((block) => block.firstSessionAt && block.lastSessionAt);

  const spanningBlock = blocksWithSessions.find((block) => {
    const firstMs = new Date(block.firstSessionAt!).getTime();
    const lastMs = new Date(block.lastSessionAt!).getTime();
    return firstMs <= enrollmentMs && lastMs >= enrollmentMs;
  });
  if (spanningBlock) {
    return spanningBlock;
  }

  const latestStartedBlock = [...blocksWithSessions]
    .filter((block) => new Date(block.firstSessionAt!).getTime() <= enrollmentMs)
    .sort((a, b) => new Date(a.firstSessionAt!).getTime() - new Date(b.firstSessionAt!).getTime())
    .pop();
  if (latestStartedBlock) {
    return latestStartedBlock;
  }

  return (
    [...blocksWithSessions]
      .filter((block) => new Date(block.firstSessionAt!).getTime() > enrollmentMs)
      .sort((a, b) => new Date(a.firstSessionAt!).getTime() - new Date(b.firstSessionAt!).getTime())[0] ??
    runtimeBlocks[0] ??
    null
  );
}

export async function getCoderProgress(coderId: string): Promise<CoderClassProgress[]> {
  const [classes, attendance, supabase] = await Promise.all([
    classesDao.listClassesForCoder(coderId),
    attendanceDao.listAttendanceByCoder(coderId),
    import('@/lib/supabaseServer').then(m => m.getSupabaseAdmin())
  ]);

  return Promise.all(
    classes.map(async (klass) => {
      // Common data
      const submissions = await rubricsDao.listRubricSubmissionsByCoder(klass.id, coderId);
      const sessions = await sessionsDao.listSessionsByClass(klass.id);
      const sessionIdSet = new Set(sessions.map((session) => session.id));
      const lastAttendance = attendance
        .filter(
          (record) =>
            (record.status === 'PRESENT' || record.status === 'LATE') &&
            sessionIdSet.has(record.session_id),
        )
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
      const semesterTag = submissions.find((submission) => submission.semester_tag)?.semester_tag ?? null;

      // Extract schedule
      const scheduleDays = Array.from(new Set(sessions.filter(s => s.status !== 'CANCELLED').map(s => new Date(s.date_time).toLocaleDateString('id-ID', { weekday: 'long' }))));
      const firstSessionTemplate = sessions.find(s => s.status !== 'CANCELLED');
      const timeInfo = firstSessionTemplate ? new Date(firstSessionTemplate.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null;

      // Fetch Coach Info
      let coachInfo = null;
      let coachAvatarUrl = null;
      if (klass.coach_id) {
        const { data: coachData } = await supabase.from('users').select('*').eq('id', klass.coach_id).single();
        if (coachData) {
          const cData = coachData as any;
          if (cData.avatar_url) {
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(cData.avatar_url);
            coachAvatarUrl = publicUrlData.publicUrl;
          }
          coachInfo = {
            name: cData.full_name,
            avatarUrl: coachAvatarUrl,
            whatsappNumber: cData.parent_contact_phone || cData.phone || null
          };
        }
      }

      // Fetch Level Name
      let levelName: string | null = null;
      if (klass.level_id) {
        const { data: levelData } = await supabase.from('levels').select('name').eq('id', klass.level_id).maybeSingle();
        if (levelData) {
          levelName = levelData.name;
        }
      }

      // --- EKSKUL HANDLING ---
      if (klass.type === 'EKSKUL') {
        let upNext: CoderClassProgress['upNext'] = null;
        let totalBlocks = 1; // Ekskul counts as 1 block/plan
        let completedBlocks = 0; // Logic for completion? Maybe if class end date passed?
        let journeyBlocks: CoderClassProgress['journeyBlocks'] = [];

        if (klass.ekskul_lesson_plan_id) {
          const plan = await import('@/lib/dao/ekskulPlansDao').then(m => m.getEkskulPlanWithDetails(klass.ekskul_lesson_plan_id!));

          if (plan) {
            // Determine status
            const now = new Date();
            const start = new Date(klass.start_date);
            const end = new Date(klass.end_date);
            let status: 'UPCOMING' | 'CURRENT' | 'COMPLETED' = 'UPCOMING';
            if (now > end) status = 'COMPLETED';
            else if (now >= start) status = 'CURRENT';

            completedBlocks = status === 'COMPLETED' ? 1 : 0;

            const software = plan.ekskul_plan_software.map(ps => ({
              id: ps.software.id,
              name: ps.software.name,
              version: ps.software.version,
              description: ps.software.description,
              installation_url: ps.software.installation_url,
              installation_instructions: ps.software.installation_instructions,
              minimum_specs: ps.software.minimum_specs as Record<string, string> | null,
              access_info: ps.software.access_info,
            }));

            // Find next upcoming session for Ekskul
            const nextSession = sessions
              .filter(s => (new Date(s.date_time) >= now && s.status !== 'COMPLETED' && s.status !== 'CANCELLED'))
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];

            // Calculate estimated total lessons
            const totalLessons = plan.ekskul_lessons.length;

            // For Ekskul journey - use lessons as nodes instead of blocks
            // Estimate progress based on completed sessions vs total lessons
            const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length;

            journeyBlocks = plan.ekskul_lessons
              .sort((a, b) => a.order_index - b.order_index)
              .map((lesson, index) => {
                // Determine lesson status based on session progress
                let lessonStatus: 'UPCOMING' | 'CURRENT' | 'COMPLETED' = 'UPCOMING';
                if (index < completedSessions) {
                  lessonStatus = 'COMPLETED';
                } else if (index === completedSessions) {
                  lessonStatus = 'CURRENT';
                }

                // Estimate dates for each lesson
                const lessonStartDate = new Date(klass.start_date);
                lessonStartDate.setDate(lessonStartDate.getDate() + (index * 7)); // Roughly weekly
                const lessonEndDate = new Date(lessonStartDate);
                lessonEndDate.setDate(lessonEndDate.getDate() + 7);

                return {
                  blockId: lesson.id, // Use lesson id as blockId for compatibility
                  name: lesson.title,
                  status: lessonStatus,
                  startDate: lessonStartDate.toISOString(),
                  endDate: lessonEndDate.toISOString(),
                  orderIndex: index,
                };
              });

            upNext = {
              blockId: plan.id,
              name: plan.name, // Use Plan Name as "Block" Name
              status: status,
              startDate: klass.start_date,
              endDate: klass.end_date,
              estimatedSessions: plan.ekskul_lessons.reduce((acc, l) => acc + (l.estimated_meetings || 1), 0),
              software: software,
              lessons: nextSession ? [{
                id: nextSession.id,
                title: `Sesi: ${new Date(nextSession.date_time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}`,
                summary: `Jam ${new Date(nextSession.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
                orderIndex: 0,
                slideUrl: null,
                status: 'NEXT' as const,
                scheduledAt: [nextSession.date_time]
              }] : []
            };
          }
        }

        return {
          classId: klass.id,
          name: klass.name,
          type: klass.type,
          levelName,
          currentBlockName: upNext?.name ?? null,
          upcomingBlockName: null,
          upNext,
          coach: coachInfo,
          schedule: {
            days: scheduleDays,
            timeInfo: timeInfo,
            zoomLink: klass.zoom_link || null
          },
          completedBlocks,
          totalBlocks,
          lastAttendanceAt: lastAttendance?.recorded_at ?? null,
          semesterTag,
          pendingBlocks: [],
          journeyBlocks, // Now populated with lessons for Ekskul
        };
      }

      // --- WEEKLY HANDLING (Existing Logic) ---
      const blocks = await classesDao.getClassBlocks(klass.id);
      const lessonMap = klass.level_id ? await computeLessonSchedule(klass.id, klass.level_id) : new Map();
      const nowProgress = new Date();
      const mappedEntries = buildMappedSessionEntries(blocks, sessions, lessonMap);
      const runtimeBlocks = buildRuntimeBlocks(blocks, mappedEntries, nowProgress);
      const runtimeBlockById = new Map(runtimeBlocks.map((block) => [block.id, block]));
      const currentScheduledBlock =
        runtimeBlocks.find((block) => block.runtimeStatus === 'CURRENT') ??
        runtimeBlocks.find((block) => block.runtimeStatus === 'UPCOMING') ??
        null;
      const upcomingScheduledBlock =
        currentScheduledBlock
          ? runtimeBlocks.find(
              (block) =>
                block.id !== currentScheduledBlock.id &&
                block.runtimeStatus !== 'COMPLETED' &&
                (
                  !currentScheduledBlock.firstSessionAt ||
                  !block.firstSessionAt ||
                  new Date(block.firstSessionAt).getTime() >= new Date(currentScheduledBlock.firstSessionAt).getTime()
                ),
            ) ?? null
          : runtimeBlocks.find((block) => block.runtimeStatus === 'UPCOMING') ?? null;

      // Fetch personalized journey order
      const journey = klass.level_id ? await coderProgressDao.getCoderJourney(coderId, klass.level_id) : [];
      const journeyStatusMap = new Map(journey.map((row) => [row.block_id, row.status]));
      const journeyOrderMap = new Map(journey.map(j => [j.block_id, j.journey_order]));
      const curriculumBlocks = [...blocks].sort(compareBlocksByCurriculumOrder);

      const totalBlocks = blocks.length;
      const currentBlock =
        blocks.find((block) => block.status === 'CURRENT') ??
        currentScheduledBlock ??
        blocks.find((block) => block.status === 'UPCOMING' && new Date(block.start_date) <= nowProgress && new Date(block.end_date) >= nowProgress);
      const upcomingBlock =
        blocks.find((block) => block.status === 'UPCOMING' && new Date(block.start_date) > nowProgress) ??
        upcomingScheduledBlock;

      // Sort blocks by journey_order if available, else standard order
      const journeyOrderedBlocks = [...blocks].sort((a, b) => {
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
      const sortedBlocks = buildDisplayedJourneyBlocks(
        curriculumBlocks,
        journeyOrderedBlocks,
        journeyStatusMap,
      );

      // Use the sorted index as the display order
      const journeyBlocks = sortedBlocks.map((block, index) => {
        const runtimeBlock = runtimeBlockById.get(block.id);
        const displayStatus = mergeJourneyStatus(
          runtimeBlock?.runtimeStatus ?? block.status,
          journeyStatusMap.get(block.block_id),
        );
        const displayDates = resolveBlockDisplayDates(block, runtimeBlock);

        return {
          blockId: block.block_id,
          name: block.block_name ?? 'Block',
          status: displayStatus,
          startDate: displayDates.startDate,
          endDate: displayDates.endDate,
          orderIndex: index,
        };
      });

      const completedBlocks = journeyBlocks.filter((block) => block.status === 'COMPLETED').length;
      const pendingBlocks = journeyBlocks
        .filter((block) => block.status !== 'COMPLETED')
        .map((block) => ({
          blockId: block.blockId,
          name: block.name,
          status: block.status,
          startDate: block.startDate,
          endDate: block.endDate,
        }));

      let upNext: CoderClassProgress['upNext'] = null;

      let currentOrUpcoming =
        currentBlock ??
        upcomingBlock ??
        currentScheduledBlock ??
        upcomingScheduledBlock ??
        sortedBlocks.find((block) => block.status === 'CURRENT') ??
        sortedBlocks.find((block) => block.status === 'UPCOMING');

      if (currentOrUpcoming) {
        const software = await getSoftwareByBlockId(currentOrUpcoming.block_id);
        const runtimeCurrentBlock = runtimeBlockById.get(currentOrUpcoming.id);
        const currentBlockDates = resolveBlockDisplayDates(currentOrUpcoming, runtimeCurrentBlock);

        // Use class_lessons (actual class data) instead of lesson_templates for accurate progress.
        // This matches the same logic used in getAccessibleLessonsForCoder.
        const classLessons = await classLessonsDao.listLessonsByClassBlock(currentOrUpcoming.id);
        const classLessonsSorted = [...classLessons].sort((a, b) => a.order_index - b.order_index);

        const lessonToSessionMap = buildClassLessonSessionMap(
          buildLessonToSessionMap(lessonMap, sessions),
          classLessonsSorted,
          sessions,
        );

        let hasMarkedNext = false;
        const allLessonsList = classLessonsSorted.map((lesson, index) => {
          const sessionForLesson = lessonToSessionMap.get(lesson.id) || null;


          // Determine status
          let isCompleted = false;
          let scheduledAtDates: string[] = [];
          let completedAtDates: string[] = [];

          if (sessionForLesson) {
            scheduledAtDates.push(sessionForLesson.date_time);
            if (sessionForLesson.status === 'COMPLETED') {
              isCompleted = true;
              completedAtDates.push(sessionForLesson.date_time);
            }
          }

          let lessonStatus: 'COMPLETED' | 'NEXT' | 'UPCOMING' | 'LOCKED' = 'UPCOMING';

          if (isCompleted) {
            lessonStatus = 'COMPLETED';
          } else if (sessionForLesson) {
            if (!hasMarkedNext) {
              lessonStatus = 'NEXT';
              hasMarkedNext = true;
            } else {
              lessonStatus = 'UPCOMING';
            }
          } else {
            // NO SESSION FOR LESSON: but since it's the active block, we at least show it as UPCOMING 
            // instead of LOCKED. This prevents the "empty syllabus" bug when sessions run out.
            if (!hasMarkedNext) {
              lessonStatus = 'NEXT'; // Promote the very first unscheduled lesson to NEXT to keep the UI active
              hasMarkedNext = true;
            } else {
              lessonStatus = 'UPCOMING';
            }
          }

          return {
            id: lesson.id,
            title: lesson.title,
            summary: lesson.template_summary ?? lesson.summary ?? null,
            orderIndex: lesson.order_index ?? index,
            slideUrl: lesson.template_slide_url ?? lesson.slide_url,
            status: lessonStatus,
            completedAt: completedAtDates.length > 0 ? completedAtDates : undefined,
            scheduledAt: scheduledAtDates.length > 0 ? scheduledAtDates : undefined
          };
        });

        upNext = {
          blockId: currentOrUpcoming.block_id ?? currentOrUpcoming.id,
          name: currentOrUpcoming.block_name ?? 'Block',
          status: currentOrUpcoming.status as 'UPCOMING' | 'CURRENT' | 'COMPLETED',
          startDate: currentBlockDates.startDate,
          endDate: currentBlockDates.endDate,
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
          lessons: allLessonsList,
        };
      } else if (sortedBlocks.length > 0) {
        // If they have no current or upcoming, it means they finished everything.
        // Let's show the final block's content so it doesn't look empty.
        const wrapAround = sortedBlocks[sortedBlocks.length - 1]; // Use last block instead of first
        const software = await getSoftwareByBlockId(wrapAround.block_id);
        
        const classLessons = await classLessonsDao.listLessonsByClassBlock(wrapAround.id);
        const classLessonsSorted = [...classLessons].sort((a, b) => a.order_index - b.order_index);

        const lessonToSessionMap = buildClassLessonSessionMap(
          buildLessonToSessionMap(lessonMap, sessions),
          classLessonsSorted,
          sessions,
        );

        const allLessonsList = classLessonsSorted.map((lesson, index) => {
          const sessionForLesson = lessonToSessionMap.get(lesson.id) || null;
          let isCompleted = false;
          let scheduledAtDates: string[] = [];
          let completedAtDates: string[] = [];
          if (sessionForLesson) {
            scheduledAtDates.push(sessionForLesson.date_time);
            if (sessionForLesson.status === 'COMPLETED') {
              isCompleted = true;
              completedAtDates.push(sessionForLesson.date_time);
            }
          }

          return {
            id: lesson.id,
            title: lesson.title,
            summary: lesson.template_summary ?? lesson.summary ?? null,
            orderIndex: lesson.order_index ?? index,
            slideUrl: lesson.template_slide_url ?? lesson.slide_url,
            status: isCompleted ? 'COMPLETED' : 'LOCKED' as any,
            completedAt: completedAtDates.length > 0 ? completedAtDates : undefined,
            scheduledAt: scheduledAtDates.length > 0 ? scheduledAtDates : undefined
          };
        });

        upNext = {
          blockId: wrapAround.block_id ?? wrapAround.id,
          name: wrapAround.block_name ?? 'Block',
          status: (runtimeBlockById.get(wrapAround.id)?.runtimeStatus ?? wrapAround.status) as 'UPCOMING' | 'CURRENT' | 'COMPLETED',
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
          lessons: allLessonsList,
        };
      }

      // Compute lastCompletedLesson fallback: find the last completed lesson
      // from a previous block if the current block has no COMPLETED lessons.
      let lastCompletedLesson: CoderClassProgress['lastCompletedLesson'] = null;
      const currentLessons = upNext?.lessons || [];
      const hasCompletedInCurrent = currentLessons.some((l: any) => l.status === 'COMPLETED');
      
      if (!hasCompletedInCurrent) {
        const lastCompletedEntry = [...mappedEntries]
          .filter((entry) => entry.session.status === 'COMPLETED')
          .pop();

        if (lastCompletedEntry) {
          lastCompletedLesson = {
            title: lastCompletedEntry.slot.lessonTemplate.title,
            summary: lastCompletedEntry.slot.lessonTemplate.summary ?? null,
            slideUrl: lastCompletedEntry.slot.lessonTemplate.slide_url ?? null,
          };
        }
      }

      return {
        classId: klass.id,
        name: klass.name,
        type: klass.type,
        levelName,
        currentBlockName: currentBlock?.block_name ?? null,
        upcomingBlockName: upcomingBlock?.block_name ?? null,
        upNext,
        coach: coachInfo,
        schedule: {
          days: scheduleDays,
          timeInfo: timeInfo,
          zoomLink: klass.zoom_link || null
        },
        completedBlocks,
        totalBlocks,
        lastAttendanceAt: lastAttendance?.recorded_at ?? null,
        semesterTag,
        lastCompletedLesson,
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
      isAccessible?: boolean;
    }>;
  }>;
};

export async function getAccessibleLessonsForCoder(coderId: string): Promise<CoderLessonOverview[]> {
  const [classes, grantedSessionIds] = await Promise.all([
    classesDao.listClassesForCoder(coderId),
    coderSessionAccessDao.listGrantedSessionIdsByCoder(coderId),
  ]);
  const now = new Date();

  return Promise.all(
    classes.map(async (klass) => {
      // --- EKSKUL HANDLING ---
      if (klass.type === 'EKSKUL') {
        if (!klass.ekskul_lesson_plan_id) {
          return {
            classId: klass.id,
            name: klass.name,
            blocks: [],
          };
        }

        const plan = await import('@/lib/dao/ekskulPlansDao').then(m => m.getEkskulPlanWithDetails(klass.ekskul_lesson_plan_id!));
        if (!plan) {
          return {
            classId: klass.id,
            name: klass.name,
            blocks: [],
          };
        }

        const sessions = await sessionsDao.listSessionsByClass(klass.id);
        const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length;

        // Map Ekskul Lessons to "Accessible Lessons"
        // Logic: Lesson is accessible if index < completedSessions OR if it's the current one (index == completedSessions)
        const accessibleLessons = plan.ekskul_lessons
          .sort((a, b) => a.order_index - b.order_index)
          .map((lesson, index) => {
            // Try to find matching session date?
            // We assume 1-to-1 mapping based on order
            // This is an estimation for Ekskul as they don't link directly in DB usually

            // Completed sessions
            const sortedSessions = sessions
              .filter(s => s.status === 'COMPLETED')
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

            let sessionDate: string | null = null;
            if (index < sortedSessions.length) {
              sessionDate = sortedSessions[index].date_time;
            } else if (index === sortedSessions.length) {
              // Check if there is a current/upcoming session
              const nextSession = sessions
                .filter(s => new Date(s.date_time) >= now && s.status !== 'COMPLETED' && s.status !== 'CANCELLED')
                .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];

              if (nextSession) sessionDate = nextSession.date_time;
            }

            return {
              id: lesson.id,
              title: lesson.title,
              summary: null, // Ekskul lessons do not have description in current type definition
              orderIndex: lesson.order_index,
              slideUrl: lesson.slide_url ?? null,
              exampleUrl: null, // Ekskul doesn't have example_url on lesson table usually?
              sessionDate: sessionDate
            };
          });

        return {
          classId: klass.id,
          name: klass.name,
          blocks: [{
            id: plan.id, // Use plan ID as block ID
            name: 'Modul Ekskul',
            status: 'CURRENT', // Rough estimate
            startDate: klass.start_date,
            endDate: klass.end_date,
            lessons: accessibleLessons
          }]
        };
      }

      // --- WEEKLY HANDLING ---
      const [blocks, sessions, enrollment] = await Promise.all([
        classesDao.getClassBlocks(klass.id),
        sessionsDao.listSessionsByClass(klass.id),
        classesDao.getEnrollment(klass.id, coderId),
      ]);

      const lessonMap = klass.level_id ? await computeLessonSchedule(klass.id, klass.level_id) : new Map();
      const lessonToSessionMap = buildLessonToSessionMap(lessonMap, sessions);
      const mappedEntries = buildMappedSessionEntries(blocks, sessions, lessonMap);
      const runtimeBlocks = buildRuntimeBlocks(blocks, mappedEntries, now);
      const journey = klass.level_id ? await coderProgressDao.getCoderJourney(coderId, klass.level_id) : [];
      const journeyStatusMap = new Map(journey.map((row) => [row.block_id, row.status]));

      const enrollmentDate = enrollment ? new Date(enrollment.enrolled_at) : new Date(0); // Default to epoch if no date (shouldn't happen)
      const entryBlock = enrollment ? findEntryBlockBySchedule(runtimeBlocks, enrollmentDate) : null;
      const activeBlock =
        blocks.find((block) => block.status === 'CURRENT') ??
        blocks.find((block) => block.status === 'UPCOMING') ??
        runtimeBlocks.find((block) => block.runtimeStatus === 'CURRENT') ??
        runtimeBlocks.find((block) => block.runtimeStatus === 'UPCOMING') ??
        null;

      const blockEntries = await Promise.all(
        blocks.map(async (block) => {
          const lessons = await classLessonsDao.listLessonsByClassBlock(block.id);

          const lessonsSorted = [...lessons].sort((a, b) => a.order_index - b.order_index);
          const classLessonToSessionMap = buildClassLessonSessionMap(
            lessonToSessionMap,
            lessonsSorted,
            sessions,
          );

          const accessibleLessons = lessonsSorted
            .map((lesson) => {
              const sessionMapped = classLessonToSessionMap.get(lesson.id) || null;
              const isCompletedBlock = hasCompletedBlockAccess(journeyStatusMap, block.block_id);
              const isArchived = sessionMapped ? grantedSessionIds.has(sessionMapped.id) : false;
              const isCatchUpInEntryBlock = Boolean(
                entryBlock &&
                  entryBlock.id === block.id &&
                  sessionMapped &&
                  new Date(sessionMapped.date_time).getTime() <= enrollmentDate.getTime(),
              );
              const isCompletedSinceEnrollment = Boolean(
                sessionMapped &&
                  sessionMapped.status === 'COMPLETED' &&
                  new Date(sessionMapped.date_time).getTime() >= enrollmentDate.getTime(),
              );
              const isAccessible =
                isCompletedBlock ||
                isArchived ||
                isCatchUpInEntryBlock ||
                isCompletedSinceEnrollment;
              
              return {
                id: lesson.id,
                title: lesson.title,
                summary: lesson.template_summary ?? null,
                orderIndex: lesson.order_index,
                slideUrl: lesson.slide_url ?? null,
                exampleUrl: (lesson as any).example_url ?? (lesson as any).coach_example_url ?? null,
                sessionDate: sessionMapped?.date_time ?? null,
                isAccessible,
              };
            });

          const hasAccessibleLesson = accessibleLessons.some((lesson) => lesson.isAccessible);
          const isCurrentScheduleBlock = activeBlock?.id === block.id;
          const isEntryBlock = entryBlock?.id === block.id;

          if (!hasAccessibleLesson && !isCurrentScheduleBlock && !isEntryBlock) {
            return null;
          }

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
        blocks: blockEntries.filter((b): b is NonNullable<typeof b> => b !== null),
      };
    }),
  );
}

export async function getStoredLessonsForCoder(coderId: string): Promise<CoderStoredLessonOverview[]> {
  const [sessionAccessRows, supabase] = await Promise.all([
    coderSessionAccessDao.listSessionAccessByCoder(coderId),
    import('@/lib/supabaseServer').then((m) => m.getSupabaseAdmin()),
  ]);

  if (sessionAccessRows.length === 0) {
    return [];
  }

  const classIds = Array.from(new Set(sessionAccessRows.map((row) => row.class_id)));
  const { data: classRows, error: classError } = await supabase
    .from('classes')
    .select('*')
    .in('id', classIds)
    .order('start_date', { ascending: true });

  if (classError) {
    throw new Error(`Failed to load stored lesson classes: ${classError.message}`);
  }

  const classes = (classRows ?? []) as Awaited<ReturnType<typeof classesDao.listClassesForCoder>>;
  const sessionAccessByClass = sessionAccessRows.reduce((map, row) => {
    if (!map.has(row.class_id)) {
      map.set(row.class_id, new Set<string>());
    }
    map.get(row.class_id)!.add(row.session_id);
    return map;
  }, new Map<string, Set<string>>());

  const results = await Promise.all(
    classes
      .filter((klass) => klass.type === 'WEEKLY')
      .map(async (klass) => {
        const grantedSessionIds = sessionAccessByClass.get(klass.id) ?? new Set<string>();
        if (grantedSessionIds.size === 0) {
          return null;
        }

        const [blocks, sessions] = await Promise.all([
          classesDao.getClassBlocks(klass.id),
          sessionsDao.listSessionsByClass(klass.id),
        ]);

        const lessonMap = klass.level_id ? await computeLessonSchedule(klass.id, klass.level_id) : new Map();
        const lessonToSessionMap = buildLessonToSessionMap(lessonMap, sessions);

        const blockEntries = await Promise.all(
          blocks.map(async (block) => {
            const lessons = await classLessonsDao.listLessonsByClassBlock(block.id);
            const storedLessons = lessons
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((lesson) => {
                const sessionMapped = lessonToSessionMap.get(lesson.id) || null;
                if (!sessionMapped || !grantedSessionIds.has(sessionMapped.id)) {
                  return null;
                }

                return {
                  id: lesson.id,
                  title: lesson.title,
                  summary: lesson.template_summary ?? lesson.summary ?? null,
                  orderIndex: lesson.order_index,
                  slideUrl: lesson.template_slide_url ?? lesson.slide_url,
                  exampleUrl: (lesson as any).example_url ?? (lesson as any).coach_example_url ?? null,
                  sessionDate: sessionMapped.date_time,
                  isAccessible: true as const,
                };
              })
              .filter((lesson): lesson is NonNullable<typeof lesson> => lesson !== null);

            if (storedLessons.length === 0) {
              return null;
            }

            return {
              id: block.id,
              name: block.block_name ?? 'Block',
              status: block.status === 'UPCOMING' ? 'CURRENT' as const : 'COMPLETED' as const,
              startDate: block.start_date,
              endDate: block.end_date,
              lessons: storedLessons,
            };
          }),
        );

        const visibleBlocks = blockEntries.filter((block): block is NonNullable<typeof block> => block !== null);
        if (visibleBlocks.length === 0) {
          return null;
        }

        return {
          classId: klass.id,
          name: klass.name,
          blocks: visibleBlocks,
        };
      }),
  );

  return results.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export async function getVisibleMaterialsForCoder(coderId: string) {
  const [activeClasses, sessionAccessRows, supabase] = await Promise.all([
    classesDao.listClassesForCoder(coderId),
    coderSessionAccessDao.listSessionAccessByCoder(coderId),
    import('@/lib/supabaseServer').then((m) => m.getSupabaseAdmin()),
  ]);
  const nowIso = new Date().toISOString();
  const activeClassMap = new Map(activeClasses.map((klass) => [klass.id, klass]));
  const archivedClassIds = Array.from(
    new Set(sessionAccessRows.map((row) => row.class_id).filter((classId) => !activeClassMap.has(classId))),
  );
  let archivedClasses: typeof activeClasses = [];

  if (archivedClassIds.length > 0) {
    const { data: archivedRows, error: archivedError } = await supabase
      .from('classes')
      .select('*')
      .in('id', archivedClassIds);

    if (archivedError) {
      throw new Error(`Failed to load archived material classes: ${archivedError.message}`);
    }

    archivedClasses = (archivedRows ?? []) as typeof activeClasses;
  }

  const allClasses = [...activeClasses, ...archivedClasses];
  const accessByClass = sessionAccessRows.reduce((map, row) => {
    if (!map.has(row.class_id)) {
      map.set(row.class_id, new Set<string>());
    }
    map.get(row.class_id)!.add(row.session_id);
    return map;
  }, new Map<string, Set<string>>());

  const results = await Promise.all(
    allClasses.map(async (klass) => {
      const sessions = await sessionsDao.listSessionsByClass(klass.id);
      const accessibleSessions = new Set<string>();

      if (klass.type === 'WEEKLY' && klass.level_id) {
        const [enrollment, blocks, lessonMap] = await Promise.all([
          classesDao.getEnrollment(klass.id, coderId),
          classesDao.getClassBlocks(klass.id),
          computeLessonSchedule(klass.id, klass.level_id),
        ]);
        const mappedEntries = buildMappedSessionEntries(blocks, sessions, lessonMap);
        const runtimeBlocks = buildRuntimeBlocks(blocks, mappedEntries, new Date(nowIso));
        const enrollmentDate = enrollment ? new Date(enrollment.enrolled_at) : null;
        const entryBlock = enrollmentDate ? findEntryBlockBySchedule(runtimeBlocks, enrollmentDate) : null;

        for (const session of sessions) {
          if (session.status !== 'COMPLETED') {
            continue;
          }

          const mappedEntry = mappedEntries.find((entry) => entry.session.id === session.id);
          const happenedAfterEnrollment =
            !enrollmentDate || new Date(session.date_time).getTime() >= enrollmentDate.getTime();
          const isCatchUpInEntryBlock =
            Boolean(
              enrollmentDate &&
                entryBlock &&
                mappedEntry &&
                mappedEntry.classBlock.id === entryBlock.id &&
                new Date(session.date_time).getTime() <= enrollmentDate.getTime(),
            );

          if (happenedAfterEnrollment || isCatchUpInEntryBlock) {
            accessibleSessions.add(session.id);
          }
        }
      }

      for (const sessionId of accessByClass.get(klass.id) ?? []) {
        accessibleSessions.add(sessionId);
      }

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

  return results.filter((entry) => entry.materials.length > 0);
}

export async function getLessonDetailForCoder(coderId: string, lessonId: string) {
  const lesson = await classLessonsDao.getClassLessonById(lessonId);
  if (!lesson) {
    // Try fetching as Ekskul Lesson
    const ekskulLesson = await import('@/lib/dao/ekskulPlansDao').then(m => m.getEkskulLessonById(lessonId));
    if (!ekskulLesson) return null;

    // Note: Ekskul lessons logic for access is slightly different (based on enrollment in the ekskul class)
    // We need to find the plan, then find the class that uses this plan and user is enrolled in.
    // Simplify: Check if user is enrolled in ANY class that has this ekskul plan id?  
    // But query is "lessonId". We know the lesson belongs to a plan.

    const planId = ekskulLesson.plan_id;
    if (!planId) return null;

    // Find active ekskul class for this coder that uses this plan
    const coderClasses = await classesDao.listClassesForCoder(coderId);
    const activeEkskulClass = coderClasses.find(c => c.type === 'EKSKUL' && c.ekskul_lesson_plan_id === planId);

    if (!activeEkskulClass) return null;

    // Check access - similar to list logic
    // If it's Ekskul, we might just allow access to everything if enrolled?
    // Or follow the "session completed" logic?
    // For now, let's allow access if enrolled, to fix the 404. 
    // User said "Materi yang sudah dipelajari".

    // Calculate session date mapping
    const plan = await import('@/lib/dao/ekskulPlansDao').then(m => m.getEkskulPlanWithDetails(planId));
    let sessionDate: string | null = null;

    if (plan) {
      // Sort lessons to find the index of the current lesson
      const sortedLessons = plan.ekskul_lessons.sort((a, b) => a.order_index - b.order_index);
      const lessonIndex = sortedLessons.findIndex(l => l.id === lessonId);

      if (lessonIndex !== -1) {
        const sessions = await sessionsDao.listSessionsByClass(activeEkskulClass.id);
        const sortedSessions = sessions
          .filter(s => s.status !== 'CANCELLED') // Should we exclude cancelled? Probably yes.
          .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

        if (lessonIndex < sortedSessions.length) {
          sessionDate = sortedSessions[lessonIndex].date_time;
        }
      }
    }

    return {
      id: ekskulLesson.id,
      class_block_id: 'EKSKUL', // Dummy
      lesson_template_id: null,
      title: ekskulLesson.title,
      summary: ekskulLesson.summary,
      order_index: ekskulLesson.order_index ?? 0,
      session_id: null,
      unlock_at: null,
      make_up_instructions: null,
      slide_url: ekskulLesson.slide_url,
      coach_example_url: null,
      coach_example_storage_path: null,
      created_at: ekskulLesson.created_at ?? new Date().toISOString(),
      updated_at: ekskulLesson.created_at ?? new Date().toISOString(),
      sessionDate: sessionDate
    };
  }

  const block = await classesDao.getClassBlockById(lesson.class_block_id);
  if (!block) return null;

  const now = new Date();

  const klass = await classesDao.getClassById(block.class_id);
  if (!klass) {
    return null;
  }

  const [enrollment, classSessions] = await Promise.all([
    classesDao.getEnrollment(block.class_id, coderId),
    sessionsDao.listSessionsByClass(block.class_id),
  ]);

  const classBlocks = await classesDao.getClassBlocks(block.class_id);
  const lessonMap = klass.level_id ? await computeLessonSchedule(klass.id, klass.level_id) : new Map();
  const lessonToSessionMap = buildLessonToSessionMap(lessonMap, classSessions);
  const runtimeBlocks = buildRuntimeBlocks(
    classBlocks,
    buildMappedSessionEntries(classBlocks, classSessions, lessonMap),
    now,
  );
  const journey = klass.level_id ? await coderProgressDao.getCoderJourney(coderId, klass.level_id) : [];
  const journeyStatusMap = new Map(journey.map((row) => [row.block_id, row.status]));
  const blockIndexById = new Map(runtimeBlocks.map((runtimeBlock, index) => [runtimeBlock.id, index]));
  const enrollmentDate = enrollment ? new Date(enrollment.enrolled_at) : null;
  const entryBlock = enrollmentDate ? findEntryBlockBySchedule(runtimeBlocks, enrollmentDate) : null;
  const effectiveSession = lessonToSessionMap.get(lesson.id) || null;
  const sessionGrantId = effectiveSession?.id ?? lesson.session_id ?? null;
  const hasSessionGrant = sessionGrantId
    ? await coderSessionAccessDao.hasCoderSessionAccess(coderId, sessionGrantId)
    : false;
  const isCompletedBlock = hasCompletedBlockAccess(journeyStatusMap, block.block_id);

  if ((!enrollment || enrollment.status !== 'ACTIVE') && !hasSessionGrant && !isCompletedBlock) {
    return null;
  }

  if (enrollment?.status === 'ACTIVE' && entryBlock && !hasSessionGrant && !isCompletedBlock) {
    const blockIndex = blockIndexById.get(block.id);
    const entryIndex = blockIndexById.get(entryBlock.id);
    if (
      blockIndex !== undefined &&
      entryIndex !== undefined &&
      blockIndex < entryIndex
    ) {
      return null;
    }
  }

  const isAccessible = (() => {
    if (isCompletedBlock) return true;
    if (hasSessionGrant) return true;
    if (lesson.unlock_at && new Date(lesson.unlock_at) <= now) return true;
    if (
      enrollmentDate &&
      entryBlock?.id === block.id &&
      effectiveSession &&
      new Date(effectiveSession.date_time).getTime() <= enrollmentDate.getTime()
    ) {
      return true;
    }

    if (effectiveSession) {
      return (
        effectiveSession.status === 'COMPLETED' &&
        (
          !enrollmentDate ||
          new Date(effectiveSession.date_time).getTime() >= enrollmentDate.getTime()
        )
      );
    }

    return false;
  })();

  if (!isAccessible) return null;

  return {
    ...lesson,
    sessionDate: effectiveSession?.date_time ?? null,
  };
}
