import { splitEkskulLessonMakeUp } from '@/lib/ekskulMakeUpInstructions';

type Lesson = {
  id: string; title: string; order_index: number; estimated_meetings: number | null;
  summary: string | null; make_up_instructions?: string | null; slide_url: string | null;
};
type Session = { id: string; date_time: string; status: string };

/** Cancelled meetings do not consume a curriculum slot. Dates alone never prove completion. */
export function buildCoderEkskulProgress(lessons: Lesson[], sessions: Session[], now: Date) {
  const activeSessions = sessions.filter(s => s.status !== 'CANCELLED')
    .sort((a, b) => Date.parse(a.date_time) - Date.parse(b.date_time));
  const slots = [...lessons].sort((a, b) => a.order_index - b.order_index)
    .flatMap(lesson => Array.from({ length: Math.max(1, lesson.estimated_meetings || 1) }, (_, part) => ({ lesson, part })));
  // Keep the current meeting selected throughout the dashboard's two-hour class window.
  const nextId = activeSessions.find(s => s.status !== 'COMPLETED' && Date.parse(s.date_time) + 120 * 60_000 >= now.getTime())?.id;
  const mappedLessons = slots.map(({ lesson, part }, index) => {
    const session = activeSessions[index];
    const status: 'COMPLETED' | 'NEXT' | 'UPCOMING' | 'LOCKED' = !session ? 'LOCKED'
      : session.status === 'COMPLETED' ? 'COMPLETED' : session.id === nextId ? 'NEXT' : 'UPCOMING';
    return {
      id: lesson.id,
      title: lesson.estimated_meetings && lesson.estimated_meetings > 1 ? `${lesson.title} (Part ${part + 1})` : lesson.title,
      summary: splitEkskulLessonMakeUp(lesson.summary, lesson.make_up_instructions).summary,
      slideUrl: lesson.slide_url,
      orderIndex: index,
      status,
      scheduledAt: session ? [session.date_time] : [],
      completedAt: session?.status === 'COMPLETED' ? [session.date_time] : [],
    };
  });
  const total = Math.max(activeSessions.length, slots.length);
  const completed = activeSessions.filter(s => s.status === 'COMPLETED').length;
  const journey = [...lessons].sort((a, b) => a.order_index - b.order_index).map(lesson => {
    const meetings = mappedLessons.filter(l => l.id === lesson.id);
    const status: 'COMPLETED' | 'CURRENT' | 'UPCOMING' = meetings.every(l => l.status === 'COMPLETED') ? 'COMPLETED'
      : meetings.some(l => l.status === 'COMPLETED' || l.status === 'NEXT') ? 'CURRENT' : 'UPCOMING';
    return { blockId: lesson.id, name: lesson.title, status, orderIndex: lesson.order_index,
      startDate: meetings.flatMap(l => l.scheduledAt)[0] ?? null,
      endDate: meetings.flatMap(l => l.scheduledAt).at(-1) ?? null };
  });
  return { lessons: mappedLessons, journey, percent: total ? Math.round(completed / total * 100) : 0 };
}
