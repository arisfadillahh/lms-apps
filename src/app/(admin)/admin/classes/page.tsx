

// import DeleteClassButton from './DeleteClassButton'; // Moved to Client Component
import ClassListClient from './ClassListClient';

import { blocksDao, classesDao, levelsDao, usersDao } from '@/lib/dao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import AdminClassesPageWrapper from './AdminClassesPageWrapper';
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

  const classesWithCounts = classes.map(c => ({
    ...c,
    studentCount: enrollmentCounts[c.id] || 0
  }));

  // Calculate total meetings for each ekskul plan from lessons
  const ekskulPlans = await Promise.all(
    (ekskulPlansRaw || []).map(async (plan: any) => {
      const { data: lessons } = await (supabase as any)
        .from('ekskul_lessons')
        .select('estimated_meetings')
        .eq('plan_id', plan.id);

      const totalMeetings = (lessons || []).reduce((sum: number, l: any) => sum + (l.estimated_meetings || 1), 0);
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

  const coachMap = new Map(coaches.map((coach) => [coach.id, coach.full_name]));
  const levelMap = new Map(levels.map((level) => [level.id, level.name]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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


