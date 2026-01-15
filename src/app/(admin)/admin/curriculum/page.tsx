import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, lessonTemplatesDao, levelsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import DeleteLevelButton from './DeleteLevelButton';
import AddLevelButton from './AddLevelButton';

export default async function AdminCurriculumPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const levels = await levelsDao.listLevels();
  const levelStats = await Promise.all(
    levels.map(async (level) => {
      const blocks = await blocksDao.listBlocksByLevel(level.id);
      const lessonCounts = await Promise.all(
        blocks.map(async (block) => (await lessonTemplatesDao.listLessonsByBlock(block.id)).length),
      );
      const totalLessons = lessonCounts.reduce((sum, count) => sum + count, 0);
      return { level, blockCount: blocks.length, lessonCount: totalLessons };
    }),
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Perencanaan Kurikulum</h1>
          <p style={{ color: '#64748b', maxWidth: '48rem', fontSize: '1rem', lineHeight: '1.6' }}>
            Kelola block dan lesson template per level. Struktur kurikulum yang dibuat di sini akan menjadi dasar bagi kelas-kelas.
          </p>
        </div>
        <AddLevelButton />
      </header>

      <ul style={levelListStyle}>
        {levelStats.map(({ level, blockCount, lessonCount }, index) => (
          <li key={level.id} style={levelItemStyle} className="hover-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff',
                color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', fontWeight: 700
              }}>
                {index + 1}
              </div>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#1e293b', display: 'block', marginBottom: '0.25rem' }}>{level.name}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
                    {blockCount} Block
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                    {lessonCount} Lesson
                  </span>
                </div>
              </div>
            </div>

            {level.description && (
              <div className="curriculum-description" style={{ flex: 1, padding: '0 2rem', color: '#475569', fontSize: '0.95rem', borderLeft: '1px solid #e2e8f0', minWidth: '200px', display: 'none' }}>
                {level.description}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingLeft: 'auto' }}>
              <Link href={`/admin/curriculum/${level.id}/blocks`} style={primaryActionStyle}>
                Kelola Block
              </Link>
              <DeleteLevelButton levelId={level.id} levelName={level.name} />
            </div>
          </li>
        ))}
      </ul>
      <style>{`
        .hover-card {
            transition: all 0.2s ease;
        }
        .hover-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
            border-color: #cbd5e1 !important;
        }
        @media (min-width: 1024px) {
            .curriculum-description {
                display: block !important;
            }
        }
      `}</style>
    </div>
  );
}

const levelListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const levelItemStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderRadius: '16px',
  padding: '1.25rem 1.5rem',
  background: '#fff',
  flexWrap: 'wrap',
  gap: '1.5rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};

const primaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.6rem 1.2rem',
  background: '#3b82f6',
  color: '#ffffff',
  fontWeight: 600,
  textDecoration: 'none',
  borderRadius: '10px',
  fontSize: '0.9rem',
  transition: 'background 0.2s',
  boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)',
};
