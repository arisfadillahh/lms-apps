import { blocksDao, classesDao, coderProgressDao, coderSessionAccessDao, sessionsDao } from '@/lib/dao';
import type { ClassRecord, EnrollmentRecord } from '@/lib/dao/classesDao';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';

export async function initializeWeeklyEnrollmentJourney(input: {
  klass: ClassRecord;
  enrollment: EnrollmentRecord;
}) {
  const { klass, enrollment } = input;
  if (klass.type !== 'WEEKLY' || !klass.level_id) return;

  const [levelBlocks, classBlocks, sessions, lessonMap] = await Promise.all([
    blocksDao.listBlocksByLevel(klass.level_id),
    classesDao.getClassBlocks(klass.id),
    sessionsDao.listSessionsByClass(klass.id),
    computeLessonSchedule(klass.id, klass.level_id),
  ]);
  if (levelBlocks.length === 0) throw new Error('No curriculum blocks configured for this level');

  const sortedClassBlocks = [...classBlocks].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );
  const scheduledSessions = sessions
    .filter((session) => session.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  const nextScheduledEntry = scheduledSessions.find(
    (session) => session.status !== 'COMPLETED' && lessonMap.has(session.id),
  );
  const lastCompletedEntry = [...scheduledSessions]
    .filter((session) => session.status === 'COMPLETED' && lessonMap.has(session.id))
    .pop();
  const currentBlockId =
    (nextScheduledEntry ? lessonMap.get(nextScheduledEntry.id)?.block.id : null) ??
    (lastCompletedEntry ? lessonMap.get(lastCompletedEntry.id)?.block.id : null) ??
    classBlocks.find((block) => block.status === 'CURRENT')?.block_id ??
    sortedClassBlocks[0]?.block_id ??
    null;

  await coderProgressDao.ensureJourneyForCoder({
    coderId: enrollment.coder_id,
    levelId: klass.level_id,
    blocks: levelBlocks,
    entryBlockId: currentBlockId,
  });

  const enrollmentTime = new Date(enrollment.enrolled_at).getTime();
  const lastSeenEntry = [...scheduledSessions]
    .filter((session) => new Date(session.date_time).getTime() <= enrollmentTime && lessonMap.has(session.id))
    .pop();
  const firstUpcomingEntry = scheduledSessions.find(
    (session) => new Date(session.date_time).getTime() > enrollmentTime && lessonMap.has(session.id),
  );
  const entryBlockId =
    (lastSeenEntry ? lessonMap.get(lastSeenEntry.id)?.block.id : null) ??
    (firstUpcomingEntry ? lessonMap.get(firstUpcomingEntry.id)?.block.id : null) ??
    currentBlockId;
  const entryBlock =
    classBlocks.find((block) => block.block_id === entryBlockId) ??
    classBlocks.find((block) => block.status === 'CURRENT') ??
    sortedClassBlocks[0] ??
    null;

  if (!entryBlock?.block_id) return;
  const catchUpSessionIds = sessions
    .filter((session) => session.status !== 'CANCELLED')
    .filter((session) => new Date(session.date_time).getTime() <= enrollmentTime)
    .filter((session) => lessonMap.get(session.id)?.block.id === entryBlock.block_id)
    .map((session) => session.id);

  await coderSessionAccessDao.grantSessionAccesses(
    catchUpSessionIds.map((sessionId) => ({
      coderId: enrollment.coder_id,
      classId: klass.id,
      sessionId,
      grantedReason: 'TRANSFER_CATCH_UP' as const,
      sourceEnrollmentId: enrollment.id,
    })),
  );
}
