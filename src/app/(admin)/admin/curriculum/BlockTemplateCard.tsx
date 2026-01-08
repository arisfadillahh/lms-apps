import type { CSSProperties } from 'react';

import type { BlockRecord } from '@/lib/dao/blocksDao';
import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';

import BlockLessonList from './BlockLessonList';

type BlockTemplateCardProps = {
  block: BlockRecord;
  lessons: LessonTemplateRecord[];
};

export default function BlockTemplateCard({ block, lessons }: BlockTemplateCardProps) {
  const sortedLessons = [...lessons].sort((a, b) => a.order_index - b.order_index);
  return (
    <section style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{block.name}</h3>
          {block.summary ? <p style={{ color: '#475569', fontSize: '0.9rem' }}>{block.summary}</p> : null}
        </div>
      </div>
      <div style={metaRowStyle}>
        <span>Order: {block.order_index}</span>
        <span>Jumlah lesson: {sortedLessons.length}</span>
        <span>Terakhir diupdate: {new Date(block.updated_at).toLocaleDateString()}</span>
      </div>

      <BlockLessonList blockId={block.id} lessons={sortedLessons} />
    </section>
  );
}

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  padding: '1.35rem 1.6rem',
  borderRadius: 'var(--radius-lg)',
  border: `1px solid var(--color-border)`,
  background: 'var(--color-bg-surface)',
  boxShadow: 'var(--shadow-medium)',
  color: 'var(--color-text-primary)',
};

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
};

const metaRowStyle: CSSProperties = {
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap',
  fontSize: '0.85rem',
  color: '#64748b',
};

const cardBodyStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1.5rem',
};

const settingsColumnStyle: CSSProperties = {
  flex: '1 1 320px',
  maxWidth: '360px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const lessonsColumnStyle: CSSProperties = {
  flex: '2 1 420px',
  minWidth: '320px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
};

const columnHeadingStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: '#0f172a',
};

const columnHelperStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748b',
  lineHeight: 1.5,
};

const lessonsHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
};

const lessonCountBadgeStyle: CSSProperties = {
  padding: '0.25rem 0.65rem',
  borderRadius: '999px',
  background: 'rgba(37, 99, 235, 0.12)',
  color: '#1d4ed8',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const lessonListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
};

const emptyStyle: CSSProperties = {
  padding: '0.9rem 1rem',
  borderRadius: '0.7rem',
  border: `1px dashed var(--color-border)`,
  color: 'var(--color-text-muted)',
  fontSize: '0.85rem',
  background: 'rgba(37, 99, 235, 0.05)',
};
