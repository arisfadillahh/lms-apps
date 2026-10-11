const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type RecurringScheduleSession = {
  id: string;
  dateTime: string;
  curriculumOrder?: string | null;
};

export type RecurringScheduleUpdate = {
  id: string;
  dateTime: string;
};

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function toWibCalendarDate(dateTime: string) {
  const instant = new Date(dateTime);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid session date: ${dateTime}`);
  return new Date(instant.getTime() + WIB_OFFSET_MS);
}

function formatWibDate(calendarDate: Date, time: string) {
  const yyyy = calendarDate.getUTCFullYear();
  const mm = String(calendarDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(calendarDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${normalizeTime(time)}+07:00`;
}

function compareSessions(left: RecurringScheduleSession, right: RecurringScheduleSession) {
  const timeDifference = new Date(left.dateTime).getTime() - new Date(right.dateTime).getTime();
  if (timeDifference !== 0) return timeDifference;
  const curriculumDifference = (left.curriculumOrder ?? '').localeCompare(right.curriculumOrder ?? '');
  if (curriculumDifference !== 0) return curriculumDifference;
  return left.id.localeCompare(right.id);
}

export function buildRecurringScheduleUpdates({
  sessions,
  targetDayIndex,
  targetTime,
  nowMs = Date.now(),
}: {
  sessions: RecurringScheduleSession[];
  targetDayIndex: number;
  targetTime: string;
  nowMs?: number;
}): RecurringScheduleUpdate[] {
  if (!Number.isInteger(targetDayIndex) || targetDayIndex < 0 || targetDayIndex > 6) {
    throw new Error('Invalid target weekday');
  }

  let previousTargetMs = Number.NEGATIVE_INFINITY;
  return [...sessions].sort(compareSessions).map((session) => {
    const calendarDate = toWibCalendarDate(session.dateTime);
    calendarDate.setUTCDate(calendarDate.getUTCDate() + targetDayIndex - calendarDate.getUTCDay());

    let dateTime = formatWibDate(calendarDate, targetTime);
    let targetMs = new Date(dateTime).getTime();
    while (targetMs <= nowMs || targetMs <= previousTargetMs) {
      calendarDate.setTime(calendarDate.getTime() + WEEK_MS);
      dateTime = formatWibDate(calendarDate, targetTime);
      targetMs = new Date(dateTime).getTime();
    }

    previousTargetMs = targetMs;
    return { id: session.id, dateTime };
  });
}
