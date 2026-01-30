

// import DeleteClassButton from './DeleteClassButton'; // Moved to Client Component
import ClassListClient from './ClassListClient';

import { blocksDao, classesDao, levelsDao, usersDao } from '@/lib/dao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

import CreateClassForm from './CreateClassForm';

export default async function AdminClassesPage() {
  const supabase = getSupabaseAdmin();

  const [classes, coaches, levels, { data: ekskulPlansRaw }] = await Promise.all([
    classesDao.listClasses(),
    usersDao.listUsersByRole('COACH'),
    levelsDao.listLevels(),
    supabase.from('ekskul_lesson_plans').select('id, name').eq('is_active', true).order('name'),
  ]);

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
      <div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Manajemen Kelas</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem', fontSize: '1rem', lineHeight: '1.6' }}>
          Buat kelas baru, tentukan Coach utama, dan atur jadwal. Pembuatan sesi dan manajemen murid tersedia di dalam masing-masing kelas.
        </p>
      </div>

      <CreateClassForm coaches={coaches} levels={levels} levelBlocks={levelBlocks} ekskulPlans={ekskulPlans} />

      <ClassListClient
        initialClasses={classes}
        coaches={coaches}
        levels={levels}
      />
    </div>
  );
}


