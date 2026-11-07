import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPeriod } from '@/lib/payroll/model';

describe('reimbursement migration, private storage and atomic payroll approval', () => {
  let db: PGlite;
  const admin = '10000000-0000-4000-8000-000000000001';
  const profile = '20000000-0000-4000-8000-000000000001';
  const request = '30000000-0000-4000-8000-000000000001';
  const other = '30000000-0000-4000-8000-000000000002';
  const period = createPeriod(2098, 11);
  const args = (id = request, hash = 'a'.repeat(64)) => [id, profile, period.id, 'Beli alat kelas', 125000, `${period.id}/${profile}/${id}.webp`, 500, hash];
  const submit = (values = args()) => db.query<{ result: { id: string; status: string; revision: number } }>('SELECT payroll_submit_reimbursement($1,$2,$3,$4,$5,$6,$7,$8) AS result', values);
  const review = (revision: number, status = 'APPROVED', reason = 'Bukti sesuai dan sudah diperiksa') => db.query<{ result: { status: string; revision: number } }>('SELECT payroll_review_reimbursement($1,$2,$3,$4,$5) AS result', [request, revision, status, reason, admin]);
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync('scripts/payroll-local-schema.sql', 'utf8'));
    await db.exec(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
      CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id integer PRIMARY KEY,bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO anon,authenticated; GRANT SELECT,INSERT ON storage.objects TO anon,authenticated;
      CREATE POLICY existing_broad_policy ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);`);
    for (const migration of ['20261104100000_payroll.sql', '20261104160000_payroll_allowances.sql', '20261105100000_payroll_controls.sql', '20261105140000_payroll_privileges.sql', '20261106100000_payroll_reimbursements.sql', '20261107080000_payroll_conflict_pt409.sql']) await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
    await db.query("INSERT INTO users(id,username,full_name,role) VALUES($1,'admin','Admin','ADMIN')", [admin]);
    await db.query("INSERT INTO payroll_profiles(id,name,kind) VALUES($1,'Staff Uji','STAFF')", [profile]);
    await db.query('INSERT INTO payroll_periods(id,document) VALUES($1,$2)', [period.id, JSON.stringify({ ...period, calculated_at: '2098-11-01T00:00:00Z', manual: [{ id: 'unrelated', profile_id: profile, label: 'Tunjangan', amount: 300000, date: period.correction_deadline, reason: 'Existing allowance' }] })]);
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it('revokes inherited browser/destructive server privileges while retaining only service SELECT/RPC access', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const result = await db.query<{ allowed: boolean }>("SELECT has_table_privilege($1,'payroll_reimbursements',$2) AS allowed", [role, privilege]);
      expect(result.rows[0].allowed, `${role} ${privilege}`).toBe(false);
    }
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query('SELECT * FROM payroll_reimbursements')).rejects.toThrow(/permission denied/);
      await expect(submit()).rejects.toThrow(/permission denied/);
      await expect(review(0)).rejects.toThrow(/permission denied/);
      await db.exec('RESET ROLE');
    }
  });
  it('keeps evidence private even when existing storage policies broadly allow browser roles', async () => {
    expect((await db.query<{ public: boolean }>("SELECT public FROM storage.buckets WHERE id='payroll-reimbursements-private'")).rows[0].public).toBe(false);
    await db.query("INSERT INTO storage.objects(id,bucket_id) VALUES(1,'payroll-reimbursements-private'),(2,'public-assets')");
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      expect((await db.query('SELECT id FROM storage.objects')).rows).toEqual([{ id: 2 }]);
      await expect(db.query("INSERT INTO storage.objects(id,bucket_id) VALUES(3,'payroll-reimbursements-private')")).rejects.toThrow(/row-level security/);
      await db.exec('RESET ROLE');
    }
  });
  it('deduplicates exact/replayed submissions and identical receipts without altering payroll amounts', async () => {
    await db.exec('SET ROLE service_role');
    const first = await submit(); expect(first.rows[0].result.status).toBe('PENDING');
    expect((await submit()).rows[0].result.id).toBe(request);
    expect((await submit(args(other))).rows[0].result.id).toBe(request);
    const changed = args(); changed[4] = 250000; changed[7] = 'b'.repeat(64);
    await expect(submit(changed)).rejects.toMatchObject({ message: expect.stringMatching(/PAYROLL_CONFLICT/), code: 'PT409' });
    expect((await db.query('SELECT id FROM payroll_reimbursements')).rows).toHaveLength(1);
    const state = (await db.query<{ document: { manual: unknown[] } }>('SELECT document FROM payroll_periods WHERE id=$1', [period.id])).rows[0].document;
    expect(state.manual).toHaveLength(1);
    await db.exec('RESET ROLE');
  });
  it('atomically approves a single matching manual component, invalidates totals, and safely retries the approval', async () => {
    await db.exec('SET ROLE service_role');
    expect((await review(0)).rows[0].result).toMatchObject({ status: 'APPROVED', revision: 1 });
    expect((await review(0)).rows[0].result.revision).toBe(1);
    const result = await db.query<{ revision: number; document: { manual: { id: string; amount: number; profile_id: string }[]; calculated_at: null } }>('SELECT revision,document FROM payroll_periods WHERE id=$1', [period.id]);
    expect(result.rows[0].revision).toBe(1); expect(result.rows[0].document.calculated_at).toBeNull();
    expect(result.rows[0].document.manual).toHaveLength(2);
    expect(result.rows[0].document.manual.find(component => component.id === `reimbursement:${request}`)).toMatchObject({ amount: 125000, profile_id: profile });
    expect((await db.query("SELECT id FROM payroll_audit WHERE action='REIMBURSEMENT_REVIEW'")).rows).toHaveLength(2);
    await expect(review(0, 'REJECTED', 'Keputusan stale browser')).rejects.toMatchObject({ message: expect.stringMatching(/PAYROLL_CONFLICT/), code: 'PT409' });
    await db.exec('RESET ROLE');
  });
  it('audits a revised rejection, removes only its own component, and preserves the unrelated allowance', async () => {
    expect((await review(1, 'REJECTED', 'Bukti perlu diperbaiki')).rows[0].result).toMatchObject({ status: 'REJECTED', revision: 2 });
    const state = (await db.query<{ document: { manual: { id: string }[] } }>('SELECT document FROM payroll_periods WHERE id=$1', [period.id])).rows[0].document;
    expect(state.manual).toEqual([expect.objectContaining({ id: 'unrelated' })]);
    expect((await db.query("SELECT id FROM payroll_audit WHERE entity_key=$1 AND action='REIMBURSEMENT_REVIEW'", [`reimbursement:${request}`])).rows).toHaveLength(2);
  });
  it('blocks final-period review/submission without changing the request or manual components', async () => {
    await db.query("UPDATE payroll_periods SET document=jsonb_set(document,'{status}','\"FINAL\"') WHERE id=$1", [period.id]);
    await expect(review(2)).rejects.toThrow(/REIMBURSEMENT_REOPEN/);
    await expect(submit(args(other, 'b'.repeat(64)))).rejects.toThrow(/REIMBURSEMENT_CLOSED/);
    expect((await db.query<{ revision: number }>('SELECT revision FROM payroll_reimbursements WHERE id=$1', [request])).rows[0].revision).toBe(2);
    await db.query("UPDATE payroll_periods SET document=jsonb_set(document,'{status}','\"DRAFT\"') WHERE id=$1", [period.id]);
  });
  it('rejects deactivated recipients and negative amounts or cross-scope receipt paths', async () => {
    const negative = args(other, 'c'.repeat(64)); negative[4] = -1;
    await expect(submit(negative)).rejects.toThrow(/check constraint/);
    const badPath = args(other, 'c'.repeat(64)); badPath[5] = `2098-10/${profile}/${other}.webp`;
    await expect(submit(badPath)).rejects.toThrow(/evidence scope/);
    await db.query('UPDATE payroll_profiles SET active=false WHERE id=$1', [profile]);
    await expect(submit(args(other, 'c'.repeat(64)))).rejects.toThrow(/REIMBURSEMENT_CLOSED/);
    await expect(review(2)).rejects.toThrow(/REIMBURSEMENT_INACTIVE/);
  });
});
