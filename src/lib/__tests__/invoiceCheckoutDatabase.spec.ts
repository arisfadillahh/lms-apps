import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, beforeAll, afterAll, beforeEach, expect, it } from 'vitest';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: PGlite;
async function rows(sql: string, values: unknown[] = []) { return (await db.query(sql, values)).rows as Record<string, unknown>[]; }
async function link(ids = [id(10), id(11)]) { return String((await rows('select create_invoice_checkout_link($1::uuid[],$2::uuid) id', [ids, id(1)]))[0].id); }
async function reserve(order: string, linkId: string | null, ids: string[], base: number) {
  await db.query('select reserve_invoice_checkout($1,$2::uuid,$3::uuid[],$4,$5,$6)', [order, linkId, ids, 'qris', base, 2500]);
}
async function finish(order: string, outcome: string, total = 1002500) {
  return (await rows('select finish_invoice_checkout($1,$2,$3,$4::timestamptz) result', [order, outcome, total, '2026-10-21T10:00:00+07:00']))[0].result as { state: string; duplicate?: boolean };
}
describe('checkout PostgreSQL transactions (real migration, no production connection)', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TYPE invoice_status_enum AS ENUM ('PENDING','OVERDUE','PAID');
      CREATE TABLE users(id uuid PRIMARY KEY,role text,is_active boolean);
      CREATE TABLE enrollments(id uuid PRIMARY KEY,coder_id uuid,class_id uuid,status text);
      CREATE TABLE classes(id uuid PRIMARY KEY,lifecycle_status text,archived_at timestamptz);
      CREATE TABLE ccr_numbers(id uuid PRIMARY KEY);
      CREATE TABLE invoice_settings(id uuid PRIMARY KEY);
      CREATE TABLE payment_plans(id uuid PRIMARY KEY,duration_months integer);
      CREATE TABLE coder_payment_periods(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),coder_id uuid,class_id uuid,payment_plan_id uuid,pricing_id uuid,start_date date,end_date date,total_amount numeric,status text);
      CREATE TABLE invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_number text UNIQUE,ccr_id uuid,parent_phone text,parent_name text,period_month integer,period_year integer,period_start_date date,period_end_date date,total_amount integer,status invoice_status_enum,invoice_type text,due_date date,paid_at timestamptz,paid_notes text,updated_at timestamptz);
      CREATE TABLE invoice_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_id uuid REFERENCES invoices(id),coder_id uuid,coder_name text,class_name text,level_name text,base_price integer,discount_amount integer,final_price integer,payment_period_id uuid);
    `);
    await db.exec(readFileSync('supabase/migrations/20261021100000_selected_invoice_checkout.sql', 'utf8'));
  }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec('TRUNCATE invoice_checkout_delivery_claims,invoice_billing_status_events,enrollments,classes,invoice_checkout_grants,invoice_checkout_claims,invoice_checkout_allocations,invoice_checkout_intents,invoice_checkout_links,invoice_items,invoices,coder_payment_periods,payment_plans,users,ccr_numbers CASCADE');
    await db.query('INSERT INTO users VALUES($1,\'ADMIN\',true);', [id(1)]);
    await db.query('INSERT INTO ccr_numbers VALUES($1)', [id(2)]);
    await db.query('INSERT INTO payment_plans VALUES($1,1)', [id(3)]);
    await db.query('INSERT INTO users VALUES($1,\'CODER\',true)', [id(4)]);
    await db.query('INSERT INTO classes VALUES($1,\'ACTIVE\',NULL)', [id(5)]);
    await db.query('INSERT INTO enrollments VALUES($1,$2,$3,\'ACTIVE\')', [id(30),id(4),id(5)]);
    await db.query('INSERT INTO coder_payment_periods VALUES($1,$2,$3,$4,$5,\'2026-08-26\',\'2026-09-25\',500000,\'EXPIRED\')', [id(6), id(4), id(5), id(3), id(7)]);
    for (const [n, month, start, end] of [[10,9,'2026-09-26','2026-10-25'],[11,10,'2026-10-26','2026-11-25']] as const) {
      await db.query('INSERT INTO invoices(id,invoice_number,ccr_id,parent_phone,parent_name,period_month,period_year,period_start_date,period_end_date,total_amount,status,invoice_type,due_date) VALUES($1,$2,$3,\'628123456789\',\'QA Parent\',$4,2026,$5,$6,500000,\'PENDING\',\'MONTHLY\',\'2026-10-25\')', [id(n), `QA-${n}`, id(2), month, start, end]);
      await db.query('INSERT INTO invoice_items(id,invoice_id,coder_id,coder_name,class_name,level_name,base_price,discount_amount,final_price,payment_period_id) VALUES($1,$2,$3,\'QA Coder\',\'QA Weekly\',\'QA Level\',500000,0,500000,$4)', [id(n+10),id(n),id(4),id(6)]);
    }
  });
  it('creates a link without changing invoice statuses, amounts or access', async () => {
    await link();
    expect(await rows('select status,total_amount from invoices order by period_month')).toEqual([{status:'PENDING',total_amount:500000},{status:'PENDING',total_amount:500000}]);
    expect((await rows('select count(*)::int n from coder_payment_periods'))[0].n).toBe(1);
  });
  it('reserves both invoices before external work; rejects overlapping single/order requests', async () => {
    await reserve('LMSB-qa', await link(), [id(10),id(11)],1000000);
    await expect(reserve('LMSB-other',null,[id(10)],500000)).rejects.toThrow('CHECKOUT_ALREADY_RESERVED');
    await expect(db.query('UPDATE invoices SET status=\'PAID\' WHERE id=$1',[id(10)])).rejects.toThrow('CHECKOUT_ALREADY_RESERVED');
    await expect(db.query('DELETE FROM invoices WHERE id=$1',[id(10)])).rejects.toThrow('CHECKOUT_ALREADY_RESERVED');
    await expect(db.query('UPDATE invoice_items SET final_price=1 WHERE invoice_id=$1',[id(10)])).rejects.toThrow('CHECKOUT_ITEMS_FROZEN');
    expect((await rows('select count(*)::int n from invoice_checkout_intents'))[0].n).toBe(1);
  });
  it('rejects a stale total and rolls back the entire reservation', async () => {
    await expect(reserve('LMSB-qa',await link(),[id(10),id(11)],999999)).rejects.toThrow('CHECKOUT_AMOUNT_CHANGED');
    expect((await rows('select count(*)::int n from invoice_checkout_claims'))[0].n).toBe(0);
  });
  it('pays only one selected month; the other stays unpaid', async () => {
    await reserve('LMSB-qa',await link(),[id(10)],500000);
    expect(await finish('LMSB-qa','PAID',502500)).toEqual({state:'PAID',duplicate:false});
    expect(await rows('select status from invoices order by period_month')).toEqual([{status:'PAID'},{status:'PENDING'}]);
    expect(await rows('select start_date::text,end_date::text from coder_payment_periods where id<>$1',[id(6)])).toEqual([{start_date:'2026-09-26',end_date:'2026-10-25'}]);
  });
  it('pays both atomically using each billed period, not the same old period twice', async () => {
    await reserve('LMSB-qa',await link(),[id(10),id(11)],1000000);
    expect((await finish('LMSB-qa','PAID')).state).toBe('PAID');
    expect(await rows('select start_date::text,end_date::text from coder_payment_periods where id<>$1 order by start_date',[id(6)])).toEqual([
      {start_date:'2026-09-26',end_date:'2026-10-25'},{start_date:'2026-10-26',end_date:'2026-11-25'},
    ]);
    expect(await finish('LMSB-qa','PAID')).toEqual({state:'PAID',duplicate:true});
    expect((await rows('select count(*)::int n from invoice_checkout_grants'))[0].n).toBe(2);
    expect((await rows('select count(*)::int n from invoice_checkout_claims'))[0].n).toBe(0);
  });
  it('keeps invoices and access unchanged when one billed period overlaps; retains claims for review', async () => {
    await reserve('LMSB-qa',await link(),[id(10),id(11)],1000000);
    // Simulate an independently posted paid period arriving after reservation.
    await db.query('INSERT INTO coder_payment_periods(id,coder_id,class_id,payment_plan_id,pricing_id,start_date,end_date,total_amount,status) VALUES($1,$2,$3,$4,$5,\'2026-10-26\',\'2026-11-25\',500000,\'ACTIVE\')',[id(50),id(4),id(5),id(3),id(7)]);
    expect((await finish('LMSB-qa','PAID')).state).toBe('REVIEW');
    expect(await rows('select status from invoices')).toEqual([{status:'PENDING'},{status:'PENDING'}]);
    expect((await rows('select count(*)::int n from coder_payment_periods'))[0].n).toBe(2);
    expect((await rows('select count(*)::int n from invoice_checkout_claims'))[0].n).toBe(2);
  });
  it('refuses overlapping billed periods before any charge can be issued',async()=>{
    await db.query('UPDATE invoices SET period_start_date=\'2026-09-26\',period_end_date=\'2026-10-25\' WHERE id=$1',[id(11)]);
    await expect(reserve('LMSB-qa',await link(),[id(10),id(11)],1000000)).rejects.toThrow('CHECKOUT_PERIOD_OVERLAP');
    expect((await rows('select count(*)::int n from invoice_checkout_intents'))[0].n).toBe(0);
  });
  it('claims a reminder once per family/day, including overlapping links and concurrent clicks',async()=>{
    const a=await link(),b=await link([id(10)]);
    const first=(await rows('select claim_invoice_checkout_message($1::uuid) claimed',[a]))[0].claimed;
    const again=(await rows('select claim_invoice_checkout_message($1::uuid) claimed',[b]))[0].claimed;
    expect(first).toBe(true);expect(again).toBe(false);
    expect((await rows('select count(*)::int n from invoice_checkout_delivery_claims'))[0].n).toBe(1);
  });
  it('only a provider-confirmed cancellation releases claims; a late settlement enters review', async () => {
    await reserve('LMSB-qa',await link(),[id(10),id(11)],1000000);
    expect((await finish('LMSB-qa','PENDING')).state).toBe('CREATING');
    expect((await rows('select count(*)::int n from invoice_checkout_claims'))[0].n).toBe(2);
    expect((await finish('LMSB-qa','CANCELLED')).state).toBe('CANCELLED');
    await reserve('LMSB-next',null,[id(10)],500000);
    expect((await finish('LMSB-qa','PAID')).state).toBe('REVIEW');
    expect((await rows('select count(*)::int n from invoice_checkout_grants'))[0].n).toBe(0);
  });
  it('rejects wrong gateway amount without changing status', async () => {
    await reserve('LMSB-qa',await link(),[id(10),id(11)],1000000);
    await expect(finish('LMSB-qa','PAID',1)).rejects.toThrow('CHECKOUT_GATEWAY_AMOUNT_MISMATCH');
    expect((await rows('select state from invoice_checkout_intents'))[0].state).toBe('CREATING');
  });
  it('rejects a mixed family, already-paid selection and an out-of-link invoice', async () => {
    await db.query('UPDATE invoices SET parent_phone=\'628999999999\' WHERE id=$1',[id(11)]);
    await expect(link()).rejects.toThrow('CHECKOUT_FAMILY_OR_STATUS_CHANGED');
    const one = await link([id(10)]);
    await expect(reserve('LMSB-qa',one,[id(11)],500000)).rejects.toThrow('CHECKOUT_OUTSIDE_LINK');
    await db.query('UPDATE invoices SET status=\'PAID\' WHERE id=$1',[id(10)]);
    await expect(link([id(10)])).rejects.toThrow('CHECKOUT_FAMILY_OR_STATUS_CHANGED');
  });
  it('does not permit public/authenticated roles to read financial state or execute payment RPCs', async () => {
    const privileges = await rows("select has_table_privilege('anon','invoice_checkout_links','select') a,has_table_privilege('authenticated','invoice_checkout_claims','select') b,has_function_privilege('anon','finish_invoice_checkout(text,text,integer,timestamptz)','execute') c");
    expect(privileges).toEqual([{a:false,b:false,c:false}]);
  });
  it('repeated monthly generation does not modify an issued invoice, extend access or duplicate items', async () => {
    const invoice = {ccr_id:id(2),invoice_number:'QA-10',period_month:9,period_year:2026,parent_phone:'628123456789',parent_name:'QA Parent',period_start_date:'2026-09-26',period_end_date:'2026-10-25',due_date:'2026-09-25'};
    const item = {coder_id:id(4),coder_name:'QA Coder',class_name:'QA Weekly',level_name:'QA Level',base_price:999999,discount_amount:0,final_price:999999,payment_period_id:id(6),billing_start_date:'2026-09-26',billing_end_date:'2026-10-25',billing_duration_months:1};
    await db.query('select upsert_invoice_billing_cycle($1::jsonb,$2::jsonb)',[JSON.stringify(invoice),JSON.stringify([item])]);
    expect((await rows('select total_amount from invoices where id=$1',[id(10)]))[0].total_amount).toBe(500000);
    expect((await rows('select count(*)::int n from invoice_items'))[0].n).toBe(2);
    expect((await rows('select count(*)::int n from coder_payment_periods'))[0].n).toBe(1);
  });
  it('creates a new month while old invoices remain unpaid, without granting access', async () => {
    const invoice = {ccr_id:id(2),invoice_number:'QA-12',period_month:11,period_year:2026,parent_phone:'628123456789',parent_name:'QA Parent',period_start_date:'2026-11-26',period_end_date:'2026-12-25',due_date:'2026-11-25'};
    const item = {coder_id:id(4),coder_name:'QA Coder',class_name:'QA Weekly',level_name:'QA Level',base_price:500000,discount_amount:0,final_price:500000,payment_period_id:id(6),billing_start_date:'2026-11-26',billing_end_date:'2026-12-25',billing_duration_months:1};
    const a=await rows('select upsert_invoice_billing_cycle($1::jsonb,$2::jsonb) result',[JSON.stringify(invoice),JSON.stringify([item])]);
    expect((a[0].result as {created:boolean}).created).toBe(true);
    expect((await rows('select count(*)::int n from invoices where status=\'PENDING\''))[0].n).toBe(3);
    expect((await rows('select count(*)::int n from coder_payment_periods'))[0].n).toBe(1);
    await db.query('update users set is_active=false where id=$1',[id(4)]);
    expect((await rows('select active from invoice_billing_status_events'))[0].active).toBe(false);
    invoice.invoice_number='QA-13';invoice.period_month=12;
    await expect(db.query('select upsert_invoice_billing_cycle($1::jsonb,$2::jsonb)',[JSON.stringify(invoice),JSON.stringify([item])])).rejects.toThrow('BILLING_STATUS_CHANGED');
    expect((await rows('select count(*)::int n from invoices'))[0].n).toBe(3);
  });
});
