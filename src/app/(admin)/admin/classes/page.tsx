import type { CSSProperties } from 'react';
import Link from 'next/link';

import DeleteClassButton from './DeleteClassButton';

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
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Classes</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem' }}>
          Create classes, assign a primary coach, and configure schedules. Session generation and enrollment management is available per class.
        </p>
      </div>
      <CreateClassForm coaches={coaches} levels={levels} levelBlocks={levelBlocks} ekskulPlans={ekskulPlans} />
      <section style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Coach</th>
              <th style={thStyle}>Level</th>
              <th style={thStyle}>Schedule</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  No classes created yet.
                </td>
              </tr>
            ) : (
              classes.map((klass, index) => {
                const hasValidId = typeof klass.id === 'string' && klass.id.length > 0;
                const rowKey = hasValidId ? klass.id : `missing-${index}`;
                if (!hasValidId) {
                  console.warn('Class record without valid id detected', klass);
                }
                return (
                  <tr key={rowKey} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>{klass.name}</td>
                    <td style={tdStyle}>{klass.type}</td>
                    <td style={tdStyle}>{coachMap.get(klass.coach_id) ?? 'Unassigned'}</td>
                    <td style={tdStyle}>{klass.level_id ? levelMap.get(klass.level_id) ?? '—' : '—'}</td>
                    <td style={tdStyle}>
                      {klass.schedule_day} @ {klass.schedule_time}
                    </td>
                    <td style={tdStyle}>
                      {hasValidId ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Link
                            href={`/admin/classes/${klass.id}`}
                            style={{ color: '#2563eb', fontWeight: 500 }}
                          >
                            Manage
                          </Link>
                          <DeleteClassButton classId={klass.id} className={klass.name} />
                        </div>
                      ) : (
                        <span style={{ color: '#b91c1c', fontWeight: 500 }}>ID tidak valid</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: '#475569',
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  color: '#1f2937',
};
