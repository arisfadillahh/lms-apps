import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDisplayedJourneyBlocks, mergeJourneyStatus } from '@/lib/services/coderJourneyPolicy';
import { resolveCycleLessonProgress } from '@/lib/services/classCycleProgress';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Ahmad Faqih repeated Creator cycle', () => {
  it('keeps personal IN_PROGRESS and PENDING when an old class block is COMPLETED', () => {
    expect(mergeJourneyStatus('COMPLETED', 'IN_PROGRESS')).toBe('CURRENT');
    expect(mergeJourneyStatus('COMPLETED', 'PENDING')).toBe('UPCOMING');
    expect(mergeJourneyStatus('UPCOMING', 'COMPLETED')).toBe('COMPLETED');
  });

  it('shows five unique curriculum blocks and chooses the current Interactive instance', () => {
    const row = (id: string, block_id: string, status: string, start_date: string) =>
      ({ id, block_id, status, start_date, end_date: start_date });
    const ordered = [
      row('old-game', 'game', 'COMPLETED', '2026-05-16'),
      row('old-interactive', 'interactive', 'COMPLETED', '2024-10-05'),
      row('live-interactive', 'interactive', 'CURRENT', '2026-09-19'),
      row('old-story', 'story', 'COMPLETED', '2025-03-22'),
      row('new-story', 'story', 'UPCOMING', '2027-02-27'),
      row('old-app', 'app', 'COMPLETED', '2025-08-02'),
      row('old-advanced', 'advanced', 'COMPLETED', '2025-12-27'),
    ];
    const selected = buildDisplayedJourneyBlocks(ordered, ordered);
    expect(selected).toHaveLength(5);
    expect(selected.find((block) => block.block_id === 'interactive')?.id).toBe('live-interactive');
    expect(selected.find((block) => block.block_id === 'story')?.id).toBe('new-story');
  });

  it('explains 17% as four completed class lessons of 24', () => {
    const lessons = Array.from({ length: 24 }, (_, index) => ({ order_index: index, session_id: `s${index}` }));
    const sessions = Array.from({ length: 24 }, (_, index) => ({ id: `s${index}`, status: index < 4 ? 'COMPLETED' : 'SCHEDULED' }));
    expect(resolveCycleLessonProgress(lessons, sessions)).toEqual({ completedLessons: 4, totalLessons: 24, percent: 17 });
  });

  it('separates class scheduling from personal completion and guards SQL promotion', () => {
    const scheduler = source('src/lib/services/lessonAutoAssign.ts');
    const migration = source('supabase/migrations/20261011090000_verified_individual_level_completion.sql');
    const dryRun = source('scripts/data-repair/ahmad-faqih-dry-run.cjs');
    expect(scheduler).not.toContain('markBlockCompletedForClass(');
    expect(migration).toContain("progress.completion_source IN ('MANUAL', 'ASSESSMENT')");
    expect(migration).toContain("cb.status IN ('CURRENT', 'UPCOMING')");
    expect(migration).toContain("e.exit_reason = 'COMPLETED'");
    expect(dryRun).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  });
});
