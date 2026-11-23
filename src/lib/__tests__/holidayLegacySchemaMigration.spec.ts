import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('installs Holiday measurement on production file-fallback schema without adding monthly payment columns',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
      CREATE TABLE invoices(id uuid primary key,invoice_number text,total_amount int);
      CREATE TABLE holiday_class_registrations(id uuid primary key,invoice_id uuid references invoices(id),attribution jsonb,created_at timestamptz default now());
      CREATE FUNCTION settle_holiday_class_invoice(text,integer,timestamptz) RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';`);
    await db.exec(readFileSync('supabase/migrations/20261123093000_holiday_meta_outbox.sql','utf8'));
    const columns=await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='invoices' and column_name in ('payment_method','payment_total_amount')");
    expect(columns.rows).toHaveLength(0);
    const triggers=await db.query("select tgname from pg_trigger where tgname='holiday_checkout_meta'");expect(triggers.rows).toHaveLength(0);
    await db.exec(`INSERT INTO invoices VALUES('00000000-0000-4000-8000-000000000001','HC-2627-999991',350000);
      INSERT INTO holiday_class_registrations(id,invoice_id,attribution) VALUES('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','{"measurement":true}');`);
    const queued=await db.query("select event_name from holiday_class_meta_outbox");expect(queued.rows).toEqual([{event_name:'CompleteRegistration'}]);
  } finally {await db.close();}
},15000);
