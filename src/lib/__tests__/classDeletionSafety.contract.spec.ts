import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('class deletion safety contract', () => {
  it('keeps the action menu outside the class detail link', () => {
    const source = readSource('src/app/(admin)/admin/classes/ClassListClient.tsx');
    const cardSource = source.slice(
      source.indexOf('const curriculumProgress'),
      source.indexOf('<Link href="#create-class-form"'),
    );

    expect(cardSource).toContain('position: \'absolute\', inset: 0, zIndex: 1');
    expect(cardSource).toContain('style={{ position: \'relative\', zIndex: 2 }}');
    expect(cardSource.indexOf('<DeleteClassButton')).toBeGreaterThan(cardSource.indexOf('/>'));
    expect(cardSource).not.toContain(
      '<Link href={`/admin/classes/${klass.id}`} key={rowKey}',
    );
  });

  it('cancels navigation and requires the exact class name', () => {
    const source = readSource('src/app/(admin)/admin/classes/DeleteClassButton.tsx');

    expect(source).toContain('event.preventDefault()');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('window.prompt(');
    expect(source).toContain('confirmationName.trim() !== className.trim()');
    expect(source).toContain('body: JSON.stringify({ confirmationName })');
  });

  it('validates the confirmation again on the server', () => {
    const source = readSource('src/app/api/admin/classes/[id]/route.ts');

    expect(source).toContain('const klass = await classesDao.getClassById(classId)');
    expect(source).toContain('confirmationName !== klass.name.trim()');
    expect(source.indexOf('confirmationName !== klass.name.trim()')).toBeLessThan(
      source.indexOf('await classesDao.deleteClass(classId)'),
    );
  });

  it('archives closed classes while retaining their linked history', () => {
    const source = readSource('src/lib/dao/classesDao.ts');
    const deleteSource = source.slice(
      source.indexOf('export async function deleteClass(id: string)'),
      source.indexOf('export async function updateClassBlock'),
    );

    expect(deleteSource).toContain("ClassDeletionBlockedError");
    expect(deleteSource).toContain(".eq('status', 'ACTIVE')");
    expect(deleteSource).toContain("period.status === 'ACTIVE'");
    expect(deleteSource).toContain('.update({ archived_at: new Date().toISOString() })');
    expect(deleteSource).toContain(".in('lifecycle_status', ['ENDED', 'CANCELLED'])");
    expect(deleteSource).not.toContain('.delete()');
    expect(deleteSource).not.toContain('class_id: null');
    expect(deleteSource).toContain("archivedClasses?.length === 1");
  });
});
