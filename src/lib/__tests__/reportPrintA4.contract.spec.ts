import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/report/[id]/page.tsx'),
  'utf8',
);

describe('A4 report print contract', () => {
  it('caps Coach-written observations so long copy cannot push the learning journey', () => {
    const coachReviewSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/(coach)/coach/reports/[id]/ReportReviewClient.tsx'),
      'utf8',
    );
    const publishRouteSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/coach/reports/[id]/publish/route.ts'),
      'utf8',
    );

    expect(coachReviewSource).toContain('maxLength={REPORT_DESCRIPTION_MAX_LENGTH}');
    expect(publishRouteSource).toContain('d.description.length > REPORT_DESCRIPTION_MAX_LENGTH');
    expect(source).toContain('description: shortenReportDescription(desc?.description || \'\')');
  });

  it('allows portrait or landscape A4 with the Clevio logo inside the report hero', () => {
    expect(source).toContain('@page { size: A4; margin: 10mm; }');
    expect(source).not.toContain('size: A4 landscape');
    expect(source).toContain('@media print and (orientation: landscape)');
    expect(source).not.toContain('className="report-print-header hidden"');
    expect(source).toContain('className="report-hero-logo');
    expect(source).toContain('className="report-hero-logo hidden');
    expect(source).toContain('.report-hero-logo { display: block !important;');
    expect(source).toContain('alt="Clevio Innovator Camp"');
  });

  it('keeps web typography and responsive layout while allowing print pagination', () => {
    expect(source).toContain('overflow: visible !important;');
    expect(source).toContain('position: static !important;');
    expect(source).toContain('.report-root, .report-page, .report-page main {');
    expect(source).toContain('.report-hero-logo { display: block !important;');
    expect(source).toContain('break-inside: avoid !important;');
    expect(source).toContain('md:grid-cols-2');
    expect(source).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
    expect(source).toContain('.report-competency-card[data-span-full="true"] { grid-column: 1 / -1 !important; }');
    expect(source).toContain("data-span-full={idx === breakdownData.length - 1 && breakdownData.length % 2 === 1 ? 'true' : undefined}");
    expect(source).toContain('sm:grid-cols-2 lg:grid-cols-5');
    expect(source).toContain('width: 1180px !important;');
    expect(source).toContain('zoom: 0.609 !important;');
    expect(source).toContain('.report-page { zoom: 0.887 !important; }');
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) 360px !important;');
    expect(source).toContain('.report-score-card { margin-top: 0 !important; }');
    expect(source).not.toContain('.report-section-heading h2 { font-size:');
    expect(source).not.toContain('.report-competency-card { padding:');
    expect(source).not.toMatch(/\.report-section\[data-purpose="competency-feedback"\]\s*\{[^}]*break-before:\s*page/);
  });

  it('prints the learning journey using the web card layout across A4 pages', () => {
    expect(source).toContain('.report-lessons-panel {');
    expect(source).toContain('className="report-lesson-grid grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"');
    expect(source).toContain('.report-lesson-card {');
    expect(source).toContain('report-lesson-card flex min-h-0 items-start gap-3');
    expect(source).toContain('min-w-0 pt-1 text-base font-bold leading-snug');
    expect(source).toContain('shrink-0 items-center justify-center rounded-md bg-[#22367b] px-1.5 text-sm');
    expect(source).not.toContain('report-lesson-card min-h-24');
    expect(source).toContain('page-break-inside: avoid !important;');
    expect(source).not.toContain('.report-lesson-card p { margin-top:');
    expect(source).toContain('page-break-before: auto !important;');
    expect(source).toContain('page-break-after: avoid !important;');
    expect(source).toContain('.report-section[data-purpose="reflection-qa"] {');
    expect(source).toContain('page-break-before: auto !important;');
    expect(source).toContain('[data-purpose="report-actions"] { display: none !important; }');
  });

  it('uses semester terminology for Ekskul while preserving block for Weekly', () => {
    expect(source).toContain("const learningPeriodLabel = isEkskulReport ? 'semester' : 'block';");
    expect(source).toContain('selama {learningPeriodLabel} berlangsung.');
    expect(source).toContain('Perjalanan belajar dalam {learningPeriodLabel} ini');
  });
});
