

// import DeleteClassButton from './DeleteClassButton'; // Moved to Client Component
import ClassListClient from './ClassListClient';

import { blocksDao, classLessonsDao, classesDao, levelsDao, sessionsDao, usersDao } from '@/lib/dao';
import { pickCurrentCycleProgressBlock, resolveCycleLessonProgress, resolveSessionProgress } from '@/lib/services/classCycleProgress';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import AdminClassesPageWrapper from './AdminClassesPageWrapper';

type EkskulPlanRow = {
  id: string;
  name: string | null;
};

type EkskulLessonMeetingRow = {
  estimated_meetings: number | null;
};

export default async function AdminClassesPage() {
  const supabase = getSupabaseAdmin();

  const [classes, coaches, levels, { data: ekskulPlansRaw }, { data: enrollmentsRaw }] = await Promise.all([
    classesDao.listClasses(),
    usersDao.listUsersByRole('COACH'),
    levelsDao.listLevels(),
    supabase.from('ekskul_lesson_plans').select('id, name').eq('is_active', true).order('name'),
    supabase.from('enrollments').select('class_id').eq('status', 'ACTIVE')
  ]);

  const enrollmentCounts = (enrollmentsRaw || []).reduce((acc: Record<string, number>, curr) => {
    acc[curr.class_id] = (acc[curr.class_id] || 0) + 1;
    return acc;
  }, {});

  const classProgressEntries = await Promise.all(
    classes.map(async (klass) => {
      const [classBlocks, sessions] = await Promise.all([
        classesDao.getClassBlocks(klass.id),
        sessionsDao.listSessionsByClass(klass.id),
      ]);

      if (klass.type === 'EKSKUL') {
        return [klass.id, resolveSessionProgress(sessions).percent] as const;
      }

      const currentCycleBlock = pickCurrentCycleProgressBlock(classBlocks);

      if (!currentCycleBlock) {
        return [klass.id, 0] as const;
      }

      const lessons = await classLessonsDao.listLessonsByClassBlock(currentCycleBlock.id);
      const progress = resolveCycleLessonProgress(lessons, sessions);

      return [
        klass.id,
        progress.percent,
      ] as const;
    }),
  );
  const classProgressMap = Object.fromEntries(classProgressEntries);

  const classesWithCounts = classes.map(c => ({
    ...c,
    studentCount: enrollmentCounts[c.id] || 0,
    curriculumProgress: classProgressMap[c.id] ?? 0
  }));

  // Calculate total meetings for each ekskul plan from lessons
  const ekskulPlans = await Promise.all(
    ((ekskulPlansRaw || []) as EkskulPlanRow[]).map(async (plan) => {
      const { data: lessons } = await supabase
        .from('ekskul_lessons')
        .select('estimated_meetings')
        .eq('plan_id', plan.id);

      const totalMeetings = ((lessons || []) as EkskulLessonMeetingRow[]).reduce(
        (sum, lesson) => sum + (lesson.estimated_meetings || 1),
        0,
      );
      return { ...plan, total_lessons: totalMeetings };
    })
  );

  const blockEntries = await Promise.all(
    levels.map(async (level) => {
      const blocks = await blocksDao.listBlocksByLevel(level.id);
      return [level.id, blocks] as const;
    }),
  );
  const levelBlocks: Record<string, Awaited<ReturnType<typeof blocksDao.listBlocksByLevel>>> = Object.fromEntries(
    blockEntries,
  );

  return (
    <div className="admin-page-stack">
      <AdminClassesPageWrapper
        coaches={coaches}
        levels={levels}
        levelBlocks={levelBlocks}
        ekskulPlans={ekskulPlans}
      />

      <ClassListClient
        initialClasses={classesWithCounts}
        coaches={coaches}
        levels={levels}
      />
    </div>
  );
}


