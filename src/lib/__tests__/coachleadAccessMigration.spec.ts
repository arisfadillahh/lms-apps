import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
it('repairs only Coach Lead operational permissions idempotently', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE users(username text, role text, is_active boolean, admin_permissions jsonb);
      INSERT INTO users VALUES
      ('coachlead','ADMIN',true,'{"menus":["reports","classes"],"is_superadmin":false}'),
      ('finance','ADMIN',true,'{"menus":["payroll"],"is_superadmin":false}');`);
    const sql = readFileSync('supabase/migrations/20261121080000_coachlead_notification_access.sql', 'utf8');
    await db.exec(sql); await db.exec(sql);
    const { rows } = await db.query<{ username: string; admin_permissions: { menus: string[] } }>('SELECT * FROM users ORDER BY username');
    expect(rows[0].admin_permissions.menus).toEqual(['classes', 'coachAttendance', 'reports', 'trialAssessments']);
    expect(rows[1].admin_permissions.menus).toEqual(['payroll']);
  } finally { await db.close(); }
});
