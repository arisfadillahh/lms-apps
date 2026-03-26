
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
  studentsCount?: number;
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

      const enrollments = await classesDao.listEnrollmentsByClass(klass.id);
      const activeEnrollments = enrollments.filter(e => e.status === 'ACTIVE');

      return {
        classId: klass.id,
        name: klass.name,
        type: klass.type,
        nextSessionDate: nextSession?.date_time ?? null,
        nextLesson,
        currentBlock,
        upcomingBlock,
        isSubstitute: !isMainCoach, // Set flag
        studentsCount: activeEnrollments.length,
      };
    }),
  );
}

export type ExtendedSession = import('@/lib/dao/sessionsDao').SessionRecord & {
  class_name?: string;
  lesson?: {
    id: string;
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
            id: lessonSlot.lessonTemplate.id,
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
              id: lessonSlot.lessonTemplate.id,
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

// --- NEW CODER REPORT SYSTEM ---

export type PendingEvaluationLesson = {
  sessionId: string;
  classId: string;
  className: string;
  blockId: string | null;
  blockName: string | null;
  lessonTitle: string;
  sessionDates: string[];
  studentsCount: number;
};

export async function getPendingLessonEvaluationsForCoach(coachId: string): Promise<PendingEvaluationLesson[]> {
  // 1. Get all classes for this coach
  const classes = await classesDao.listClassesForCoach(coachId);
  const results: PendingEvaluationLesson[] = [];

  // 2. For each class, find COMPLETED sessions that belong to the main coach or substitute
  for (const klass of classes) {
    // Only fetch sessions where this coach is the actor or the main coach
    const sessions = await sessionsDao.listSessionsByClass(klass.id);
    const completedSessions = sessions.filter(
      s => s.status === 'COMPLETED' && (klass.coach_id === coachId || s.substitute_coach_id === coachId)
    );

    if (completedSessions.length === 0) continue;

    const lessonMap = await computeLessonSchedule(klass.id, klass.level_id);
    const activeEnrollments = (await classesDao.listEnrollmentsByClass(klass.id)).filter(e => e.status === 'ACTIVE');
    const classBlocks = await classesDao.getClassBlocks(klass.id);
    // ONLY evaluate lessons in the CURRENT active block. Do not leak to UPCOMING or COMPLETED blocks.
    const activeBlockIds = new Set(classBlocks.filter(b => b.status === 'CURRENT').map(b => b.block_id));
    
    // 3. Check which completed sessions already have evaluations
    for (const session of completedSessions) {
      const slot = lessonMap.get(session.id);
      if (!slot) continue;

      // Only evaluate lessons that belong to an active block (prevent 'bocor' from old completed blocks)
      if (!activeBlockIds.has(slot.block.id)) continue;

      // RULE: Only evaluate a lesson when ALL parts of that lesson are completed.
      // So if a lesson has 3 parts, we only ask for evaluation on Part 3.
      if (slot.partNumber !== slot.totalParts) {
        continue;
      }

      // 3. RULE: A lesson is pending if ANY active student does NOT have a SUBMITTED or PUBLISHED report for this block.
      // RULE: A lesson is pending if ANY active student has NO lesson_evaluations for this session.
      // We check lesson_evaluations directly — block_reports are created separately (H+1 or by system).
      const { data: existingEvals } = await (await import('@/lib/supabaseServer')).getSupabaseAdmin()
        .from('lesson_evaluations')
        .select('coder_id')
        .eq('session_id', session.id);

      const evaluatedCoderIds = new Set((existingEvals || []).map(e => e.coder_id));

      // Include all active enrollments, even if they joined after the session (migrasi late-joiners)
      // so the coach can evaluate them for past lessons they skipped within the CURRENT block.
      const relevantEnrollments = activeEnrollments;

      if (relevantEnrollments.length === 0) continue;

      const allEvaluated = relevantEnrollments.every(e => evaluatedCoderIds.has(e.coder_id));
      if (allEvaluated) continue;


      // Find all session dates that made up this lesson
      const lessonGlobalIndexStart = slot.globalIndex - slot.totalParts + 1;
      const lessonGlobalIndexEnd = slot.globalIndex;
      
      const relatedSessions = completedSessions.filter(s => {
          const sSlot = lessonMap.get(s.id);
          return sSlot && sSlot.globalIndex >= lessonGlobalIndexStart && sSlot.globalIndex <= lessonGlobalIndexEnd;
      });
      
      // Sort chronologically
      const sessionDates = relatedSessions.map(s => s.date_time).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      results.push({
        sessionId: session.id,
        classId: klass.id,
        className: klass.name,
        blockId: slot.block.id,
        blockName: slot.block.name ?? 'Unknown Block',
        lessonTitle: slot.lessonTemplate.title, // Use raw title without (Part X) suffix since it applies to the whole lesson
        sessionDates: sessionDates,
        studentsCount: activeEnrollments.length
      });
    }
  }

  // Sort by the last session date ascending (oldest pending first)
  return results.sort((a, b) => {
    const aLast = a.sessionDates[a.sessionDates.length - 1];
    const bLast = b.sessionDates[b.sessionDates.length - 1];
    return new Date(aLast).getTime() - new Date(bLast).getTime();
  });
}

export type DraftReportInfo = {
  reportId: string;
  coderId: string;
  coderName: string;
  classId: string;
  className: string;
  blockId: string;
  blockName: string;
  createdAt: string;
  averageScore?: number;
};

export async function getDraftReportsForCoach(coachId: string): Promise<DraftReportInfo[]> {
  const classes = await classesDao.listClassesForCoach(coachId);
  if (classes.length === 0) return [];
  
  const classIds = classes.map(c => c.id);
  
  // Directly query block_reports filtering by class ids and DRAFT status
  const supabase = (await import('@/lib/supabaseServer')).getSupabaseAdmin();
  const { data, error } = await supabase
    .from('block_reports')
    .select(`
      id,
      coder_id,
      class_id,
      block_id,
      created_at,
      average_score,
      classes:class_id(name),
      users:coder_id(full_name),
      blocks:block_id(name)
    `)
    .eq('status', 'DRAFT')
    .in('class_id', classIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch draft reports for coach', error);
    return [];
  }

  return (data || []).map(row => ({
    reportId: row.id,
    coderId: row.coder_id as string,
    coderName: (row.users as any)?.full_name ?? 'Coder',
    classId: row.class_id as string,
    className: (row.classes as any)?.name ?? 'Class',
    blockId: row.block_id as string,
    blockName: (row.blocks as any)?.name ?? 'Block',
    createdAt: row.created_at,
    averageScore: row.average_score ? Number(row.average_score) : undefined,
  }));
}
