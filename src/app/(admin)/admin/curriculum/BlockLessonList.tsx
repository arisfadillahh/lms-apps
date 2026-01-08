"use client";

import { useState, type CSSProperties } from 'react';

import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';

import CreateLessonForm from './CreateLessonForm';
import LessonTemplateRow from './LessonTemplateRow';

type BlockLessonListProps = {
  blockId: string;
  lessons: LessonTemplateRecord[];
};

export default function BlockLessonList({ blockId, lessons }: BlockLessonListProps) {
  const [showForm, setShowForm] = useState(false);
  const sortedLessons = [...lessons].sort((a, b) => a.order_index - b.order_index);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <button type="button" onClick={() => setShowForm((prev) => !prev)} style={toggleButtonStyle}>
        {showForm ? '− Sembunyikan form lesson' : '+ Lesson baru'}
      </button>
      {showForm ? (
        <div style={formWrapperStyle}>
          <CreateLessonForm blockId={blockId} suggestedOrderIndex={sortedLessons.length} />
        </div>
      ) : null}
      {sortedLessons.length === 0 ? (
        <div style={emptyStyle}>Belum ada lesson pada block ini.</div>
      ) : (
        <div style={lessonListStyle}>
          {sortedLessons.map((lesson) => (
            <LessonTemplateRow key={lesson.id} lesson={lesson} />
          ))}
        </div>
      )}
    </div>
  );
}

const toggleButtonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '0.45rem 0.85rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  background: '#f8fafc',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
};

const formWrapperStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '0.75rem',
  background: '#fff',
};

const emptyStyle: CSSProperties = {
  padding: '0.8rem 1rem',
  borderRadius: '0.7rem',
  border: `1px dashed var(--color-border)`,
  color: 'var(--color-text-muted)',
  fontSize: '0.85rem',
  background: 'rgba(37, 99, 235, 0.05)',
};

const lessonListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
};
