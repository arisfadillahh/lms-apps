import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('class change audit contract', () => {
  it('records recurring schedule and manual lesson assignment changes', () => {
    const scheduleRoute = read('src/app/api/admin/classes/[id]/schedule/route.ts');
    const assignmentRoute = read('src/app/api/admin/class-lessons/assign/route.ts');

    expect(scheduleRoute).toContain("eventType: 'RECURRING_SCHEDULE_UPDATED'");
    expect(scheduleRoute).toContain('beforeState:');
    expect(scheduleRoute).toContain('scheduleUpdates.map');
    expect(assignmentRoute).toContain("eventType: 'LESSON_REASSIGNED'");
    expect(assignmentRoute).toContain('displacedLesson:');
  });

  it('uses an additive audit table with class and timestamp lookup', () => {
    const migration = read('supabase/migrations/20260901190000_class_change_audit_logs.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.class_change_audit_logs');
    expect(migration).toContain('class_id uuid NOT NULL REFERENCES public.classes(id)');
    expect(migration).toContain('before_state jsonb NOT NULL');
    expect(migration).toContain('after_state jsonb NOT NULL');
    expect(migration).toContain('idx_class_change_audit_logs_class_created');
  });
});
