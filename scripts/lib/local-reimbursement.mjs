/** Loopback synthetic preview only. Never import from the production app. */
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';

const bucket = 'payroll-reimbursements-private';
const objectPattern = /^20\d{2}-(0[1-9]|1[0-2])\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }

export function localReimbursementLink(profileId, period, secret, appUrl, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = Math.min(Math.floor(Date.parse(period.correction_deadline) / 1000), issuedAt + 35 * 86400);
  if (period.status !== 'DRAFT' || expiresAt <= issuedAt) return null;
  const payload = Buffer.from(JSON.stringify({ version: 1, profileId, periodId: period.id, issuedAt, expiresAt, nonce: randomBytes(18).toString('base64url') })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`payroll-reimbursement:v1:${payload}`).digest('base64url');
  return `${appUrl}/payroll/reimbursement#token=${payload}.${signature}`;
}

export async function ensureLocalReimbursements(db, root) {
  await db.exec(`CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE IF NOT EXISTS storage.buckets(id text PRIMARY KEY,name text,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE IF NOT EXISTS storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
  const exists = await db.query("SELECT to_regclass('public.payroll_reimbursements') AS name");
  if (!exists.rows[0].name) await db.transaction(tx => tx.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261106100000_payroll_reimbursements.sql'), 'utf8')));
  await db.exec(`CREATE TABLE IF NOT EXISTS public.local_reimbursement_api_rates(key_hash text PRIMARY KEY,window_start timestamptz NOT NULL,hits integer NOT NULL);
    REVOKE ALL ON public.local_reimbursement_api_rates FROM PUBLIC,anon,authenticated,service_role;
    CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_key_hash text,p_scope text,p_window_seconds integer,p_max_requests integer)
    RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
    DECLARE count integer;
    BEGIN
      IF p_key_hash !~ '^[0-9a-f]{64}$' OR p_window_seconds NOT BETWEEN 1 AND 86400 OR p_max_requests NOT BETWEEN 1 AND 10000 THEN RETURN false; END IF;
      INSERT INTO public.local_reimbursement_api_rates(key_hash,window_start,hits) VALUES(p_key_hash,now(),1)
      ON CONFLICT(key_hash) DO UPDATE SET hits=CASE WHEN now() >= local_reimbursement_api_rates.window_start+make_interval(secs=>p_window_seconds) THEN 1 ELSE local_reimbursement_api_rates.hits+1 END,
        window_start=CASE WHEN now() >= local_reimbursement_api_rates.window_start+make_interval(secs=>p_window_seconds) THEN now() ELSE local_reimbursement_api_rates.window_start END
      RETURNING hits INTO count;
      RETURN count <= p_max_requests;
    END $$;
    REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text,text,integer,integer) TO service_role;`);
}

/** Returns true if the request belongs to the private storage adapter. */
export async function handleLocalReimbursementStorage(req, res, { db, runtime, serviceKey, backendUrl }) {
  const url = new URL(req.url, backendUrl);
  if (!url.pathname.startsWith('/storage/v1/')) return false;
  if (req.headers.apikey !== serviceKey || req.headers.authorization !== `Bearer ${serviceKey}`) { json(res, 403, { statusCode: '403', error: 'Forbidden', message: 'Local private storage requires the server key' }); return true; }
  const target = decodeURIComponent(url.pathname.slice('/storage/v1/'.length));
  if (target === `bucket/${bucket}` && req.method === 'GET') {
    const metadata = (await db.query('SELECT * FROM storage.buckets WHERE id=$1', [bucket])).rows[0];
    json(res, metadata ? 200 : 404, metadata ?? { message: 'Bucket not found' }); return true;
  }
  const objectPrefix = `object/${bucket}`;
  const folder = path.join(runtime, 'private-reimbursement-evidence');
  if (target.startsWith(objectPrefix + '/')) {
    const object = target.slice(objectPrefix.length + 1);
    if (!objectPattern.test(object)) { json(res, 400, { message: 'Invalid local evidence path' }); return true; }
    const file = path.join(folder, object);
    if (req.method === 'POST') {
      if (req.headers['content-type'] !== 'image/webp' || req.headers['x-upsert'] === 'true') { json(res, 400, { message: 'Only immutable WebP evidence is allowed' }); return true; }
      const pieces = []; let size = 0;
      for await (const part of req) { size += part.length; if (size > 3145728) { json(res, 413, { message: 'Evidence too large' }); return true; } pieces.push(part); }
      const image = Buffer.concat(pieces);
      if (image.length < 12 || image.subarray(0, 4).toString() !== 'RIFF' || image.subarray(8, 12).toString() !== 'WEBP') { json(res, 400, { message: 'Invalid WebP evidence' }); return true; }
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      try { fs.writeFileSync(file, image, { flag: 'wx', mode: 0o600 }); }
      catch (e) { if (e.code !== 'EEXIST') throw e; json(res, 409, { statusCode: '409', error: 'Duplicate', message: 'Evidence already exists' }); return true; }
      json(res, 200, { Key: `${bucket}/${object}`, Id: randomUUID() }); return true;
    }
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) { json(res, 404, { message: 'Evidence not found' }); return true; }
      res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store' }); res.end(fs.readFileSync(file)); return true;
    }
  }
  if (target === objectPrefix && req.method === 'DELETE') {
    const pieces = []; let size = 0;
    for await (const part of req) { size += part.length; if (size > 8192) { json(res, 413, { message: 'Request too large' }); return true; } pieces.push(part); }
    const body = JSON.parse(Buffer.concat(pieces).toString());
    if (!Array.isArray(body.prefixes) || body.prefixes.length > 30 || body.prefixes.some(item => typeof item !== 'string' || !objectPattern.test(item))) { json(res, 400, { message: 'Invalid evidence paths' }); return true; }
    for (const object of body.prefixes) fs.rmSync(path.join(folder, object), { force: true });
    json(res, 200, body.prefixes.map(name => ({ name }))); return true;
  }
  json(res, 404, { message: 'Local private storage endpoint not found' }); return true;
}
