import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const migration = readFileSync('supabase/migrations/20261107080000_payroll_conflict_pt409.sql', 'utf8');

describe('payroll conflict migration contract', () => {
  it('replaces every live conflict RPC with a non-retryable conflict SQLSTATE and restricted grants', () => {
    const functions = [
      ['payroll_commit_period', 'text,integer,jsonb,uuid,text,text', 2, false],
      ['payroll_review_activity', 'uuid,integer,text,text,text,text,uuid', 1, true],
      ['payroll_submit_reimbursement', 'uuid,uuid,text,text,bigint,text,integer,text', 1, true],
      ['payroll_review_reimbursement', 'uuid,integer,text,text,uuid', 1, true],
    ] as const;
    expect(migration).not.toContain('40001');
    expect((migration.match(/ERRCODE\s*=\s*'PT409'/g) ?? [])).toHaveLength(5);
    for (const [name, signature, conflictCount, definer] of functions) {
      const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
      const end = migration.indexOf('$function$\n;', start);
      expect(start, name).toBeGreaterThan(-1);
      expect(end, name).toBeGreaterThan(start);
      const definition = migration.slice(start, end);
      expect((definition.match(/ERRCODE\s*=\s*'PT409'/g) ?? []), name).toHaveLength(conflictCount);
      expect(definition.includes('SECURITY DEFINER'), name).toBe(definer);
      expect(definition).toContain("SET search_path TO 'public', 'pg_catalog'");
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${name}(${signature}) FROM PUBLIC, anon, authenticated;`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${name}(${signature}) TO service_role;`);
    }
  });
});

vi.mock('server-only', () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({ rpc }) }));
import { commitPayrollPeriod } from '@/lib/dao/payrollDao';
import { reviewReimbursementRequest } from '@/lib/dao/payrollReimbursementsDao';
import { createPeriod } from '@/lib/payroll/model';

describe('PostgREST payroll conflict mapping', () => {
  it.each([{ code: 'PT409' }, { code: '40001' }, { status: 409 }])('maps period conflict %o to HTTP 409', async error => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'conflict', ...error } });
    const document = createPeriod(2026, 11);
    await expect(commitPayrollPeriod({ id: document.id, revision: 0, document }, document, null, 'TEST')).rejects.toMatchObject({ status: 409 });
  });
  it.each([{ code: 'PT409' }, { code: '40001' }, { status: 409 }])('maps reimbursement conflict %o to HTTP 409', async error => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'conflict', ...error } });
    await expect(reviewReimbursementRequest({ id: 'request', revision: 0, status: 'APPROVED', reason: 'Approved' }, 'actor')).rejects.toMatchObject({ status: 409 });
  });
});
