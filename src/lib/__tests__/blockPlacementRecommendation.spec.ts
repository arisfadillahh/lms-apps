import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placementAction, rankPlacementCandidates, type PlacementCandidate } from '@/lib/services/blockPlacementRecommendation';

const candidate = (class_id: string, class_position: number, active_coder_count = 4,
  schedule_day = 'Sabtu', schedule_time = '09:00:00'): PlacementCandidate => ({
  placement_id: 'queue-1', class_id, class_name: `Kelas ${class_id}`,
  class_position, active_coder_count, schedule_day, schedule_time,
});

describe('block placement recommendation', () => {
  it('recommends the nearest CURRENT class and places it first', () => {
    const ranked = rankPlacementCandidates([
      candidate('far', 12), candidate('near', 7), candidate('behind', 3),
    ], 6);
    expect(ranked.map((row) => row.class_id)).toEqual(['near', 'behind', 'far']);
    expect(placementAction('Game Development', ranked, 6)).toBe('Pindahkan ke kelas Kelas near');
  });

  it('prefers not falling behind, then lower occupancy, schedule and stable ID', () => {
    const ranked = rankPlacementCandidates([
      candidate('behind', 4, 1), candidate('full', 6, 8),
      candidate('late', 6, 3, 'Sabtu', '10:00:00'),
      candidate('b', 6, 3, 'Sabtu', '08:00:00'),
      candidate('a', 6, 3, 'Sabtu', '08:00:00'),
    ], 5);
    expect(ranked.map((row) => row.class_id)).toEqual(['a', 'b', 'late', 'full', 'behind']);
  });

  it('recommends opening a new class when no eligible class exists', () => {
    expect(placementAction('Game Development', [], 4)).toBe('Buka kelas baru untuk blok Game Development');
  });

  it('uses the same priority in SQL and writes the action in the in-app notification', () => {
    const sql = readFileSync('supabase/migrations/20261011130000_block_placement_recommendations.sql', 'utf8');
    expect(sql).toContain("block.status = 'CURRENT'");
    expect(sql).toContain("klass.lifecycle_status = 'ACTIVE'");
    expect(sql).toContain('klass.level_id = placement.level_id');
    expect(sql).toContain('abs(candidate.class_position - placement.entry_lesson_position)');
    expect(sql).toContain('candidate.class_position < placement.entry_lesson_position THEN 1 ELSE 0');
    expect(sql).toContain('candidate.active_coder_count, candidate.schedule_day, candidate.schedule_time');
    expect(sql).toContain("'Rekomendasi saat dibuat: ' || public.block_placement_recommendation_text(v_placement_id)");
    expect(sql).toContain("notification.message NOT LIKE '% Rekomendasi saat dibuat:%'");
  });
});
