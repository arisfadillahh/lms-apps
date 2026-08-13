import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ekskul example project URL contracts', () => {
  it('supports the URL in add, edit, and bulk update flows', () => {
    const add = readSource('src/app/(admin)/admin/ekskul/[id]/AddEkskulLessonButton.tsx');
    const edit = readSource('src/app/(admin)/admin/ekskul/[id]/EditEkskulLessonButton.tsx');
    const bulk = readSource('src/app/api/admin/ekskul/lessons/bulk-update/route.ts');

    expect(add).toContain('exampleUrl: exampleUrl.trim() || null');
    expect(add).toContain('Link Contoh Project');
    expect(edit).toContain('setExampleUrl(source.example_url || \'\')');
    expect(edit).toContain('exampleUrl: exampleUrl.trim() || null');
    expect(bulk).toContain('exampleUrl: z.string().url()');
    expect(bulk).toContain('example_url: update.exampleUrl || null');
  });

  it('keeps the URL available in list, spreadsheet, and CSV transfers', () => {
    const list = readSource('src/app/(admin)/admin/ekskul/[id]/EkskulLessonList.tsx');
    const detail = readSource('src/app/(admin)/admin/ekskul/[id]/page.tsx');
    const spreadsheet = readSource('src/app/(admin)/admin/ekskul/[id]/EkskulLessonSpreadsheet.tsx');
    const importer = readSource('src/app/(admin)/admin/ekskul/[id]/ImportEkskulLessonsButton.tsx');
    const exporter = readSource('src/app/api/admin/ekskul/plans/[id]/export/route.ts');

    expect(list).toContain('lesson.example_url');
    expect(detail).toContain("import EkskulLessonList from './EkskulLessonList'");
    expect(detail).toContain('<EkskulLessonList');
    expect(spreadsheet).toContain('exampleUrl: item.example_url || null');
    expect(importer).toContain('example_url');
    expect(importer).toContain('exampleUrl: lesson.exampleUrl || undefined');
    expect(exporter).toContain('slide_url,example_url,makeup_instructions');
    expect(exporter).toContain('escape(l.example_url)');
  });
});
