import { resolvePitchingDayDate } from '@/lib/services/pitchingDay';

export type BlockRuntimeStatus = 'COMPLETED' | 'CURRENT' | 'UPCOMING';

type RuntimeBlock = {
  start_date: string;
  end_date: string;
  pitching_day_date: string | null;
};

type RuntimeLesson = {
  session_id: string | null;
};

type RuntimeSession = {
  id: string;
  date_time: string;
};

type RuntimeProgressionBlock = {
  id: string;
  block_id: string | null;
  status: BlockRuntimeStatus;
  start_date: string;
  created_at?: string;
};

type RuntimeBlockTemplate = {
  id: string;
};

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function compareProgressionBlocks(a: RuntimeProgressionBlock, b: RuntimeProgressionBlock): number {
  const createdAtDiff = new Date(a.created_at ?? a.start_date).getTime() - new Date(b.created_at ?? b.start_date).getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  const startDateDiff = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  if (startDateDiff !== 0) {
    return startDateDiff;
  }

  return a.id.localeCompare(b.id);
}

export function resolveCurrentBlockIndex(blockStates: { hasFutureLesson: boolean }[]): number {
  const currentIndex = blockStates.findIndex((state) => state.hasFutureLesson);
  return currentIndex === -1 ? blockStates.length - 1 : currentIndex;
}

export function resolveBlockStatus(index: number, currentIndex: number): BlockRuntimeStatus {
  if (index < currentIndex) {
    return 'COMPLETED';
  }

  if (index === currentIndex) {
    return 'CURRENT';
  }

  return 'UPCOMING';
}

export function resolveNextBlockTemplateIndex(
  blocks: RuntimeProgressionBlock[],
  templates: RuntimeBlockTemplate[],
): number {
  if (templates.length === 0) {
    return 0;
  }

  const activeCycleBlocks = blocks
    .filter((block) => block.status === 'CURRENT' || block.status === 'UPCOMING')
    .slice()
    .sort(compareProgressionBlocks);
  const sortedBlocks = blocks.slice().sort(compareProgressionBlocks);
  const anchorBlock = activeCycleBlocks[activeCycleBlocks.length - 1] ?? sortedBlocks[sortedBlocks.length - 1];

  if (!anchorBlock?.block_id) {
    return 0;
  }

  const index = templates.findIndex((template) => template.id === anchorBlock.block_id);
  if (index < 0) {
    return 0;
  }

  return (index + 1) % templates.length;
}

export function resolveBlockRuntimeDates(
  block: RuntimeBlock,
  lessons: RuntimeLesson[],
  sessions: RuntimeSession[],
) {
  const sessionMap = new Map(sessions.map((session) => [session.id, session.date_time]));
  const mappedSessionDates = lessons
    .map((lesson) => (lesson.session_id ? sessionMap.get(lesson.session_id) ?? null : null))
    .filter((value): value is string => value !== null)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  if (mappedSessionDates.length === 0) {
    return {
      startDate: block.start_date,
      endDate: block.end_date,
      pitchingDayDate: block.pitching_day_date,
    };
  }

  const lastDate = formatDateOnly(new Date(mappedSessionDates[mappedSessionDates.length - 1]));

  return {
    startDate: formatDateOnly(new Date(mappedSessionDates[0])),
    endDate: lastDate,
    pitchingDayDate: resolvePitchingDayDate(mappedSessionDates, block.pitching_day_date),
  };
}
