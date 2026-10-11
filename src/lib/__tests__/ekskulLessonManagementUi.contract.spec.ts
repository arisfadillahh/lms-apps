import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ekskul lesson management UI contracts', () => {
  it('separates the plan index from the full lesson manager', () => {
    const overview = readSource('src/app/(admin)/admin/ekskul/EkskulSplitViewClient.tsx');
    const detail = readSource('src/app/(admin)/admin/ekskul/[id]/page.tsx');

    expect(overview).toContain("import Link from 'next/link'");
    expect(overview).toContain('href={`/admin/ekskul/${plan.id}`}');
    expect(overview).toContain('Kelola Lesson');
    expect(overview).not.toContain('selectedId');
    expect(overview).not.toContain('EkskulLessonList');
    expect(detail).toContain('href="/admin/ekskul"');
    expect(detail).toContain('<EkskulLessonList');
  });

  it('keeps Weekly-style selection on desktop and mobile without a data mutation', () => {
    const manager = readSource('src/app/(admin)/admin/ekskul/[id]/EkskulLessonList.tsx');

    expect(manager).toContain('const [selectedIds, setSelectedIds]');
    expect(manager).toContain('const toggleSelectAll');
    expect(manager).toContain('const toggleSelect');
    expect(manager).toContain('<CheckSquare');
    expect(manager).toContain("isSelected ? selectedTrStyle : trStyle");
    expect(manager).toContain("isSelected ? ' is-selected' : ''");
    expect(manager).not.toContain('handleBulkDelete');
    expect(manager).not.toContain("method: 'DELETE'");
  });

  it('keeps edit actions visible and bound to the same lesson on mobile', () => {
    const weekly = readSource('src/app/(admin)/admin/curriculum/BlockLessonList.tsx');
    const ekskul = readSource('src/app/(admin)/admin/ekskul/[id]/EkskulLessonList.tsx');
    const ekskulEdit = readSource('src/app/(admin)/admin/ekskul/[id]/EditEkskulLessonButton.tsx');
    const styles = readSource('src/app/globals.css');

    expect(weekly).toContain('className="weekly-lesson-desktop"');
    expect(weekly).toContain('className="weekly-lesson-mobile-list"');
    expect(weekly).toContain('onClick={() => setEditingLessonId(lesson.id)}');
    expect(weekly).toContain('className="weekly-lesson-mobile-edit"');
    expect(weekly).toContain('aria-label={`Edit lesson ${lesson.title}`}');
    expect(ekskul).toContain('className="ekskul-lesson-mobile-actions"');
    expect(ekskul).toContain('<EditEkskulLessonButton lesson={lesson as any} planId={planId} />');
    expect(ekskulEdit).toContain('className="ekskul-lesson-edit-button"');
    expect(ekskulEdit).toContain('aria-label={`Edit lesson ${lesson.title}`}');
    expect(styles).toContain("[data-admin-shell='true'] .weekly-lesson-desktop");
    expect(styles).toContain("[data-admin-shell='true'] .weekly-lesson-mobile-list");
    expect(styles).toContain("[data-admin-shell='true'] .weekly-lesson-mobile-actions > *");
    expect(styles).toContain('min-height: 44px;');
  });
});
