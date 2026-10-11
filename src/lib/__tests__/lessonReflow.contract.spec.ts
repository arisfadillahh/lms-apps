import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('admin material reflow contract', () => {
  it('uses future lesson reflow instead of swapping two sessions', () => {
    const routeSource = readSource('src/app/api/admin/sessions/[id]/material/route.ts');

    expect(routeSource).toContain("import { reflowLessonsFromSession } from '@/lib/services/lessonAutoAssign'");
    expect(routeSource).toContain('await reflowLessonsFromSession(sessionId, classLessonId)');
    expect(routeSource).not.toContain('occupiedLesson');
    expect(routeSource).not.toContain('previousSessionId');
  });

  it('keeps completed history locked while reflowing scheduled future sessions', () => {
    const serviceSource = readSource('src/lib/services/lessonAutoAssign.ts');

    expect(serviceSource).toContain("targetSession.status !== 'SCHEDULED'");
    expect(serviceSource).toContain(".filter((session) => session.status === 'SCHEDULED')");
    expect(serviceSource).toContain("selectedBlock.status === 'COMPLETED'");
    expect(serviceSource).toContain('Cannot move a lesson from a previous or completed session');
    expect(serviceSource).toContain('buildReflowLessonQueue(blocks, lessonsByBlock, classLessonId, futureSessionIds)');
  });

  it('routes every lesson edit through snapshot-aware future synchronization', () => {
    const routeSource = readSource('src/app/api/admin/curriculum/lessons/[id]/route.ts');
    const rebalancerSource = readSource('src/lib/services/lessonRebalancer.ts');
    const classLessonsSource = readSource('src/lib/dao/classLessonsDao.ts');

    expect(routeSource).toContain('const requiresStructureSync =');
    expect(routeSource).toContain("Object.prototype.hasOwnProperty.call(updates, 'orderIndex')");
    expect(routeSource).toContain("Object.prototype.hasOwnProperty.call(updates, 'estimatedMeetingCount')");
    expect(routeSource).toContain('if ((requiresStructureSync || hasContentUpdate) && lesson.block_id)');
    expect(routeSource).toContain('await blocksDao.updateBlock(lesson.block_id, { isPublished: true })');
    expect(rebalancerSource).toContain('hasClassReachedTemplate(template.order_index');
    expect(classLessonsSource).not.toContain('Override with template values (live reference)');
  });
});
