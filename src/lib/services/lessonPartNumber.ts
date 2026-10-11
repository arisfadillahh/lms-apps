/**
 * Resolves the part number shown by a class lesson title.
 *
 * Extended lessons can retain the original title and append a new marker,
 * e.g. "Lesson (Part 4) (Part 5)". The final marker is the effective part
 * number; reading the first marker would hide the extension action again.
 */
export function resolveLessonPartNumber(
  title: string | null | undefined,
  totalParts: number,
  positionInGroup: number,
): number {
  const matches = title?.match(/\(Part\s+(\d+)\)/gi) ?? [];
  const lastMatch = matches.at(-1)?.match(/(\d+)/)?.[1];
  const parsedPart = lastMatch ? Number.parseInt(lastMatch, 10) : Number.NaN;

  if (Number.isInteger(parsedPart) && parsedPart > 0) {
    return parsedPart;
  }

  return totalParts > 1 ? positionInGroup + 1 : 1;
}
