import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureLocalReimbursements, handleLocalReimbursementStorage, localReimbursementLink } from '../../../scripts/lib/local-reimbursement.mjs';
import { verifyReimbursementToken } from '@/lib/payroll/reimbursementToken';

describe('isolated reimbursement preview adapters', () => {
  let db, server, runtime, backendUrl, client;
  const serviceKey = 'local-preview-service-test';
  const bucket = 'payroll-reimbursements-private';
  const object = '2098-11/20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.webp';
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(fs.readFileSync('scripts/payroll-local-schema.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261104100000_payroll.sql', 'utf8'));
    await ensureLocalReimbursements(db, process.cwd()); await ensureLocalReimbursements(db, process.cwd());
    runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-reimbursement-preview-'));
    server = http.createServer(async (req, res) => {
      try { if (!await handleLocalReimbursementStorage(req, res, { db, runtime, serviceKey, backendUrl })) { res.writeHead(404); res.end(); } }
      catch { res.writeHead(500); res.end('{}'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    backendUrl = `http://127.0.0.1:${server.address().port}`;
    client = createClient(backendUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }, 30000);
  afterAll(async () => { await new Promise(resolve => server?.close(resolve)); await db?.close(); if (runtime) fs.rmSync(runtime, { recursive: true, force: true }); });

  it('migrates only synthetic local tables idempotently and provides bounded rate-limit RPC behavior', async () => {
    expect((await db.query("SELECT to_regclass('payroll_reimbursements') AS name")).rows[0].name).toBe('payroll_reimbursements');
    await db.exec('SET ROLE service_role');
    const args = ['a'.repeat(64), 'fixture-only', 300, 1];
    expect((await db.query('SELECT consume_api_rate_limit($1,$2,$3,$4) AS allowed', args)).rows[0].allowed).toBe(true);
    expect((await db.query('SELECT consume_api_rate_limit($1,$2,$3,$4) AS allowed', args)).rows[0].allowed).toBe(false);
    await db.exec('RESET ROLE');
  });
  it('round-trips the real Supabase storage SDK with immutable private WebP evidence', async () => {
    const metadata = await client.storage.getBucket(bucket); expect(metadata.error).toBeNull(); expect(metadata.data.public).toBe(false);
    const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#123456' } }).webp().toBuffer();
    expect((await client.storage.from(bucket).upload(object, image, { contentType: 'image/webp', upsert: false })).error).toBeNull();
    expect((await client.storage.from(bucket).upload(object, image, { contentType: 'image/webp', upsert: false })).error).not.toBeNull();
    const download = await client.storage.from(bucket).download(object); expect(download.error).toBeNull(); expect(Buffer.from(await download.data.arrayBuffer())).toEqual(image);
    const anon = createClient(backendUrl, 'anon-fixture', { auth: { persistSession: false } });
    expect((await anon.storage.getBucket(bucket)).error).not.toBeNull();
    expect((await fetch(`${backendUrl}/storage/v1/object/${bucket}/${object}`)).status).toBe(403);
    expect((await client.storage.from(bucket).remove([object])).error).toBeNull();
    expect((await client.storage.from(bucket).download(object)).error).not.toBeNull();
  });
  it('generates a local no-login form link compatible with the production verifier without exposing the signing secret', () => {
    const secret = 'synthetic-only-secret-at-least-32-characters';
    const now = new Date('2026-11-25T09:00:00+07:00');
    const period = { id: '2026-11', status: 'DRAFT', correction_deadline: '2026-11-25T17:00:00+07:00' };
    const link = localReimbursementLink('20000000-0000-4000-8000-000000000001', period, secret, 'http://127.0.0.1:3005', now);
    expect(link).not.toContain(secret);
    const url = new URL(link); expect(url.search).toBe(''); expect(url.hash).toMatch(/^#token=/);
    expect(verifyReimbursementToken(new URLSearchParams(url.hash.slice(1)).get('token'), secret, now).periodId).toBe('2026-11');
    expect(localReimbursementLink('profile', period, secret, 'http://127.0.0.1:3005', new Date('2026-11-25T17:00:00+07:00'))).toBeNull();
  });
});
