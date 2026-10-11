export const REPORT_DESCRIPTION_MAX_LENGTH = 240;

export function shortenReportDescription(value: string): string {
  const text = value.trim();
  if (text.length <= REPORT_DESCRIPTION_MAX_LENGTH) return text;

  const candidate = text.slice(0, REPORT_DESCRIPTION_MAX_LENGTH - 1);
  const sentenceEnds = Array.from(candidate.matchAll(/[.!?](?=\s|$)/g));
  const lastSentenceEnd = sentenceEnds.at(-1)?.index;

  if (lastSentenceEnd !== undefined && lastSentenceEnd >= REPORT_DESCRIPTION_MAX_LENGTH * 0.65) {
    return candidate.slice(0, lastSentenceEnd + 1).trimEnd();
  }

  const lastWordBoundary = candidate.lastIndexOf(' ');
  const end = lastWordBoundary >= REPORT_DESCRIPTION_MAX_LENGTH * 0.6
    ? lastWordBoundary
    : candidate.length;

  return `${candidate.slice(0, end).trimEnd()}…`;
}
