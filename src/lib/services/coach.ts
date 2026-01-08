import { classesDao, sessionsDao } from '@/lib/dao';
import type { ClassBlockRecord } from '@/lib/dao/classesDao';

type CoachClassSummary = {
  classId: string;
  name: string;
  type: 'WEEKLY' | 'EKSKUL';
  nextSessionDate?: string | null;
  currentBlock?: { name?: string | null; startDate: string; endDate: string } | null;
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
    name: block.block_name ?? null,
    startDate: block.start_date,
    endDate: block.end_date,
  };
}

export async function getCoachClassesWithBlocks(coachId: string): Promise<CoachClassSummary[]> {
  const classes = await classesDao.listClassesForCoach(coachId);

  return Promise.all(
    classes.map(async (klass) => {
      const [blocks, sessions] = await Promise.all([
        classesDao.getClassBlocks(klass.id),
        sessionsDao.listSessionsByClass(klass.id),
      ]);

      const currentBlock = pickBlock(blocks, 'CURRENT');
      const upcomingBlock = pickBlock(blocks, 'UPCOMING');
      const nextSession = sessions
        .filter((session) => new Date(session.date_time) >= new Date())
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];

      return {
        classId: klass.id,
        name: klass.name,
        type: klass.type,
        nextSessionDate: nextSession?.date_time ?? null,
        currentBlock,
        upcomingBlock,
      };
    }),
  );
}
