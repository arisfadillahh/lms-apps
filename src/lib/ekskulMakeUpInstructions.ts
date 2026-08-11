const MAKE_UP_START_TOKEN = "[CLEVIO_EKSKUL_MAKE_UP_TASK]";
const MAKE_UP_END_TOKEN = "[/CLEVIO_EKSKUL_MAKE_UP_TASK]";
const MAKE_UP_START = `\n\n${MAKE_UP_START_TOKEN}\n`;
const MAKE_UP_END = `\n${MAKE_UP_END_TOKEN}`;

export type EkskulLessonMakeUpParts = {
  summary: string | null;
  makeUpInstructions: string | null;
};

export function splitEkskulLessonMakeUp(
  summary: string | null | undefined,
  makeUpInstructions?: string | null,
): EkskulLessonMakeUpParts {
  const cleanColumnValue = normalizeText(makeUpInstructions);
  const parsed = parseSummaryMarker(summary);

  return {
    summary: parsed.summary,
    makeUpInstructions: cleanColumnValue ?? parsed.makeUpInstructions,
  };
}

export function serializeEkskulLessonSummary(
  summary: string | null | undefined,
  makeUpInstructions?: string | null,
): string | null {
  const parsed = parseSummaryMarker(summary);
  const cleanSummary = normalizeText(parsed.summary);
  const cleanMakeUp = normalizeText(makeUpInstructions);

  if (!cleanMakeUp) {
    return cleanSummary;
  }

  return `${cleanSummary ?? ""}${MAKE_UP_START}${cleanMakeUp}${MAKE_UP_END}`.trim();
}

function parseSummaryMarker(summary: string | null | undefined): EkskulLessonMakeUpParts {
  const rawSummary = summary ?? "";
  const startIndex = rawSummary.indexOf(MAKE_UP_START_TOKEN);
  if (startIndex === -1) {
    return {
      summary: normalizeText(rawSummary),
      makeUpInstructions: null,
    };
  }

  const before = rawSummary.slice(0, startIndex);
  const afterStart = startIndex + MAKE_UP_START_TOKEN.length;
  const endIndex = rawSummary.indexOf(MAKE_UP_END_TOKEN, afterStart);
  if (endIndex === -1) {
    return {
      summary: normalizeText(before),
      makeUpInstructions: normalizeText(rawSummary.slice(afterStart)),
    };
  }

  const after = rawSummary.slice(endIndex + MAKE_UP_END_TOKEN.length);
  return {
    summary: normalizeText(`${before}${after}`),
    makeUpInstructions: normalizeText(rawSummary.slice(afterStart, endIndex)),
  };
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
