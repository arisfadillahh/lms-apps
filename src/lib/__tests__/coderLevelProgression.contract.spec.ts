import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('individual Coder level progression', () => {
  const migration = read('supabase/migrations/20260912150000_coder_level_progressions.sql');
  const progressDao = read('src/lib/dao/coderProgressDao.ts');
  const placementRoute = read('src/app/api/admin/level-progressions/[id]/place/route.ts');

  it('uses every unique block in the personal journey snapshot as the graduation requirement', () => {
    expect(migration).toContain('count(DISTINCT progress.block_id)');
    expect(migration).toContain("progress.status = 'COMPLETED'");
    expect(migration).toContain('progress.coder_id = p_coder_id');
    expect(migration).toContain('v_completed_count <> v_required_count');
  });

  it('does not append later curriculum blocks to an existing personal journey', () => {
    expect(progressDao).toContain("Existing rows are the Coder's curriculum snapshot");
    expect(progressDao).not.toContain('Failed to extend coder block journey');
  });

  it('does not require an evaluation for an already completed migration block', () => {
    expect(migration).not.toMatch(/block_evaluations|evaluation_sessions|coder_reflections/);
  });

  it('keeps one immutable completion event per Coder and source level', () => {
    expect(migration).toContain('UNIQUE (coder_id, source_level_id)');
    expect(migration).toContain('ON CONFLICT (coder_id, source_level_id) DO NOTHING');
  });

  it('moves to the next configured level and never wraps to the first level', () => {
    expect(migration).toContain('next_level.order_index > current_level.order_index');
    expect(migration).toContain("THEN 'PROGRAM_COMPLETED' ELSE 'WAITING_PLACEMENT'");
    expect(migration).not.toMatch(/order_index\s*<\s*current_level\.order_index/);
  });

  it('closes all active enrollments for the completed level with a historical boundary', () => {
    expect(migration).toContain("exit_reason = 'COMPLETED'");
    expect(migration).toContain('ended_at = v_progression.completed_at');
    expect(migration).toContain('WHERE coder_id = p_coder_id AND status = \'ACTIVE\'');
  });

  it('does not mutate class schedules or another Coder progress', () => {
    expect(migration).not.toMatch(/UPDATE public\.classes|UPDATE public\.class_blocks|UPDATE public\.sessions/);
    expect(migration).not.toMatch(/UPDATE public\.coder_block_progress/);
  });

  it('requires an active Weekly class at exactly the target level', () => {
    expect(migration).toContain("v_target_class.type <> 'WEEKLY'");
    expect(migration).toContain("v_target_class.lifecycle_status <> 'ACTIVE'");
    expect(migration).toContain('v_target_class.level_id IS DISTINCT FROM v_progression.target_level_id');
  });

  it('makes placement idempotent but rejects changing an existing destination', () => {
    expect(migration).toContain("IF v_progression.status = 'PLACED'");
    expect(migration).toContain('v_progression.target_class_id IS DISTINCT FROM p_target_class_id');
    expect(migration).toContain('ON CONFLICT (class_id, coder_id) DO UPDATE');
  });

  it('initializes the level journey from the selected class position', () => {
    expect(placementRoute).toContain('initializeWeeklyEnrollmentJourney');
    expect(placementRoute).toContain('await initializeWeeklyEnrollmentJourney({ klass, enrollment })');
  });

  it('notifies only LMS Admin and LMS Coder with dedupe keys', () => {
    expect(progressDao).toContain('createNotification(coderId');
    expect(progressDao).toContain('createAdminNotifications({');
    expect(progressDao).toContain('level-complete:${result.progressionId}');
    expect(progressDao).not.toMatch(/WhatsApp|whatsapp|coach_id|createCoach/);
    expect(placementRoute).not.toMatch(/WhatsApp|whatsapp|createCoach/);
  });

  it('stops old-class reminders without erasing historical report eligibility', () => {
    expect(migration).toContain("status = 'INACTIVE'");
    expect(migration).toContain('ended_at = v_progression.completed_at');
    expect(migration).not.toMatch(/DELETE FROM public\.enrollments/);
  });

  it('protects both state-changing functions from direct client execution', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.finalize_coder_level');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.place_coder_level_progression');
    expect(migration).toContain('TO service_role');
  });
});

describe('lesson problem terminology', () => {
  it('uses the specific label without changing the established route', () => {
    const menu = read('src/lib/adminMenu.ts');
    const coachButton = read('src/app/(coach)/coach/lesson/[id]/ReportLessonButton.tsx');
    expect(menu).toContain("href: '/admin/curriculum/reports', label: 'Masalah Lesson'");
    expect(coachButton).toContain('Laporkan Masalah Lesson');
  });
});
