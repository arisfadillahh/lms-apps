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

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
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
