function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolvePitchingDayDate(sessionDates: string[], fallbackDate: string | null): string | null {
  const sortedUniqueDates = Array.from(new Set(sessionDates))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  if (sortedUniqueDates.length === 0) {
    return fallbackDate;
  }

  const pitchingIndex = Math.max(sortedUniqueDates.length - 2, 0);
  return formatDateOnly(new Date(sortedUniqueDates[pitchingIndex]));
}
