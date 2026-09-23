import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/report/[id]/page.tsx'),
  'utf8',
);

describe('A4 report print contract', () => {
  it('prints on portrait A4 with a visible Clevio identity header', () => {
    expect(source).toContain('@page { size: A4 portrait;');
    expect(source).toContain('className="report-print-header hidden"');
    expect(source).toContain('src={CLEVIO_LOGO_SRC}');
    expect(source).toContain('alt="Clevio Innovator Camp"');
  });

  it('lets the material panel flow across pages without splitting a lesson card', () => {
    expect(source).toContain('.report-lessons-panel {');
    expect(source).toContain('break-inside: auto !important;');
    expect(source).toContain('.report-lesson-card {');
    expect(source).toContain('page-break-inside: avoid !important;');
    expect(source).toContain('page-break-before: always !important;');
  });

  it('uses semester terminology for Ekskul while preserving block for Weekly', () => {
    expect(source).toContain("const learningPeriodLabel = isEkskulReport ? 'semester' : 'block';");
    expect(source).toContain('selama {learningPeriodLabel} berlangsung.');
    expect(source).toContain('Perjalanan belajar dalam {learningPeriodLabel} ini');
  });
});
