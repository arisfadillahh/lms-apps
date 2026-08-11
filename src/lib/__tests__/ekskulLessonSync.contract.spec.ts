import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ekskul lesson sync contracts', () => {
  it('syncs active ekskul classes after RnD lesson changes', () => {
    const updateRoute = readSource('src/app/api/admin/ekskul/lessons/[id]/route.ts');
    const createRoute = readSource('src/app/api/admin/ekskul/lessons/route.ts');
    const bulkUpdateRoute = readSource('src/app/api/admin/ekskul/lessons/bulk-update/route.ts');

    expect(updateRoute).toContain("import { reorderEkskulLesson, syncEkskulPlanAfterChange }");
    expect(updateRoute).toContain('await reorderEkskulLesson(parsed.data.planId, lessonId, parsed.data.orderIndex)');
    expect(updateRoute).toContain('await syncEkskulPlanAfterChange(parsed.data.planId)');
    expect(updateRoute).toContain('await syncEkskulPlanAfterChange(lesson.plan_id)');
    expect(createRoute).toContain('await syncEkskulPlanAfterChange(parsed.data.planId)');
    expect(bulkUpdateRoute).toContain('await syncEkskulPlanAfterChange(lesson.plan_id)');
  });

  it('renumbers ekskul lesson order after changes', () => {
    const syncService = readSource('src/lib/services/ekskulLessonPlanSync.ts');

    expect(syncService).toContain('export async function renumberEkskulLessons');
    expect(syncService).toContain('const nextOrderIndex = index + 1');
    expect(syncService).toContain('await renumberEkskulLessons(planId)');
  });

  it('shows live ekskul lesson materials in admin and coder views', () => {
    const adminClassPage = readSource('src/app/(admin)/admin/classes/[id]/page.tsx');
    const sessionsTable = readSource('src/app/(admin)/admin/classes/[id]/SessionsTable.tsx');
    const coderService = readSource('src/lib/services/coder.ts');

    expect(adminClassPage).toContain("klass.type === 'EKSKUL'");
    expect(adminClassPage).toContain('await computeLessonSchedule(');
    expect(adminClassPage).toContain('slideUrl: slot.lessonTemplate.slide_url ?? null');
    expect(adminClassPage).toContain("showLessonLinks={klass.type === 'EKSKUL'}");
    expect(sessionsTable).toContain('lessonMap: Map<string, LessonDisplay>');
    expect(sessionsTable).toContain('showLessonLinks = false');
    expect(sessionsTable).toContain('Link Slide');
    expect(coderService).toContain('id: nextLessonEntry.lesson.id');
    expect(coderService).toContain('slideUrl: nextLessonEntry.lesson.slide_url ?? null');
  });
});
