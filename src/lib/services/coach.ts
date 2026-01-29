
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
  isSubstitute?: boolean; // New flag
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
  const [ownClasses, subClasses] = await Promise.all([
    classesDao.listClassesForCoach(coachId),
    classesDao.listClassesWhereCoachIsSubstitute(coachId)
  ]);

  // Merge and deduplicate by ID
  const allClassesMap = new Map();
  ownClasses.forEach(c => allClassesMap.set(c.id, c));
  subClasses.forEach(c => allClassesMap.set(c.id, c));
  const classes = Array.from(allClassesMap.values());

  return Promise.all(
    classes.map(async (klass) => {
      const isMainCoach = klass.coach_id === coachId; // Determine logic here early to use if needed

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

      const relevantSessions = isMainCoach
        ? sessions
        : sessions.filter(s => s.substitute_coach_id === coachId);

      const nextSession = relevantSessions
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
        isSubstitute: !isMainCoach, // Set flag
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

  const ownSessionsPromises = classes.map(async (klass) => {
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
  });

  const [ownSessionsNested, subSessions] = await Promise.all([
    Promise.all(ownSessionsPromises),
    getSubstituteSessions(coachId)
  ]);

  const allSessions = [...ownSessionsNested.flat(), ...subSessions];

  // Sort by date
  return allSessions.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
}

// Function to get sessions where the coach is a substitute, mapped to ExtendedSession
async function getSubstituteSessions(coachId: string): Promise<ExtendedSession[]> {
  const subSessions = await sessionsDao.listAllSubstituteSessions(coachId);

  if (subSessions.length === 0) return [];

  // We need lesson info for these sessions
  // Groub by class to minimize computeLessonSchedule calls
  const sessionsByClass: Record<string, typeof subSessions> = {};
  subSessions.forEach(s => {
    if (!sessionsByClass[s.class_id]) sessionsByClass[s.class_id] = [];
    sessionsByClass[s.class_id].push(s);
  });

  const results = await Promise.all(
    Object.keys(sessionsByClass).map(async (classId) => {
      const classSessions = sessionsByClass[classId];
      // We need the levelId for computeLessonSchedule. 
      // Fortunately subSessions (CoachSessionRow) has class_name but not levelId.
      // We might need to fetch the class or just accept that title formatting might be imperfect if we lack levelId?
      // Actually computeLessonSchedule needs classId. It internally fetches template info if we don't pass optional args? 
      // No, computeLessonSchedule(classId, levelId) 
      // We need to fetch the class to get levelId.
      const classRecord = await classesDao.getClassById(classId);
      if (!classRecord) return [];

      const lessonMap = await computeLessonSchedule(classId, classRecord.level_id);

      return classSessions.map(session => {
        const lessonSlot = session.status !== 'CANCELLED' ? lessonMap.get(session.id) : null;
        return {
          ...session,
          class_name: session.class_name, // Already populated by listAllSubstituteSessions
          lesson: lessonSlot
            ? {
              title: formatLessonTitle(lessonSlot),
              block_name: lessonSlot.block.name ?? 'Unknown Block',
              slide_url: lessonSlot.lessonTemplate.slide_url,
              example_url: lessonSlot.lessonTemplate.example_url,
            }
            : null,
        } as ExtendedSession;
      });
    })
  );

  return results.flat();
}
