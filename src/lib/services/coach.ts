
import { classesDao, sessionsDao } from '@/lib/dao';
import type { ClassBlockRecord } from '@/lib/dao/classesDao';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';
import { getSoftwareByBlockId } from '@/lib/dao/blockSoftwareDao';

type SoftwareInfo = {
  id: string;
  name: string;
  version: string | null;
  installation_url: string | null;
  access_info: string | null;
};

type CoachClassSummary = {
  classId: string;
  name: string;
  type: 'WEEKLY' | 'EKSKUL';
  nextSessionDate?: string | null;
  nextLesson?: {
    title: string;
    slideUrl?: string | null;
    lessonTemplateId?: string | null;
  } | null;
  currentBlock?: {
    id?: string;
    name?: string | null;
    startDate: string;
    endDate: string;
    software?: SoftwareInfo[];
  } | null;
  upcomingBlock?: { name?: string | null; startDate: string; endDate: string } | null;
};

function pickBlock(blocks: (ClassBlockRecord & { block_name?: string | null })[], status: ClassBlockRecord['status']) {
  const block = blocks
    .filter((item) => item.status === status)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];
  if (!block) {
    return null;
  }
  return {
    id: block.block_id,
    name: block.block_name ?? null,
    startDate: block.start_date,
    endDate: block.end_date,
  };
}

export async function getCoachClassesWithBlocks(coachId: string): Promise<CoachClassSummary[]> {
  const classes = await classesDao.listClassesForCoach(coachId);

  return Promise.all(
    classes.map(async (klass) => {
      const [blocks, sessions, lessonMap] = await Promise.all([
        classesDao.getClassBlocks(klass.id),
        sessionsDao.listSessionsByClass(klass.id),
        computeLessonSchedule(klass.id, klass.level_id),
      ]);

      const currentBlockData = pickBlock(blocks, 'CURRENT');
      const upcomingBlock = pickBlock(blocks, 'UPCOMING');

      // Fetch software for current block
      let currentBlock = null;
      if (currentBlockData) {
        const software = currentBlockData.id ? await getSoftwareByBlockId(currentBlockData.id) : [];
        currentBlock = {
          ...currentBlockData,
          software: software.map(s => ({
            id: s.id,
            name: s.name,
            version: s.version,
            installation_url: s.installation_url,
            access_info: s.access_info,
          })),
        };
      }

      const nextSession = sessions
        .filter((session) => new Date(session.date_time) >= new Date())
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];

      let nextLesson = null;
      if (nextSession && nextSession.status !== 'CANCELLED') {
        const slot = lessonMap.get(nextSession.id);
        if (slot) {
          nextLesson = {
            title: formatLessonTitle(slot),
            slideUrl: slot.lessonTemplate.slide_url,
            lessonTemplateId: slot.lessonTemplate.id,
          };
        }
      }

      return {
        classId: klass.id,
        name: klass.name,
        type: klass.type,
        nextSessionDate: nextSession?.date_time ?? null,
        nextLesson,
        currentBlock,
        upcomingBlock,
      };
    }),
  );
}

export type ExtendedSession = import('@/lib/dao/sessionsDao').SessionRecord & {
  class_name?: string;
  lesson?: {
    title: string;
    block_name: string;
    slide_url: string | null;
    example_url: string | null;
  } | null;
};

export async function getAllCoachSessions(coachId: string): Promise<ExtendedSession[]> {
  const classes = await classesDao.listClassesForCoach(coachId);

  const results = await Promise.all(
    classes.map(async (klass) => {
      const [sessions, lessonMap] = await Promise.all([
        sessionsDao.listSessionsByClass(klass.id),
        computeLessonSchedule(klass.id, klass.level_id),
      ]);

      return sessions.map((session) => {
        const lessonSlot = session.status !== 'CANCELLED' ? lessonMap.get(session.id) : null;
        return {
          ...session,
          class_name: klass.name,
          lesson: lessonSlot
            ? {
              title: formatLessonTitle(lessonSlot),
              block_name: lessonSlot.block.name ?? 'Unknown Block',
              slide_url: lessonSlot.lessonTemplate.slide_url,
              example_url: lessonSlot.lessonTemplate.example_url,
            }
            : null,
        };
      });
    }),
  );

  return results.flat();
}
