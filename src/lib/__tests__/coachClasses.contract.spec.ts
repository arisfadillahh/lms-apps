import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('coach class management routing contract', () => {
  it('links dashboard class management to the all-classes page', () => {
    const source = readSource('src/app/(coach)/coach/dashboard/page.tsx');

    expect(source).toContain('<Link href="/coach/classes"');
    expect(source).toContain('Kelola Semua Kelas');
  });

  it('renders all coach classes from getCoachClassesWithBlocks', () => {
    const source = readSource('src/app/(coach)/coach/classes/page.tsx');

    expect(source).toContain("import { getCoachClassesWithBlocks } from '@/lib/services/coach'");
    expect(source).toContain('getCoachClassesWithBlocks(session.user.id)');
    expect(source).toContain('classes.map((cls)');
    expect(source).toContain('href={`/coach/classes/${cls.classId}`}');
  });
});
