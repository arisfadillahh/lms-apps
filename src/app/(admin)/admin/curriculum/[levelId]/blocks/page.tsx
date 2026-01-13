import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, lessonTemplatesDao, levelsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import BlockList from '../../BlockList';
import CreateBlockForm from '../../CreateBlockForm';
import DeleteBlockButton from '../../DeleteBlockButton';
import UpdateBlockForm from '../../UpdateBlockForm';

export default async function LevelBlocksPage({ params }: { params: Promise<{ levelId: string }> }) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await params;
  const rawId = resolvedParams.levelId ?? '';
  const levelId = decodeURIComponent(rawId).trim();
  if (!levelId) {
    notFound();
  }

  const level = await levelsDao.getLevelById(levelId);
  if (!level) {
    notFound();
  }

  const blocks = await blocksDao.listBlocksByLevel(levelId);
  // Lesson counts are still useful
  const blockDetails = await Promise.all(
    blocks.map(async (block) => ({
      block,
      lessonCount: (await lessonTemplatesDao.listLessonsByBlock(block.id)).length,
    })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={headerStyle}>
        <div>
          <Link href="/admin/curriculum" style={backLinkStyle}>
            ← Semua level
          </Link>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{level.name}</h1>
          {level.description ? <p style={{ color: '#475569' }}>{level.description}</p> : null}
        </div>
        <CreateBlockForm levelId={level.id} suggestedOrderIndex={blockDetails.length + 1} />
      </div>

      {blockDetails.length === 0 ? (
        <p style={{ color: '#64748b' }}>Belum ada block pada level ini.</p>
      ) : (
        <BlockList
          items={blockDetails.map(({ block, lessonCount }) => ({
            id: block.id,
            title: block.name,
            order: block.order_index,
            summary: block.summary,
            lessonCount,
            manageUrl: `/admin/curriculum/${levelId}/blocks/${block.id}`,
            editDetail: <UpdateBlockForm block={block} />,
            deleteAction: <DeleteBlockButton blockId={block.id} blockName={block.name} />,
          }))}
        />
      )}
    </div>
  );
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap',
};

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: '0.5rem',
  color: '#2563eb',
  textDecoration: 'none',
};
