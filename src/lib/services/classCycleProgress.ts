type CycleBlock = {
  id: string;
  status: string | null;
  start_date: string | null;
  created_at?: string | null;
};

type CycleLesson = {
  order_index: number | null;
  session_id: string | null;
};

type CycleSession = {
  id: string;
  status: string | null;
};

function safeDateTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function compareCycleBlocks<T extends CycleBlock>(left: T, right: T): number {
  const createdAtDiff =
    safeDateTime(left.created_at ?? left.start_date) - safeDateTime(right.created_at ?? right.start_date);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  const startDateDiff = safeDateTime(left.start_date) - safeDateTime(right.start_date);
  if (startDateDiff !== 0) {
    return startDateDiff;
  }

  return left.id.localeCompare(right.id);
}

function sortByCycleOrder<T extends CycleBlock>(blocks: T[]): T[] {
  return blocks.slice().sort(compareCycleBlocks);
}

function isActiveCycleBlock(block: CycleBlock): boolean {
  return block.status === 'CURRENT' || block.status === 'UPCOMING';
}

export function listCurrentCycleBlocks<T extends CycleBlock>(blocks: T[]): T[] {
  const activeBlocks = sortByCycleOrder(blocks.filter(isActiveCycleBlock));
  if (activeBlocks.length > 0) {
    return activeBlocks;
  }

  const sortedBlocks = sortByCycleOrder(blocks);
  const fallbackBlock = sortedBlocks[sortedBlocks.length - 1];
  return fallbackBlock ? [fallbackBlock] : [];
}

export function pickCurrentCycleProgressBlock<T extends CycleBlock>(blocks: T[]): T | null {
  const activeBlocks = listCurrentCycleBlocks(blocks);
  if (activeBlocks.length === 0) {
    return null;
  }

  const currentBlocks = activeBlocks.filter((block) => block.status === 'CURRENT');
  return currentBlocks[currentBlocks.length - 1] ?? activeBlocks[0] ?? null;
}

export function resolveCycleLessonProgress(
  lessons: CycleLesson[],
  sessions: CycleSession[],
): { completedLessons: number; totalLessons: number; percent: number } {
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const sortedLessons = lessons.slice().sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0));
  let lastCompletedIndex = -1;

  for (let index = 0; index < sortedLessons.length; index += 1) {
    const lesson = sortedLessons[index];
    if (!lesson.session_id) {
      continue;
    }

    const session = sessionMap.get(lesson.session_id);
    if (session?.status === 'COMPLETED') {
      lastCompletedIndex = index;
    }
  }

  const totalLessons = sortedLessons.length;
  const completedLessons = lastCompletedIndex + 1;

  return {
    completedLessons,
    totalLessons,
    percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
  };
}
