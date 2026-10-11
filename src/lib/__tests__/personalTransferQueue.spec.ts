import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isDeferredBlockOpen, nextPersonalBlock, planTransferQueue } from '@/lib/services/personalBlockQueue';

const curriculum = ['A', 'B', 'C', 'D', 'E'];
const starting = curriculum.map((block_id, journey_order) => ({
  block_id, journey_order, status: journey_order === 0 ? 'IN_PROGRESS' as const : 'PENDING' as const,
}));

describe('personal block queue when moving classes', () => {
  it('continues the same block at the destination meeting without marking missed meetings complete', () => {
    const queue = planTransferQueue(starting, 'A', curriculum);
    expect(queue.map((row) => row.block_id)).toEqual(curriculum);
    expect(queue[0]).toMatchObject({ status: 'IN_PROGRESS', deferred_after_class: false });
    expect(queue.filter((row) => row.status === 'COMPLETED')).toHaveLength(0);
    const sql = readFileSync('supabase/migrations/20261011110000_personal_transfer_queue.sql', 'utf8');
    expect(sql).toContain('v_entry_lesson_position');
    expect(sql).toContain("s.status = 'COMPLETED'");
    expect(sql).toContain('entry_lesson_position = CASE WHEN v_row.block_id = v_target_block_id');
  });

  it('defers unfinished A until after B, C, D and E, then opens A material', () => {
    const queue = planTransferQueue(starting, 'B', curriculum);
    expect(queue.map((row) => row.block_id)).toEqual(['B', 'C', 'D', 'E', 'A']);
    expect(queue[0].status).toBe('IN_PROGRESS');
    expect(queue[4]).toMatchObject({ status: 'PENDING', deferred_after_class: true });
    expect(isDeferredBlockOpen(queue[4])).toBe(false);
    const afterE = queue.map((row) => row.block_id === 'A'
      ? { ...row, status: 'IN_PROGRESS' as const }
      : { ...row, status: 'COMPLETED' as const });
    expect(nextPersonalBlock(afterE)?.block_id).toBe('A');
    expect(isDeferredBlockOpen(afterE[4])).toBe(true);
    const coder = readFileSync('src/lib/services/coder.ts', 'utf8');
    expect(coder).toContain('deferredOpenBlockIds.has(block.block_id)');
    expect(coder).toContain('if (deferredBlockOpen) return true');
    expect(coder).toContain("journeyStatusMap.get(block.block_id) !== 'PENDING'");
    expect(coder).toContain("personalStatus.get(mappedEntry.classBlock.block_id) === 'PENDING'");
  });

  it('keeps a fully completed A completed and does not finalize or deactivate during transfer', () => {
    const doneA = [{ ...starting[0], status: 'COMPLETED' as const }, ...starting.slice(1)];
    const queue = planTransferQueue(doneA, 'B', curriculum);
    expect(queue.map((row) => row.block_id)).toEqual(curriculum);
    expect(queue[0]).toMatchObject({ status: 'COMPLETED', deferred_after_class: false });
    expect(nextPersonalBlock(queue)?.block_id).toBe('B');
    const sql = readFileSync('supabase/migrations/20261011110000_personal_transfer_queue.sql', 'utf8');
    const transfer = sql.split('CREATE OR REPLACE FUNCTION public.transfer_coder_enrollment(')[1].split('-- Keep the enrollment')[0];
    expect(transfer).toContain("exit_reason = 'TRANSFERRED'");
    expect(transfer).toContain("p_to_class_id, p_coder_id, p_effective_at, 'ACTIVE'");
    expect(transfer).not.toContain('finalize_coder_level(');
    expect(sql).toContain("progress.deferred_after_class = true");
  });
});
