import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('report responsive layout contract', () => {
  it('shares height-aware typography and bounded scrolling across weekly and trial stories', () => {
    const sharedLayout = fs.readFileSync(
      path.join(root, 'src/app/report/ReportStoryExperience.layoutFix.ts'),
      'utf8',
    );
    const weeklyStory = fs.readFileSync(
      path.join(root, 'src/app/report/[id]/ReportStoryExperience.tsx'),
      'utf8',
    );
    const trialStory = fs.readFileSync(
      path.join(root, 'src/app/trial-report/[token]/TrialStoryReport.tsx'),
      'utf8',
    );

    expect(weeklyStory).toContain('REPORT_STORY_LAYOUT_FIX');
    expect(trialStory).toContain('REPORT_STORY_LAYOUT_FIX');
    expect(sharedLayout).toContain('@media (max-height: 860px) and (min-width: 641px)');
    expect(sharedLayout).toContain('@media (max-height: 700px) and (min-width: 641px)');
    expect(sharedLayout).toContain('font-size: clamp(38px, min(5vw, 9vh), 68px);');
    expect(sharedLayout).toContain('max-height: calc(100dvh - 122px);');
    expect(sharedLayout).toContain('overflow-y: auto;');
  });

  it('stacks Coach report review panels on small screens and restores split view on desktop', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/app/(coach)/coach/reports/[id]/ReportReviewClient.tsx'),
      'utf8',
    );

    expect(source).toContain('min-h-screen flex-col overflow-x-hidden');
    expect(source).toContain('lg:h-screen lg:flex-row lg:overflow-hidden');
    expect(source).toContain('h-auto w-full');
    expect(source).toContain('lg:h-full lg:w-[38%]');
    expect(source).toContain('w-full flex-col overflow-visible');
    expect(source).toContain('lg:w-[62%] lg:overflow-hidden');
  });
});
