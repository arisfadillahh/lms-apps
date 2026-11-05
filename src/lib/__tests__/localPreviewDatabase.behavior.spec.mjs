import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureLocalAppSchema } from '../../../scripts/lib/local-app-schema.mjs';
import { loadRestSchema, readLocalRows } from '../../../scripts/lib/local-rest.mjs';
import { seedLocalDashboard } from '../../../scripts/lib/local-dashboard-seed.mjs';

describe('local app database supports normal dashboard queries', () => {
  let db, schema;
  const coach = '10000000-0000-4000-8000-000000000101', coder = '10000000-0000-4000-8000-000000000102';
  const klass = '30000000-0000-4000-8000-000000000101', invoice = '70000000-0000-4000-8000-000000000101';
  beforeAll(async () => {
    db = new PGlite();
    for (const file of ['scripts/payroll-local-schema.sql','supabase/migrations/20261104100000_payroll.sql']) await db.exec(fs.readFileSync(file,'utf8'));
    await db.query("INSERT INTO users(id,username,full_name,role) VALUES ($1,'coach','Coach Demo','COACH'),($2,'coder','Coder Demo','CODER')", [coach,coder]);
    await db.query("INSERT INTO classes(id,name,type,coach_id) VALUES ($1,'Kelas Demo','WEEKLY',$2)", [klass,coach]);
    await ensureLocalAppSchema(db, process.cwd());
    await db.query("INSERT INTO payment_plans(id,name,duration_months) VALUES ('71000000-0000-4000-8000-000000000101','3 bulan',3)");
    await db.query("INSERT INTO coder_payment_periods(id,coder_id,class_id,payment_plan_id,start_date,end_date,total_amount) VALUES ('72000000-0000-4000-8000-000000000101',$1,$2,'71000000-0000-4000-8000-000000000101','2026-11-01','2027-01-31',600000)", [coder,klass]);
    await db.query("INSERT INTO invoices(id,status,invoice_number,parent_name,period_month,period_year,due_date) VALUES ($1,'PENDING','LOCAL-001','Demo',11,2026,'2026-11-25'),('70000000-0000-4000-8000-000000000102','PAID','OTHER-002','Lainnya',11,2026,'2026-11-25')", [invoice]);
    await db.query("INSERT INTO invoice_items(invoice_id,coder_id,coder_name,class_name,level_name,payment_period_id) VALUES ($1,$2,'Coder Demo','Kelas Demo','Explorer','72000000-0000-4000-8000-000000000101')", [invoice,coder]);
    schema = await loadRestSchema(db);
  }, 30000);
  afterAll(async () => { await db?.close(); });
  it('returns the invoice DAO nested billing relationships and empty child arrays with correct cardinality', async () => {
    const result = await readLocalRows(db,schema,'invoices',new URLSearchParams({select:'*,items:invoice_items(*,billing_period:coder_payment_periods(payment_plans(duration_months))),ccr_numbers(*)',order:'id.asc'}));
    expect(result.count).toBe(2);
    expect(result.rows[0].items[0].billing_period.payment_plans.duration_months).toBe(3);
    expect(result.rows[0].ccr_numbers).toBeNull();
    expect(result.rows[1].items).toEqual([]);
    expect(result.rows[0].due_date).toBe('2026-11-25');
  });
  it('filters OR searches and preserves total count across pagination', async () => {
    const search = await readLocalRows(db,schema,'invoices',new URLSearchParams({select:'id',or:'(invoice_number.ilike.*LOCAL*,parent_name.ilike.*Tidak Ada*)'}));
    expect(search.rows).toEqual([{id:invoice}]);
    const page = await readLocalRows(db,schema,'invoices',new URLSearchParams({select:'id',order:'id.asc',limit:'1',offset:'1'}));
    expect(page.count).toBe(2); expect(page.rows).toHaveLength(1); expect(page.rows[0].id).not.toBe(invoice);
  });
  it('handles !inner embedded filters rather than returning unrelated parent records', async () => {
    await db.query("INSERT INTO enrollments(class_id,coder_id,status) VALUES ($1,$2,'ACTIVE')", [klass,coder]);
    const result = await readLocalRows(db,schema,'enrollments',new URLSearchParams({select:'id,coder:users!inner(id,full_name)','coder.is_active':'eq.true'}));
    expect(result.count).toBe(1); expect(result.rows[0].coder.full_name).toBe('Coder Demo');
    await db.query('UPDATE users SET is_active=false WHERE id=$1',[coder]);
    expect((await readLocalRows(db,schema,'enrollments',new URLSearchParams({select:'id,coder:users!inner(id)','coder.is_active':'eq.true'}))).count).toBe(0);
  });
  it('resolves coach dashboard FK-column embeds and applies nested filters', async () => {
    const result = await readLocalRows(db,schema,'classes',new URLSearchParams({
      select:'id,coach:coach_id!inner(id,full_name)', 'coach.id':'eq.' + coach,
    }));
    expect(result.rows).toEqual([{ id: klass, coach: { id: coach, full_name: 'Coach Demo' } }]);
    expect((await readLocalRows(db,schema,'classes',new URLSearchParams({
      select:'id,coach:coach_id!inner(id)', 'coach.id':'eq.' + coder,
    }))).count).toBe(0);
    await expect(readLocalRows(db,schema,'block_software',new URLSearchParams({select:'software:software_id(*)'}))).resolves.toMatchObject({rows: []});
    await expect(readLocalRows(db,schema,'block_reports',new URLSearchParams({select:'id,class:class_id!inner(id,coach_id)', 'class.coach_id':'eq.'+coach}))).resolves.toMatchObject({rows: []});
  });
  it('survives repeated startup without replacing users or financial documents', async () => {
    const document = {id:'2026-10',history:[{version:1}],transfers:[{id:'preserve-me'}]};
    await db.query('INSERT INTO payroll_periods(id,revision,document) VALUES ($1,7,$2)', [document.id,JSON.stringify(document)]);
    await ensureLocalAppSchema(db,process.cwd());
    expect((await db.query('SELECT name FROM classes WHERE id=$1',[klass])).rows[0].name).toBe('Kelas Demo');
    expect((await db.query('SELECT revision,document FROM payroll_periods WHERE id=$1',[document.id])).rows[0]).toEqual({revision:7,document});
  });
  it('keeps financial access restrictions after loading the wider app schema', async () => {
    await db.exec('SET ROLE service_role');
    await expect(db.query("DELETE FROM payroll_audit")).rejects.toThrow(/permission denied/);
    await expect(db.query("UPDATE payroll_activity_requests SET status='APPROVED'")).rejects.toThrow(/permission denied/);
    await db.exec('RESET ROLE; SET ROLE anon');
    await expect(db.query('SELECT * FROM payroll_profiles')).rejects.toThrow(/permission denied/);
    await db.exec('RESET ROLE');
  });
  it('reports missing tables instead of masking failed queries as successful empty data', async () => {
    await expect(readLocalRows(db,schema,'nonexistent_table',new URLSearchParams({select:'*'}))).rejects.toThrow(/does not exist/);
  });
  it('supports the first-login coach portfolio review count without missing-table errors', async () => {
    const result = await readLocalRows(db,schema,'coder_portfolios',new URLSearchParams({
      select:'id', class_id:'in.(' + klass + ')', status:'eq.SUBMITTED',
    }));
    expect(result).toEqual({ rows: [], count: 0 });
  });
  it('seeds complete curriculum templates and preserves data on repeat startup', async () => {
    await seedLocalDashboard(db, 'http://127.0.0.1:3005');
    await seedLocalDashboard(db, 'http://127.0.0.1:3005');
    expect((await db.query("SELECT id FROM lesson_templates WHERE block_id='60000000-0000-4000-8000-000000000002'")).rows).toHaveLength(2);
    expect((await db.query('SELECT lesson_template_id FROM class_lessons')).rows.every(r => r.lesson_template_id)).toBe(true);
    expect((await db.query("SELECT revision FROM payroll_periods WHERE id='2026-10'")).rows[0].revision).toBe(7);
  });
});
