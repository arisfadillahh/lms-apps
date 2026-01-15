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
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Manajemen Kelas</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem', fontSize: '1rem', lineHeight: '1.6' }}>
          Buat kelas baru, tentukan Coach utama, dan atur jadwal. Pembuatan sesi dan manajemen murid tersedia di dalam masing-masing kelas.
        </p>
      </div>

      <CreateClassForm coaches={coaches} levels={levels} levelBlocks={levelBlocks} ekskulPlans={ekskulPlans} />

      <section style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Daftar Kelas Aktif</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
              <tr>
                <th style={thStyle}>Nama Kelas</th>
                <th style={thStyle}>Tipe</th>
                <th style={thStyle}>Coach</th>
                <th style={thStyle}>Level</th>
                <th style={thStyle}>Jadwal</th>
                <th style={thStyle}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    Belum ada kelas yang dibuat.
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
                    <tr key={rowKey} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{klass.name}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: klass.type === 'WEEKLY' ? '#eff6ff' : '#fdf4ff',
                          color: klass.type === 'WEEKLY' ? '#3b82f6' : '#d946ef'
                        }}>
                          {klass.type}
                        </span>
                      </td>
                      <td style={tdStyle}>{coachMap.get(klass.coach_id) ?? <span style={{ color: '#94a3b8' }}>Belum ditentukan</span>}</td>
                      <td style={tdStyle}>{klass.level_id ? levelMap.get(klass.level_id) ?? '—' : '—'}</td>
                      <td style={tdStyle}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569' }}>
                          <span style={{ fontWeight: 500 }}>{klass.schedule_day}</span>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
                          {klass.schedule_time}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, width: '180px' }}>
                        {hasValidId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Link
                              href={`/admin/classes/${klass.id}`}
                              style={{
                                padding: '0.4rem 0.85rem',
                                borderRadius: '8px',
                                background: '#eff6ff',
                                color: '#3b82f6',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                textDecoration: 'none',
                                border: '1px solid #dbeafe',
                                transition: 'all 0.15s'
                              }}
                            >
                              Kelola
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
        </div>
      </section>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: '1rem 1.5rem',
  fontSize: '0.75rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
  padding: '1rem 1.5rem',
  fontSize: '0.9rem',
  color: '#334155',
  verticalAlign: 'middle',
};
