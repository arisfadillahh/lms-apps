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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Perencanaan Kurikulum</h1>
          <p style={{ color: '#64748b', maxWidth: '48rem' }}>
            Kelola block dan lesson template per level. Perubahan langsung berdampak ke kelas yang menggunakan level tersebut.
          </p>
        </div>
        <AddLevelButton />
      </header>

      <ul style={levelListStyle}>
        {levelStats.map(({ level, blockCount, lessonCount }, index) => (
          <li key={level.id} style={levelItemStyle}>
            <div>
              <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{index + 1}. {level.name}</strong>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                {blockCount} block • {lessonCount} lesson
              </p>
              {level.description ? (
                <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.25rem' }}>{level.description}</p>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href={`/admin/curriculum/${level.id}/blocks`} style={primaryActionStyle}>
                Kelola Block →
              </Link>
              <DeleteLevelButton levelId={level.id} levelName={level.name} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const emptyStateStyle: CSSProperties = {
  padding: '1rem 1.25rem',
  borderRadius: '0.75rem',
  border: '1px dashed #cbd5f5',
  background: '#f8fafc',
  color: '#64748b',
  fontSize: '0.9rem',
};

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
  border: '1px solid #e2e8f0',
  borderRadius: '0.9rem',
  padding: '1rem 1.25rem',
  background: '#fff',
  flexWrap: 'wrap',
  gap: '0.75rem',
};

const primaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.6rem 1rem',
  background: '#2563eb',
  color: '#ffffff',
  fontWeight: 600,
  textDecoration: 'none',
  borderRadius: '0.5rem',
  fontSize: '0.9rem',
  transition: 'background 0.2s',
};
