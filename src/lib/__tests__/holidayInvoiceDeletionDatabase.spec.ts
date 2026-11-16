import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const target = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
let db: PGlite;

async function remove(id = target, confirmed = true) {
    const { rows } = await db.query<{ result: string }>(
        'select public.delete_holiday_registration_invoice($1, $2) as result',
        [id, confirmed]
    );
    return rows[0].result;
}

async function countRows() {
    const { rows } = await db.query(`
        select (select count(*)::int from invoices) as invoices,
            (select count(*)::int from invoice_items) as items,
            (select count(*)::int from holiday_class_registrations) as registrations,
            (select count(*)::int from holiday_class_whatsapp_outbox) as outbox
    `);
    return rows[0];
}

describe('Holiday invoice deletion PostgreSQL transaction', () => {
    beforeAll(async () => {
        db = await PGlite.create();
        await db.exec(`
            create role anon;
            create role authenticated;
            create role service_role;
            create type invoice_status_enum as enum ('PENDING','OVERDUE','PAID');
            create table invoices (id uuid primary key, invoice_number text, status invoice_status_enum, paid_at timestamptz);
            create table invoice_items (invoice_id uuid references invoices(id) on delete cascade);
            create table holiday_class_registrations (
                id uuid primary key, invoice_id uuid not null unique references invoices(id) on delete restrict,
                payment_url text, payment_claimed_at timestamptz
            );
            create table holiday_class_whatsapp_outbox (
                registration_id uuid references holiday_class_registrations(id) on delete cascade
            );
            create table retained_checkout (invoice_id uuid references invoices(id) on delete restrict);
        `);
        await db.exec(readFileSync('supabase/migrations/20261116110000_delete_holiday_registration_invoice.sql', 'utf8'));
    }, 30000);

    beforeEach(async () => {
        await db.exec(`
            truncate invoices cascade;
            insert into invoices values ('${target}', 'HC-2627-000001', 'PENDING'), ('${other}', 'MONTHLY-00002', 'PENDING');
            insert into holiday_class_registrations (id, invoice_id) values ('${target}', '${target}');
            insert into holiday_class_whatsapp_outbox values ('${target}');
            insert into invoice_items values ('${target}'), ('${other}');
        `);
    });

    afterAll(async () => { await db?.close(); });

    it('deletes the selected invoice, items, registration and outbox together after confirmation', async () => {
        expect(await remove(target, false)).toBe('ready');
        expect(await countRows()).toEqual({ invoices: 2, items: 2, registrations: 1, outbox: 1 });
        expect(await remove()).toBe('deleted');
        expect(await countRows()).toEqual({ invoices: 1, items: 1, registrations: 0, outbox: 0 });
        expect(await remove()).toBe('missing');
    });

    it('protects a paid invoice and an ordinary invoice', async () => {
        await db.query('update invoices set paid_at = now() where id = $1', [target]);
        expect(await remove()).toBe('paid');
        expect(await remove(other)).toBe('protected');
        expect(await countRows()).toEqual({ invoices: 2, items: 2, registrations: 1, outbox: 1 });
    });

    it('rolls back registration deletion if deleting the invoice violates a foreign key', async () => {
        await db.query('insert into retained_checkout values ($1)', [target]);
        await expect(remove()).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
        expect(await countRows()).toEqual({ invoices: 2, items: 2, registrations: 1, outbox: 1 });
    });

    it('only grants RPC access to the server role', async () => {
        const { rows } = await db.query(`
            select role, has_function_privilege(role, 'delete_holiday_registration_invoice(uuid,boolean)', 'execute') as can_execute
            from (values ('anon'), ('authenticated'), ('service_role')) as roles(role)
        `);
        expect(rows).toEqual([
            { role: 'anon', can_execute: false },
            { role: 'authenticated', can_execute: false },
            { role: 'service_role', can_execute: true },
        ]);
    });
});
