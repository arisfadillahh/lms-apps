import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { needsBlockPlacement, nextPersonalBlock, planTransferQueue } from '@/lib/services/personalBlockQueue';

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
    const destinationRule = readFileSync('supabase/migrations/20261011140000_destination_class_lesson_position.sql', 'utf8');
    expect(destinationRule).toContain('THEN v_entry_lesson_position');
    expect(destinationRule).not.toContain('greatest(v_entry_lesson_position');
  });

  it('defers unfinished A until after B, C, D and E, then requires placement', () => {
    const queue = planTransferQueue(starting, 'B', curriculum);
    expect(queue.map((row) => row.block_id)).toEqual(['B', 'C', 'D', 'E', 'A']);
    expect(queue[0].status).toBe('IN_PROGRESS');
    expect(queue[4]).toMatchObject({ status: 'PENDING', deferred_after_class: true });
    const afterE = queue.map((row) => row.block_id === 'A'
      ? row
      : { ...row, status: 'COMPLETED' as const });
    expect(nextPersonalBlock(afterE)?.block_id).toBe('A');
    expect(needsBlockPlacement(afterE)?.block_id).toBe('A');
    const coder = readFileSync('src/lib/services/coder.ts', 'utf8');
    expect(coder).not.toContain('deferredOpenBlockIds.has(block.block_id)');
    expect(coder).not.toContain('if (deferredBlockOpen) return true');
    expect(coder).toContain('if (deferredBlockWaiting ||');
    expect(coder).toContain("journeyStatusMap.get(block.block_id) !== 'PENDING'");
    expect(coder).toContain("personalStatus.get(mappedEntry.classBlock.block_id) === 'PENDING'");
  });

  it('needs block 3 placement after finishing blocks 4 and 5, with enrollment still active', () => {
    const atC = curriculum.map((block_id, journey_order) => ({ block_id, journey_order,
      status: block_id === 'C' ? 'IN_PROGRESS' as const
        : ['A', 'B'].includes(block_id) ? 'COMPLETED' as const : 'PENDING' as const }));
    const atD = planTransferQueue(atC, 'D', curriculum);
    expect(atD.map((row) => row.block_id)).toEqual(['A', 'B', 'D', 'E', 'C']);
    expect(needsBlockPlacement(atD)).toBeNull();
    const afterE = atD.map((row) => row.block_id === 'C' ? row : { ...row, status: 'COMPLETED' as const });
    expect(needsBlockPlacement(afterE)).toMatchObject({ block_id: 'C', status: 'PENDING', deferred_after_class: true });
    const placed = planTransferQueue(afterE, 'C', curriculum);
    expect(placed.at(-1)).toMatchObject({ block_id: 'C', status: 'IN_PROGRESS', deferred_after_class: false });
    expect(needsBlockPlacement(placed)).toBeNull();
    const migration = readFileSync('supabase/migrations/20261011120000_deferred_block_placement.sql', 'utf8');
    expect(migration).toContain("status = 'NEEDS_BLOCK_PLACEMENT'");
    expect(migration).toContain('ON CONFLICT (coder_id, level_id) WHERE status =');
    expect(migration).toContain('ON CONFLICT (user_id, reference_key) WHERE reference_key IS NOT NULL DO NOTHING');
    expect(migration).toContain('REFERENCING NEW TABLE AS changed_rows');
    expect(migration).toContain("cb.status = 'CURRENT'");
    expect(migration).toContain("SET status = 'PLACED', target_class_id = p_to_class_id");
    expect(migration).toContain("placement.status = 'NEEDS_BLOCK_PLACEMENT'");
    expect(migration).toContain("AND progress.deferred_after_class = true AND progress.status <> 'COMPLETED'");
    const lifecycle = migration.split('CREATE OR REPLACE FUNCTION public.set_class_lifecycle_status(')[1]
      .split('CREATE OR REPLACE FUNCTION public.finalize_coder_level(')[0];
    expect(lifecycle).toContain('AND NOT EXISTS (');
    expect(lifecycle).not.toContain("p_status = 'CANCELLED' OR");
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

  it('also defers an unfinished source block when moving backwards in the curriculum', () => {
    const fromD = curriculum.map((block_id, journey_order) => ({
      block_id, journey_order, status: block_id === 'D' ? 'IN_PROGRESS' as const : 'PENDING' as const,
    }));
    const queue = planTransferQueue(fromD, 'B', curriculum);
    expect(queue.map((row) => row.block_id)).toEqual(['B', 'C', 'E', 'A', 'D']);
    expect(queue.at(-1)).toMatchObject({ block_id: 'D', status: 'PENDING', deferred_after_class: true });
  });
});
