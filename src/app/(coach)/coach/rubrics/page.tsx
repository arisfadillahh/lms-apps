import { getSessionOrThrow } from '@/lib/auth';
import { getPendingLessonEvaluationsForCoach, getDraftReportsForCoach } from '@/lib/services/coach';
import RubricPageClient from './RubricPageClient';

export const revalidate = 0;


export default async function CoachRubricsPage() {
  const session = await getSessionOrThrow();
  const coachId = session.user.id;

  const [pendingLessons, draftReports] = await Promise.all([
    getPendingLessonEvaluationsForCoach(coachId),
    getDraftReportsForCoach(coachId)
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-10 pt-8 pb-16">
        <RubricPageClient 
          pendingLessons={pendingLessons as any}
          draftReports={draftReports as any}
        />
    </div>
  );
}
