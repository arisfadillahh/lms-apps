import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isValidTransferTarget } from '@/lib/services/classTransferPolicy';
import type { ClassRecord } from '@/lib/dao/classesDao';

const klass = (id: string, level = 'creator', lifecycle = 'ACTIVE') => ({
  id, type: 'WEEKLY', level_id: level, lifecycle_status: lifecycle, end_date: '2027-02-27', archived_at: null,
}) as Pick<ClassRecord, 'id' | 'type' | 'level_id' | 'lifecycle_status' | 'end_date' | 'archived_at'>;

describe('transfer of an unfinished coder to a newly planned class', () => {
  it('allows only a different active class in the same Weekly level', () => {
    expect(isValidTransferTarget(klass('old'), klass('new'))).toBe(true);
    expect(isValidTransferTarget(klass('old'), klass('old'))).toBe(false);
    expect(isValidTransferTarget(klass('old'), klass('new', 'innovator'))).toBe(false);
    expect(isValidTransferTarget(klass('old'), klass('new', 'creator', 'ENDED'))).toBe(false);
    expect(isValidTransferTarget(klass('old', 'creator', 'ENDED'), klass('new'))).toBe(true);
    expect(isValidTransferTarget(klass('old'), { ...klass('new'), end_date: '2026-01-01' }, '2026-10-11')).toBe(false);
    expect(isValidTransferTarget(klass('old'), { ...klass('new'), archived_at: '2026-10-01' })).toBe(false);
  });

  it('preserves completed personal blocks and aligns incomplete blocks without finalizing', () => {
    const sql = readFileSync('supabase/migrations/20261011100000_safe_transfer_and_progression_cancellation.sql', 'utf8');
    const transferSql = sql.split('CREATE OR REPLACE FUNCTION public.transfer_coder_enrollment(')[1].split('CREATE UNIQUE INDEX')[0];
    const setup = readFileSync('src/lib/services/weeklyEnrollmentSetup.ts', 'utf8');
    const route = readFileSync('src/app/api/admin/classes/[id]/transfer/route.ts', 'utf8');
    const queueMigration = readFileSync('supabase/migrations/20261011110000_personal_transfer_queue.sql', 'utf8');
    expect(transferSql).toContain('v_from_level IS DISTINCT FROM v_to_level');
    expect(transferSql).not.toContain('coder_block_progress');
    expect(transferSql).not.toContain('finalize_coder_level(');
    expect(setup).toContain("input.mode === 'TRANSFER' ? levelBlocks.slice().sort");
    expect(route).toContain("mode: 'TRANSFER'");
    expect(queueMigration).toContain('PERFORM public.align_transferred_coder_journey(');
    expect(queueMigration).toContain("WHEN v_row.status = 'COMPLETED' THEN 'COMPLETED'");
    expect(queueMigration).not.toContain('PERFORM public.finalize_coder_level');
    expect(sql).toContain("WHERE status <> 'CANCELLED'");
  });
});
