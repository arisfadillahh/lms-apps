/** Ekskul lessons become available only after their matching class session is completed. */
export function isEkskulLessonAccessible(lessonIndex: number, completedSessionCount: number) {
  return lessonIndex >= 0 && lessonIndex < completedSessionCount;
}
