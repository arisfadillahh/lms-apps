import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('class-scoped lesson extension contract', () => {
  it('stores extensions separately and marks only the extra class lesson', () => {
    const migration = readSource('supabase/migrations/20260813090000_lesson_extensions.sql');

    expect(migration).toContain('create table if not exists public.lesson_extensions');
    expect(migration).toContain('add column if not exists is_extended boolean not null default false');
    expect(migration).toContain('constraint lesson_extensions_source_once unique (source_class_lesson_id)');
    expect(migration).toMatch(/is_extended\s*\) values/i);
    expect(migration).toMatch(/true\s*\) returning \* into v_added/i);
  });

  it('locks and filters all scheduling mutations to the selected class', () => {
    const migration = readSource('supabase/migrations/20260813090000_lesson_extensions.sql');

    expect(migration).toMatch(/where id = p_class_id\s+for update/i);
    expect(migration).toContain('and class_id = p_class_id');
    expect(migration).toContain('and cb.class_id = p_class_id');
    expect(migration).not.toMatch(/update\s+public\.lesson_templates/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.lesson_templates/i);
  });

  it('preserves history, takes the next active meeting, and shifts later lessons', () => {
    const migration = readSource('supabase/migrations/20260813090000_lesson_extensions.sql');

    expect(migration).toContain("and status <> 'CANCELLED'");
    expect(migration).toContain('and date_time > v_session.date_time');
    expect(migration).toContain("completed_session.status = 'COMPLETED'");
    expect(migration).toContain('v_target_session_id := v_session_ids[1]');
    expect(migration).toContain('v_assignment_index := v_assignment_index + 1');
  });

  it('allows only the assigned coach on the current final lesson part', () => {
    const route = readSource('src/app/api/coach/lessons/extend/route.ts');

    expect(route).toContain("await assertRole(auth, 'COACH')");
    expect(route).toContain('classRecord.coach_id !== auth.user.id && sessionRecord.substitute_coach_id !== auth.user.id');
    expect(route).toContain('slot.partNumber !== slot.totalParts');
    expect(route).toContain("classRecord.type !== 'WEEKLY'");
  });

  it('keeps class extensions when global curriculum content is synchronized', () => {
    const rebalancer = readSource('src/lib/services/lessonRebalancer.ts');

    expect(rebalancer).toContain('const extensionCount = currentLessons.filter((lesson) => lesson.is_extended === true).length');
    expect(rebalancer).toContain('const targetCount = templateCount + extensionCount');
    expect(rebalancer).toContain('const templateOwnedLessons = currentLessons.filter((lesson) => lesson.is_extended !== true)');
  });

  it('exposes a responsive confirmation dialog with a required reason', () => {
    const page = readSource('src/app/(coach)/coach/sessions/[sessionId]/attendance/page.tsx');
    const wrapper = readSource('src/app/(coach)/coach/sessions/[sessionId]/attendance/AttendanceWrapper.tsx');

    expect(page).toContain('currentLessonSlot.partNumber === currentLessonSlot.totalParts');
    expect(wrapper).toContain('Perpanjang Lesson');
    expect(wrapper).toContain('max-h-[calc(100dvh-2rem)]');
    expect(wrapper).toContain('Alasan perpanjangan');
    expect(wrapper).toContain("extensionReason.trim().length < 10");
  });
});
