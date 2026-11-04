import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPeriod } from '@/lib/payroll/model';

describe('real PostgreSQL payroll migration, privileges and atomic revisions', () => {
  let db: PGlite;
  const admin = '10000000-0000-4000-8000-000000000001';
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync(path.join(process.cwd(), 'scripts/payroll-local-schema.sql'), 'utf8'));
    await db.exec(readFileSync(path.join(process.cwd(), 'supabase/migrations/20261104100000_payroll.sql'), 'utf8'));
    await db.query("INSERT INTO users(id,username,full_name,role) VALUES ($1,'admin','Admin','ADMIN')", [admin]);
  }, 30000);
  afterAll(async () => { await db?.close(); });
  it('adds nullable class mode without changing existing operational rows', async () => {
    const r = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='classes' AND column_name='payroll_mode'"); expect(r.rows).toHaveLength(1);
  });
  it('seeds verified legacy rates, 100000 goal bonus, and disabled-until-configured automation', async () => {
    const r = await db.query<{ rates: { GOAL: number } }>('SELECT rates FROM payroll_rate_cards'); expect(r.rows[0].rates.GOAL).toBe(100000);
    const s = await db.query<{ active_from: unknown; automation_enabled: boolean }>('SELECT * FROM payroll_settings'); expect(s.rows[0].active_from).toBeNull(); expect(s.rows[0].automation_enabled).toBe(false);
  });
  it('prevents anonymous/authenticated direct salary reads and RPC writes', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query('SELECT * FROM payroll_profiles')).rejects.toThrow(/permission denied/);
      await expect(db.query("SELECT payroll_commit_period('2026-11',0,'{}'::jsonb,NULL,'TEST','')")).rejects.toThrow(/permission denied/);
      await db.exec('RESET ROLE');
    }
  });
  it('commits a version and its audit record together and rejects stale writers', async () => {
    const p = createPeriod(2026, 11);
    await db.query('INSERT INTO payroll_periods(id,document) VALUES ($1,$2)', [p.id, JSON.stringify(p)]);
    await db.exec('SET ROLE service_role');
    const result = await db.query<{ payroll_commit_period: number }>('SELECT payroll_commit_period($1,$2,$3,$4,$5,$6)', [p.id, 0, JSON.stringify(p), admin, 'CALCULATE', '']);
    expect(result.rows[0].payroll_commit_period).toBe(1);
    await expect(db.query('SELECT payroll_commit_period($1,$2,$3,$4,$5,$6)', [p.id, 0, JSON.stringify(p), admin, 'OVERRIDE', 'stale browser'])).rejects.toThrow(/PAYROLL_CONFLICT/);
    const a = await db.query("SELECT * FROM payroll_audit WHERE entity_key='period:2026-11'"); expect(a.rows).toHaveLength(1);
    const state = await db.query<{ revision: number }>("SELECT revision FROM payroll_periods WHERE id='2026-11'"); expect(state.rows[0].revision).toBe(1);
    await expect(db.query('DELETE FROM payroll_audit')).rejects.toThrow(/permission denied/);
    await db.exec('RESET ROLE');
  });
  it('audits configuration changes and rejects negative salaries', async () => {
    await db.exec('SET ROLE service_role');
    const p = await db.query<{ id: string }>("INSERT INTO payroll_profiles(name,kind,updated_by) VALUES ('Local staff','STAFF',$1) RETURNING id", [admin]);
    await expect(db.query("INSERT INTO payroll_terms(profile_id,effective_from,contract,base_salary) VALUES ($1,'2026-01-01','FULLTIME',-1)", [p.rows[0].id])).rejects.toThrow();
    const a = await db.query("SELECT * FROM payroll_audit WHERE entity_key LIKE 'payroll_profiles:%'"); expect(a.rows).toHaveLength(1);
    await db.exec('RESET ROLE');
  });
  it('saves profile and dated contract atomically, including audit rollback', async () => {
    const profile = { kind: 'STAFF', name: 'Atomic staff', active: true };
    const term = { effective_from: '2026-01-01', contract: 'FULLTIME', base_salary: -1 };
    await expect(db.query('SELECT payroll_save_profile($1,$2,$3)', [JSON.stringify(profile), JSON.stringify(term), admin])).rejects.toThrow();
    expect((await db.query("SELECT id FROM payroll_profiles WHERE name='Atomic staff'")).rows).toHaveLength(0);
    term.base_salary = 3000000;
    const saved = await db.query<{ payroll_save_profile: string }>('SELECT payroll_save_profile($1,$2,$3)', [JSON.stringify(profile), JSON.stringify(term), admin]);
    const id = saved.rows[0].payroll_save_profile;
    expect((await db.query('SELECT id FROM payroll_terms WHERE profile_id=$1', [id])).rows).toHaveLength(1);
    await expect(db.query('SELECT payroll_save_profile($1,$2,$3)', [JSON.stringify({ ...profile, id, kind: 'COACH', user_id: admin }), JSON.stringify(term), admin])).rejects.toThrow(/Coach account is invalid/);
  });
  it('preserves every final snapshot and recorded transfer at database level', async () => {
    const p = createPeriod(2026, 9);
    p.history = [{ version: 1, finalized_at: '2026-09-26', finalized_by: admin, slips: [] }];
    p.transfers = [{ id: 'transfer-1', profile_id: admin, amount: 100000, at: '2026-09-26', by: admin, version: 1, reference: '' }];
    await db.query('INSERT INTO payroll_periods(id,document) VALUES ($1,$2)', [p.id, JSON.stringify(p)]);
    for (const change of [{ history: [] }, { transfers: [] }, { starts_at: '2026-09-01' }]) {
      await expect(db.query('UPDATE payroll_periods SET document=$2 WHERE id=$1', [p.id, JSON.stringify({ ...p, ...change })])).rejects.toThrow(/immutable/);
    }
  });
  it('reviews requests atomically, invalidates calculation and blocks stale/final-period reviews', async () => {
    const p = createPeriod(2026, 7), id = '40000000-0000-4000-8000-000000000001';
    await db.query('INSERT INTO payroll_periods(id,document) VALUES ($1,$2)', [p.id, JSON.stringify(p)]);
    await db.query("INSERT INTO payroll_activity_requests(id,coach_id,activity_at,kind,label,notes) VALUES ($1,$2,'2026-07-20T12:00:00+07:00','EVENT','Event contoh','Bukti kegiatan contoh lokal')", [id, admin]);
    await db.exec('SET ROLE service_role');
    await expect(db.query("UPDATE payroll_activity_requests SET status='APPROVED' WHERE id=$1", [id])).rejects.toThrow(/permission denied/);
    const args = [id, 0, 'APPROVED', 'MITRA', 'Bukti sudah diperiksa admin', p.id, admin];
    await db.query('SELECT payroll_review_activity($1,$2,$3,$4,$5,$6,$7)', args);
    expect((await db.query<{ status: string }>('SELECT status FROM payroll_activity_requests WHERE id=$1', [id])).rows[0].status).toBe('APPROVED');
    expect((await db.query<{ revision: number }>('SELECT revision FROM payroll_periods WHERE id=$1', [p.id])).rows[0].revision).toBe(1);
    await expect(db.query('SELECT payroll_review_activity($1,$2,$3,$4,$5,$6,$7)', args)).rejects.toThrow(/PAYROLL_CONFLICT/);
    await db.exec('RESET ROLE');
    await db.query("UPDATE payroll_periods SET document=jsonb_set(document,'{status}','\"FINAL\"') WHERE id=$1", [p.id]);
    args[1] = 1;
    await expect(db.query('SELECT payroll_review_activity($1,$2,$3,$4,$5,$6,$7)', args)).rejects.toThrow(/Reopen payroll/);
    expect((await db.query<{ revision: number }>('SELECT revision FROM payroll_activity_requests WHERE id=$1', [id])).rows[0].revision).toBe(1);
  });
});
