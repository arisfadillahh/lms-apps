import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('report draft reconciliation triggers', () => {
  it('rechecks report eligibility after Coach lesson scores are saved', () => {
    const route = read('src/app/api/coach/evaluations/route.ts');

    expect(route).toContain('after(async () =>');
    expect(route).toContain('generateDraftReportsForClasses([klass.id])');
    expect(route.indexOf('await reportsDao.upsertLessonEvaluations')).toBeLessThan(route.indexOf('after(async () =>'));
  });

  it('rechecks report eligibility after the Coder reflection is saved', () => {
    const route = read('src/app/api/coder/block-evaluations/route.ts');

    expect(route).toContain('after(async () =>');
    expect(route).toContain('generateDraftReportsForClasses([classId])');
    expect(route.indexOf('.insert({')).toBeLessThan(route.indexOf('after(async () =>'));
  });

  it('moves the Coach issue reporter out of the floating layout slot', () => {
    const layout = read('src/app/(coach)/coach/layout.tsx');
    const sidebar = read('src/app/(coach)/coach/CoachSidebar.tsx');

    expect(layout).not.toContain('<IssueReportButton role="COACH" />');
    expect(sidebar).toContain('<IssueReportButton role="COACH" placement="sidebar" />');
  });
});
