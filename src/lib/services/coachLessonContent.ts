/**
 * Resolve the example project URL shown to Coaches.
 *
 * Weekly class_lessons keep a class-scoped snapshot in coach_example_url,
 * while the curriculum template stores example_url. Prefer the snapshot when
 * it is present, then fall back to the template for older/incomplete rows.
 */
export function resolveCoachExampleUrl(
  classLessonUrl: string | null | undefined,
  templateUrl: string | null | undefined,
): string | null {
  const snapshotUrl = classLessonUrl?.trim();
  if (snapshotUrl) return snapshotUrl;

  const fallbackUrl = templateUrl?.trim();
  return fallbackUrl || null;
}
