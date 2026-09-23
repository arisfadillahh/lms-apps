import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/report/[id]/page.tsx'),
  'utf8',
);

describe('A4 report print contract', () => {
  it('prints on portrait A4 with the Clevio logo inside the report hero', () => {
    expect(source).toContain('@page { size: A4 portrait;');
    expect(source).not.toContain('className="report-print-header hidden"');
    expect(source).toContain('className="report-hero-logo');
    expect(source).toContain('className="report-hero-logo hidden');
    expect(source).toContain('.report-hero-logo { display: block !important;');
    expect(source).toContain('justify-content: flex-start !important;');
    expect(source).toContain('alt="Clevio Innovator Camp"');
  });

  it('removes root overflow constraints and keeps competency cards together', () => {
    expect(source).toContain('overflow: visible !important;');
    expect(source).toContain('position: static !important;');
    expect(source).toContain('.report-root, .report-page, .report-page main {');
    expect(source).toContain('.report-hero-brand');
    expect(source).toContain('.report-competency-grid { display: block !important; }');
    expect(source).toContain('.report-competency-card { padding: 7px 9px !important; margin-bottom: 5px !important; }');
    expect(source).toContain('.report-competency-card p { margin-top: 4px !important; font-size: 9px !important; line-height: 1.2 !important; }');
    expect(source).not.toMatch(/\.report-section\[data-purpose="competency-feedback"\]\s*\{[^}]*break-before:\s*page/);
  });

  it('prints the learning journey as a compact vertical list with intact rows', () => {
    expect(source).toContain('<ol className="report-lesson-list mt-4"');
    expect(source).toContain('.report-lesson-list::before');
    expect(source).toContain('.report-lesson-row {');
    expect(source).toContain('page-break-inside: avoid !important;');
    expect(source).toContain('.report-lesson-number { width: 21px !important;');
    expect(source).toContain('.report-lesson-title { font-size: 10.5px !important;');
    expect(source).toContain('grid-template-columns: 88px minmax(0, 1fr) !important;');
    expect(source).toContain('white-space: nowrap !important;');
    expect(source).toContain('page-break-before: auto !important;');
    expect(source).toContain('page-break-after: avoid !important;');
    expect(source).toContain('.report-section[data-purpose="reflection-qa"] {');
  });

  it('uses semester terminology for Ekskul while preserving block for Weekly', () => {
    expect(source).toContain("const learningPeriodLabel = isEkskulReport ? 'semester' : 'block';");
    expect(source).toContain('selama {learningPeriodLabel} berlangsung.');
    expect(source).toContain('Perjalanan belajar dalam {learningPeriodLabel} ini');
  });
});
