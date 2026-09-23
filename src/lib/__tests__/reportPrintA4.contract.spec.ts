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
    expect(source).toContain('alt="Clevio Innovator Camp"');
  });

  it('removes root overflow constraints and keeps competency cards together', () => {
    expect(source).toContain('overflow: visible !important;');
    expect(source).toContain('position: static !important;');
    expect(source).toContain('.report-root, .report-page, .report-page main {');
    expect(source).toContain('.report-hero-brand');
    expect(source).toContain('.report-competency-card { padding: 10px !important; }');
    expect(source).toContain('font-size: 10px !important; line-height: 1.3 !important;');
    expect(source).not.toMatch(/\.report-section\[data-purpose="competency-feedback"\]\s*\{[^}]*break-before:\s*page/);
  });

  it('lets the material panel flow across pages without splitting a lesson card', () => {
    expect(source).toContain('.report-lessons-panel {');
    expect(source).toContain('break-inside: auto !important;');
    expect(source).toContain('.report-lesson-card {');
    expect(source).toContain('page-break-inside: avoid !important;');
    expect(source).toContain('page-break-before: always !important;');
    expect(source).toContain('.report-section[data-purpose="reflection-qa"] {');
  });

  it('uses semester terminology for Ekskul while preserving block for Weekly', () => {
    expect(source).toContain("const learningPeriodLabel = isEkskulReport ? 'semester' : 'block';");
    expect(source).toContain('selama {learningPeriodLabel} berlangsung.');
    expect(source).toContain('Perjalanan belajar dalam {learningPeriodLabel} ini');
  });
});
