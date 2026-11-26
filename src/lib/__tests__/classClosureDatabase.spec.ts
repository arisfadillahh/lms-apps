import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const migration = readFileSync('supabase/migrations/20261126160000_close_and_archive_class.sql', 'utf8');
const db = new PGlite();
const close = async (name: string | null, actor = id(1)) => {
  const result = await db.query<{ result: Record<string, unknown> }>('SELECT close_and_archive_class($1,$2,$3) AS result', [id(2), actor, name]);
  return result.rows[0].result;
};

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE users(id uuid PRIMARY KEY, role text, is_active boolean);
    CREATE TABLE classes(id uuid PRIMARY KEY, name text, level_id uuid, lifecycle_status text, archived_at timestamptz, updated_at timestamptz);
    CREATE TABLE sessions(id uuid PRIMARY KEY, class_id uuid REFERENCES classes, status text, date_time timestamptz, updated_at timestamptz);
    CREATE TABLE enrollments(id uuid PRIMARY KEY, class_id uuid REFERENCES classes, coder_id uuid, status text, enrolled_at timestamptz, ended_at timestamptz, exit_reason text, updated_at timestamptz);
    CREATE TABLE coder_payment_periods(id uuid PRIMARY KEY, class_id uuid REFERENCES classes, status text, end_date date, total_amount numeric);
    CREATE TABLE invoices(id uuid PRIMARY KEY, status text, total_amount integer);
    CREATE TABLE invoice_items(invoice_id uuid REFERENCES invoices, payment_period_id uuid REFERENCES coder_payment_periods);
    CREATE TABLE coder_block_placements(coder_id uuid, source_class_id uuid, status text);
    CREATE TABLE coder_block_progress(coder_id uuid, level_id uuid, deferred_after_class boolean, status text);
    CREATE TABLE class_lifecycle_changes(class_id uuid, previous_status text, new_status text, changed_by uuid, cancelled_session_count integer);
  `);
  await db.exec(migration);
});

beforeEach(async () => {
  await db.exec(`
    TRUNCATE users, classes, sessions, enrollments, coder_payment_periods, invoices, invoice_items,
      coder_block_placements, coder_block_progress, class_lifecycle_changes;
    INSERT INTO users VALUES ('${id(1)}', 'ADMIN', true), ('${id(4)}', 'CODER', true);
    INSERT INTO classes(id,name,level_id,lifecycle_status) VALUES ('${id(2)}','Creator Sabtu','${id(11)}','ACTIVE'), ('${id(3)}','Kelas lain',NULL,'ACTIVE');
    INSERT INTO sessions(id,class_id,status,date_time) VALUES
      ('${id(5)}','${id(2)}','COMPLETED',now()-interval '7 days'),
      ('${id(6)}','${id(2)}','SCHEDULED',now()+interval '7 days'),
      ('${id(7)}','${id(3)}','SCHEDULED',now()+interval '7 days');
    INSERT INTO enrollments(id,class_id,coder_id,status,enrolled_at) VALUES
      ('${id(8)}','${id(2)}','${id(4)}','ACTIVE',now()-interval '14 days'),
      ('${id(9)}','${id(3)}','${id(4)}','ACTIVE',now()-interval '14 days');
    INSERT INTO coder_payment_periods VALUES ('${id(10)}','${id(2)}','ACTIVE','2026-11-25',590000),
      ('${id(12)}','${id(3)}','ACTIVE','2026-11-25',590000);
    INSERT INTO invoices VALUES ('${id(13)}','PENDING',1180000), ('${id(14)}','PAID',590000);
    INSERT INTO invoice_items VALUES ('${id(13)}','${id(10)}'), ('${id(13)}','${id(12)}'), ('${id(14)}','${id(10)}');
  `);
});

afterAll(() => db.close());

describe('class closure transaction', () => {
  it('previews one distinct invoice without writing and archives exactly the selected class', async () => {
    expect(await close(null)).toEqual({ archived: false, className: 'Creator Sabtu', sessions: 1, enrollments: 1, paymentPeriods: 1, openInvoices: 1, pendingPlacements: 0 });
    expect((await db.query("SELECT * FROM class_lifecycle_changes")).rows).toHaveLength(0);
    expect(await close('Creator Sabtu')).toMatchObject({ archived: true, sessions: 1, enrollments: 1, paymentPeriods: 1, openInvoices: 1 });
    expect((await db.query('SELECT lifecycle_status, archived_at IS NOT NULL AS archived FROM classes ORDER BY id')).rows)
      .toEqual([{ lifecycle_status:'ENDED',archived:true }, { lifecycle_status:'ACTIVE',archived:false }]);
    expect((await db.query<{ status: string }>('SELECT status FROM sessions ORDER BY id')).rows.map(({ status })=>status)).toEqual(['COMPLETED','CANCELLED','SCHEDULED']);
    expect((await db.query<{ status: string }>('SELECT status FROM enrollments ORDER BY id')).rows.map(({ status })=>status)).toEqual(['INACTIVE','ACTIVE']);
    expect((await db.query('SELECT status, end_date::text, total_amount::int FROM coder_payment_periods ORDER BY id')).rows)
      .toEqual([{status:'EXPIRED',end_date:'2026-11-25',total_amount:590000},{status:'ACTIVE',end_date:'2026-11-25',total_amount:590000}]);
    expect((await db.query('SELECT status,total_amount FROM invoices ORDER BY id')).rows).toEqual([{status:'PENDING',total_amount:1180000},{status:'PAID',total_amount:590000}]);
    expect(await close('Creator Sabtu')).toMatchObject({ archived:true, sessions:0, paymentPeriods:0 });
    expect((await db.query('SELECT * FROM class_lifecycle_changes')).rows).toHaveLength(1);
  });

  it('requires an active admin and the same name shown in the preview', async () => {
    await expect(close(null, id(4))).rejects.toMatchObject({code:'PT403'});
    await expect(close('Nama lain')).rejects.toMatchObject({code:'PT409'});
    expect((await db.query('SELECT * FROM class_lifecycle_changes')).rows).toHaveLength(0);
    await db.exec('SET ROLE authenticated');
    try { await expect(close(null)).rejects.toMatchObject({code:'42501'}); }
    finally { await db.exec('RESET ROLE'); }
  });

  it('keeps deferred placement available and makes no partial change on failure', async () => {
    await db.exec(`INSERT INTO coder_block_placements VALUES ('${id(4)}','${id(2)}','NEEDS_BLOCK_PLACEMENT');`);
    expect(await close(null)).toMatchObject({pendingPlacements:1});
    await expect(close('Creator Sabtu')).rejects.toMatchObject({code:'PT409'});
    await db.exec(`TRUNCATE coder_block_placements; ALTER TABLE class_lifecycle_changes ADD CONSTRAINT forced_error CHECK (false);`);
    try { await expect(close('Creator Sabtu')).rejects.toMatchObject({code:'23514'}); }
    finally { await db.exec('ALTER TABLE class_lifecycle_changes DROP CONSTRAINT forced_error;'); }
    expect(await close(null)).toMatchObject({archived:false,sessions:1,enrollments:1,paymentPeriods:1});
  });

  it('retains financial records from late settlements and prevents new sessions or active enrollment', async () => {
    await close('Creator Sabtu');
    await db.exec(`INSERT INTO coder_payment_periods VALUES ('${id(15)}','${id(2)}','ACTIVE','2026-12-25',590000)`);
    expect((await db.query(`SELECT status FROM coder_payment_periods WHERE id='${id(15)}'`)).rows).toEqual([{status:'EXPIRED'}]);
    await expect(db.exec(`UPDATE enrollments SET status='ACTIVE' WHERE id='${id(8)}'`)).rejects.toMatchObject({code:'PT409'});
    await expect(db.exec(`UPDATE sessions SET status='SCHEDULED' WHERE id='${id(6)}'`)).rejects.toMatchObject({code:'PT409'});
  });
});
