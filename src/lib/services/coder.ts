import { attendanceDao, classLessonsDao, classesDao, materialsDao, rubricsDao, sessionsDao } from '@/lib/dao';

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

      const completedBlocks = submissions.filter((submission) => submission.block_id).length;
      const totalBlocks = klass.type === 'WEEKLY' ? blocks.length : null;
      const currentBlock = blocks.find((block) => block.status === 'CURRENT');
      const upcomingBlock = blocks.find((block) => block.status === 'UPCOMING');

      const sortedBlocks = [...blocks].sort((a, b) => {
        if (a.block_order_index != null && b.block_order_index != null) {
          return a.block_order_index - b.block_order_index;
        }
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
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

      const journeyBlocks = sortedBlocks.map((block) => ({
        blockId: block.block_id,
        name: block.block_name ?? 'Block',
        status: block.status,
        startDate: block.start_date,
        endDate: block.end_date,
        orderIndex: block.block_order_index ?? null,
      }));

      let upNext: CoderClassProgress['upNext'] = null;
      if (klass.type === 'WEEKLY') {
        const currentOrUpcoming =
          sortedBlocks.find((block) => block.status === 'CURRENT') ??
          sortedBlocks.find((block) => block.status === 'UPCOMING');

        if (currentOrUpcoming) {
          upNext = {
            blockId: currentOrUpcoming.block_id,
            name: currentOrUpcoming.block_name ?? 'Block',
            status: currentOrUpcoming.status,
            startDate: currentOrUpcoming.start_date,
            endDate: currentOrUpcoming.end_date,
            estimatedSessions: currentOrUpcoming.block_estimated_sessions ?? null,
          };
        } else if (sortedBlocks.length > 0) {
          const wrapAround = sortedBlocks[0];
          upNext = {
            blockId: wrapAround.block_id,
            name: wrapAround.block_name ?? 'Block',
            status: wrapAround.status,
            startDate: wrapAround.start_date,
            endDate: wrapAround.end_date,
            estimatedSessions: wrapAround.block_estimated_sessions ?? null,
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
      orderIndex: number;
      slideUrl: string | null;
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
              orderIndex: lesson.order_index,
              slideUrl: lesson.slide_url ?? null,
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
