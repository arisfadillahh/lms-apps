const REGULAR_REPORT_WINDOW_DAYS = 21;

type RegularReportWindowBlock = {
  pitching_day_date: string | null;
};

const JAKARTA_OFFSET = '+07:00';

function parseJakartaDateStart(dateString: string): Date {
  return new Date(`${dateString}T00:00:00${JAKARTA_OFFSET}`);
}

function parseJakartaDateEnd(dateString: string): Date {
  return new Date(`${dateString}T23:59:59.999${JAKARTA_OFFSET}`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isRegularReportWindowActive(
  classBlock: RegularReportWindowBlock | null | undefined,
  now = new Date(),
): boolean {
  if (!classBlock?.pitching_day_date) return false;

  const startsAt = parseJakartaDateStart(classBlock.pitching_day_date);
  const endsAt = addDays(parseJakartaDateEnd(classBlock.pitching_day_date), REGULAR_REPORT_WINDOW_DAYS);
  const currentTime = now.getTime();

  return currentTime >= startsAt.getTime() && currentTime <= endsAt.getTime();
}

export function getRegularReportWindowDays() {
  return REGULAR_REPORT_WINDOW_DAYS;
}
