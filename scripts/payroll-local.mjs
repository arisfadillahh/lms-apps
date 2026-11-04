/** Isolated payroll preview. Loopback only; synthetic data; never reads .env or VPS. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcrypt';
import { encode } from 'next-auth/jwt';

if (process.env.NODE_ENV === 'production') throw new Error('Local preview cannot run in production.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.codex-payroll-local');
const databasePath = path.join(runtime, 'database');
fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
if (process.argv.includes('--reset')) fs.rmSync(databasePath, { recursive: true, force: true });
const db = new PGlite(databasePath);
const port = Number(process.env.PAYROLL_LOCAL_PORT || 3005), backendPort = Number(process.env.PAYROLL_LOCAL_DB_PORT || 4055);
const appUrl = `http://127.0.0.1:${port}`, backendUrl = `http://127.0.0.1:${backendPort}`;
const secret = randomBytes(32).toString('hex'), serviceKey = 'payroll-local-service-only', anonKey = 'payroll-local-anon';
const adminId = '10000000-0000-4000-8000-000000000001';
const accounts = {
  admin: { id: adminId, username: 'admin', role: 'ADMIN', full_name: 'Admin Demo Lokal', permissions: null },
  coach: { id: '10000000-0000-4000-8000-000000000002', username: 'coach.demo', role: 'COACH', full_name: 'Coach Mitra Demo', permissions: null },
  fulltime: { id: '10000000-0000-4000-8000-000000000003', username: 'fulltime.demo', role: 'COACH', full_name: 'Coach Fulltime Demo', permissions: null },
  noWa: { id: '10000000-0000-4000-8000-000000000004', username: 'tanpawa.demo', role: 'COACH', full_name: 'Coach Tanpa WA Demo', permissions: null },
  limited: { id: '10000000-0000-4000-8000-000000000005', username: 'limited.demo', role: 'ADMIN', full_name: 'Admin Tanpa Akses Gaji', permissions: { menus: ['classes'], is_superadmin: false } },
  coder: { id: '10000000-0000-4000-8000-000000000006', username: 'coder.demo', role: 'CODER', full_name: 'Coder Demo', permissions: null },
};
const ident = value => { if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error('Invalid SQL identifier'); return `"${value}"`; };
const serialize = value => value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
const monthParts = () => { const d = new Date(Date.now() + 7 * 3600000); let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1; if (d.getUTCDate() >= 26) { m++; if (m > 12) { m = 1; y++; } } return { y, m }; };
const periodShape = (y, m) => {
  const day = (year, month, date, clock = '00:00:00') => new Date(`${year}-${String(month).padStart(2, '0')}-${date}T${clock}+07:00`).toISOString();
  return { id: `${y}-${String(m).padStart(2, '0')}`, year: y, month: m, starts_at: day(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, 26), ends_at: day(y, m, 26), correction_deadline: day(y, m, 25, '17:00:00'), status: 'DRAFT', version: 1, slips: [], warnings: [], overrides: {}, manual: [], activities: [], transfers: [], deliveries: {}, history: [], calculated_at: null };
};
let newDatabase = false;
const exists = await db.query("SELECT to_regclass('public.payroll_periods') AS name");
if (!exists.rows[0].name) {
  newDatabase = true;
  await db.exec(fs.readFileSync(path.join(root, 'scripts/payroll-local-schema.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261104100000_payroll.sql'), 'utf8'));
  const passwordHash = await bcrypt.hash('DemoLokal2026!', 8);
  for (const [key, account] of Object.entries(accounts)) await db.query('INSERT INTO users(id,username,password_hash,full_name,role,admin_permissions,parent_contact_phone) VALUES ($1,$2,$3,$4,$5,$6,$7)', [account.id, account.username, passwordHash, account.full_name, account.role, account.permissions ? JSON.stringify(account.permissions) : null, ['coach', 'fulltime'].includes(key) ? '081234567890' : null]);
  const { y, m } = monthParts(); const period = periodShape(y, m);
  const dates = [0, 1, 2].map(i => new Date(Math.min(Date.now() - (i + 1) * 86400000, Date.parse(period.ends_at) - 86400000)).toISOString());
  const people = [accounts.coach, accounts.fulltime, accounts.noWa];
  const profiles = [];
  for (let i = 0; i < people.length; i++) {
    const profileId = `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`; profiles.push(profileId);
    await db.query("INSERT INTO payroll_profiles(id,user_id,kind,name,job_title) VALUES ($1,$2,'COACH',$3,'Coach')", [profileId, people[i].id, people[i].full_name]);
    await db.query('INSERT INTO payroll_terms(profile_id,effective_from,contract,base_salary) VALUES ($1,$2,$3,$4)', [profileId, '2020-01-01', i === 1 ? 'FULLTIME' : 'MITRA', i === 1 ? 4000000 : 0]);
  }
  const staffId = '20000000-0000-4000-8000-000000000004';
  await db.query("INSERT INTO payroll_profiles(id,kind,name,job_title,staff_phone) VALUES ($1,'STAFF','Staf Operasional Demo','Operasional','081234567890')", [staffId]);
  await db.query("INSERT INTO payroll_terms(profile_id,effective_from,contract,base_salary) VALUES ($1,'2020-01-01','FULLTIME',3000000)", [staffId]);
  for (let i = 0; i < 3; i++) {
    const classId = `30000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const coach = i === 0 ? people[0] : people[1];
    await db.query('INSERT INTO classes(id,name,type,coach_id,delivery_mode,payroll_mode) VALUES ($1,$2,$3,$4,$5,$6)', [classId, ['Weekly Dua Anak', 'Ekskul Fulltime', 'Weekly Fee Mitra'][i], i === 1 ? 'EKSKUL' : 'WEEKLY', coach.id, i === 1 ? 'OFFLINE' : 'ONLINE', i === 1 ? 'FULLTIME' : 'MITRA']);
    for (let j = 0; j < [2, 3, 1][i]; j++) {
      const coderId = randomUUID(); await db.query("INSERT INTO users(id,username,full_name,role) VALUES ($1,$2,$3,'CODER')", [coderId, `child-${i}-${j}`, `Coder Contoh ${i}-${j}`]);
      await db.query("INSERT INTO enrollments(id,class_id,coder_id,enrolled_at,status) VALUES ($1,$2,$3,'2020-01-01','ACTIVE')", [randomUUID(), classId, coderId]);
    }
    for (const date of dates) await db.query("INSERT INTO sessions(id,class_id,date_time,status) VALUES ($1,$2,$3,'COMPLETED')", [randomUUID(), classId, date]);
  }
  // One teacher session with two children, and two paid conversion bonuses.
  for (let i = 0; i < 2; i++) {
    const tid = randomUUID(), aid = randomUUID(), iid = randomUUID();
    await db.query("INSERT INTO trial_class_submissions(id,student_name,phone,trial_mode,status,coach_id,scheduled_at) VALUES ($1,$2,'081111111111','ONLINE','SCHEDULED',$3,$4)", [tid, `Peserta Trial Demo ${i + 1}`, accounts.coach.id, dates[0]]);
    await db.query("INSERT INTO invoices(id,status) VALUES ($1,'PAID')", [iid]);
    await db.query("INSERT INTO trial_assessments(id,trial_id,coach_id,status,invoice_id,submitted_at,payment_confirmed_at) VALUES ($1,$2,$3,'PAID',$4,$5,$5)", [aid, tid, accounts.coach.id, iid, dates[0]]);
  }
  await db.query('UPDATE payroll_settings SET active_from=$1,automation_enabled=false', ['2020-01-01']);
  await db.query('INSERT INTO payroll_periods(id,document) VALUES ($1,$2)', [period.id, JSON.stringify(period)]);
  // A closed historical period demonstrates archive filters and safe PDF delivery.
  const old = periodShape(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
  old.status = 'FINAL'; old.calculated_at = old.ends_at;
  old.slips = people.map((p, i) => ({ profile_id: profiles[i], user_id: p.id, kind: 'COACH', name: p.full_name, job_title: 'Coach', contract: i === 1 ? 'FULLTIME' : 'MITRA', lines: [{ key: 'example:' + i, date: old.starts_at, label: 'Contoh arsip lokal', kind: i === 1 ? 'SALARY' : 'WEEKLY', quantity: 1, rate: i === 1 ? 4000000 : 100000, amount: i === 1 ? 4000000 : 100000, details: 'Data contoh lokal, bukan data production' }], total: i === 1 ? 4000000 : 100000 }));
  old.history = [{ version: 1, finalized_at: old.ends_at, finalized_by: adminId, slips: structuredClone(old.slips) }];
  old.transfers = old.slips.map(s => ({ id: `${old.id}:${s.profile_id}:1`, profile_id: s.profile_id, version: 1, amount: s.total, at: old.ends_at, by: adminId, reference: 'SIMULASI LOKAL' }));
  await db.query('INSERT INTO payroll_periods(id,document) VALUES ($1,$2)', [old.id, JSON.stringify(old)]);
}

async function cookieFor(name) {
  const a = accounts[name]; if (!a) throw new Error('Unknown preview account');
  return encode({ secret, maxAge: 24 * 3600, token: { userId: a.id, username: a.username, role: a.role, fullName: a.full_name, isActive: true, adminPermissions: a.permissions } });
}
async function bodyOf(req) { const pieces = []; let n = 0; for await (const b of req) { n += b.length; if (n > 4 * 1024 * 1024) throw new Error('Request too large'); pieces.push(b); } return pieces.length ? JSON.parse(Buffer.concat(pieces).toString()) : null; }
function json(res, status, data, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(data)); }
function where(params, values) {
  const clauses = [];
  for (const [key, expression] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    const column = ident(key), dot = expression.indexOf('.'), op = expression.slice(0, dot), raw = expression.slice(dot + 1);
    if (op === 'is' && raw === 'null') { clauses.push(`${column} IS NULL`); continue; }
    if (op === 'not' && raw === 'is.null') { clauses.push(`${column} IS NOT NULL`); continue; }
    if (op === 'in') { const items = raw.replace(/^\(|\)$/g, '').split(',').filter(Boolean); if (!items.length) { clauses.push('FALSE'); continue; } clauses.push(`${column} IN (${items.map(v => { values.push(v.replace(/^"|"$/g, '')); return '$' + values.length; }).join(',')})`); continue; }
    const operators = { eq: '=', neq: '<>', gte: '>=', gt: '>', lte: '<=', lt: '<', like: 'LIKE', ilike: 'ILIKE' };
    if (!operators[op]) throw new Error('Unsupported local filter: ' + op);
    values.push(raw); clauses.push(`${column} ${operators[op]} $${values.length}`);
  }
  return clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
}
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, backendUrl);
    if (u.pathname === '/health') return json(res, 200, { local: true });
    if (u.pathname === '/preview') {
      const name = u.searchParams.get('as') || 'admin', a = accounts[name]; if (!a) return json(res, 404, { error: 'Unknown preview account' });
      const token = await cookieFor(name);
      res.writeHead(302, { 'Set-Cookie': `next-auth.session-token=${token}; HttpOnly; SameSite=Lax; Path=/`, Location: appUrl + (a.role === 'COACH' ? '/coach/payroll' : '/admin/payroll') }); return res.end();
    }
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(`<!doctype html><html lang="id"><meta charset="utf-8"><title>Preview lokal payroll</title><style>body{font:17px/1.7 system-ui;max-width:700px;margin:60px auto;padding:20px}a{display:block;padding:12px;margin:10px 0;background:#eef4ff}p{color:#526}</style><h1>Preview lokal penggajian Clevio</h1><p>Data sintetis. Database terisolasi. WhatsApp hanya simulasi; tidak mengirim pesan sungguhan.</p>${Object.entries(accounts).filter(([key]) => !['limited', 'coder'].includes(key)).map(([k,a])=>`<a href="/preview?as=${k}">${a.full_name}</a>`).join('')}<p>Masuk sebagai admin untuk konfigurasi, arsip, dan slip; pilih coach untuk menguji akses rekap pribadi.</p></html>`);
    }
    if (!u.pathname.startsWith('/rest/v1/')) return json(res, 404, { error: 'Local sandbox endpoint not found' });
    if (req.headers.apikey !== serviceKey && req.headers.apikey !== anonKey) return json(res, 401, { message: 'Invalid local key' });
    const role = req.headers.apikey === serviceKey ? 'service_role' : 'anon';
    const name = decodeURIComponent(u.pathname.slice('/rest/v1/'.length));
    const body = await bodyOf(req);
    const result = await db.transaction(async tx => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      if (name.startsWith('rpc/')) {
        const fn = name.slice(4); if (!['payroll_commit_period', 'payroll_save_profile', 'payroll_set_class_mode', 'payroll_review_activity'].includes(fn)) throw new Error('Unsupported local RPC');
        const meta = await tx.query('SELECT proargnames, oidvectortypes(proargtypes) AS types FROM pg_proc WHERE proname=$1', [fn]);
        const m = meta.rows[0], types = m.types.split(', '), args = [], vals = [];
        for (let i = 0; i < m.proargnames.length; i++) if (Object.hasOwn(body || {}, m.proargnames[i])) { vals.push(serialize(body[m.proargnames[i]])); args.push(`${ident(m.proargnames[i])} => $${vals.length}::${types[i]}`); }
        const r = await tx.query(`SELECT public.${ident(fn)}(${args.join(',')}) AS result`, vals); return { rows: r.rows[0].result, scalar: true };
      }
      const table = ident(name), values = [], clause = where(u.searchParams, values);
      if (req.method === 'GET' || req.method === 'HEAD') {
        const select = u.searchParams.get('select') || '*';
        const fields = select === '*' ? '*' : select.split(',').map(ident).join(',');
        const order = (u.searchParams.get('order') || '').split(',').filter(Boolean).map(x => { const [k, dir] = x.split('.'); return ident(k) + (dir === 'desc' ? ' DESC' : ' ASC'); }).join(',');
        const count = await tx.query(`SELECT count(*)::int AS n FROM public.${table}${clause}`, values);
        const limit = Math.min(1000, Number(u.searchParams.get('limit') || 1000)), offset = Number(u.searchParams.get('offset') || 0);
        const r = await tx.query(`SELECT ${fields} FROM public.${table}${clause}${order ? ' ORDER BY ' + order : ''} LIMIT ${limit} OFFSET ${offset}`, values);
        const dateColumns = new Set(r.fields.filter(f => f.dataTypeID === 1082).map(f => f.name));
        const rows = r.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, dateColumns.has(key) && value instanceof Date ? value.toISOString().slice(0, 10) : value])));
        return { rows, count: count.rows[0].n };
      }
      if (req.method === 'POST') {
        const rows = Array.isArray(body) ? body : [body]; let returned = [];
        for (const row of rows) {
          const keys = Object.keys(row), vals = keys.map(k => serialize(row[k]));
          const conflict = u.searchParams.get('on_conflict');
          let sql = `INSERT INTO public.${table}(${keys.map(ident).join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`;
          if (conflict) sql += ` ON CONFLICT (${conflict.split(',').map(ident).join(',')}) ` + (String(req.headers.prefer).includes('ignore-duplicates') ? 'DO NOTHING' : `DO UPDATE SET ${keys.filter(k => !conflict.split(',').includes(k)).map(k=>`${ident(k)}=EXCLUDED.${ident(k)}`).join(',')}`);
          sql += ' RETURNING *'; returned.push(...(await tx.query(sql, vals)).rows);
        }
        return { rows: returned };
      }
      if (req.method === 'PATCH') {
        const vals = [], assignments = Object.keys(body).map(k => { vals.push(serialize(body[k])); return ident(k) + '=$' + vals.length; });
        const filter = where(u.searchParams, vals);
        return { rows: (await tx.query(`UPDATE public.${table} SET ${assignments.join(',')}${filter} RETURNING *`, vals)).rows };
      }
      throw new Error('Unsupported local method');
    });
    const single = String(req.headers.accept || '').includes('vnd.pgrst.object');
    if (single && !result.scalar && result.rows.length !== 1) return json(res, 406, { code: 'PGRST116', details: `The result contains ${result.rows.length} rows`, message: 'JSON object requested, multiple (or no) rows returned' });
    const count = result.count ?? (Array.isArray(result.rows) ? result.rows.length : 1);
    if (req.method === 'HEAD') { res.writeHead(200, { 'Content-Range': `0-${Math.max(0,count-1)}/${count}` }); return res.end(); }
    json(res, req.method === 'POST' ? 201 : 200, result.scalar ? result.rows : single ? result.rows[0] : result.rows, { 'Content-Range': `0-${Math.max(0,count-1)}/${count}` });
  } catch (e) { json(res, e.code === '42501' ? 403 : 400, { code: e.code || 'LOCAL_ERROR', message: String(e.message), details: e.detail || '' }); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(backendPort, '127.0.0.1', resolve); });
const log = fs.openSync(path.join(runtime, 'next.log'), 'a', 0o600);
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: root, stdio: ['ignore', log, log], env: { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', PAYROLL_LOCAL_PREVIEW: 'true', NEXTAUTH_SECRET: secret, NEXTAUTH_URL: appUrl, NEXT_PUBLIC_APP_URL: appUrl, NEXT_PUBLIC_SUPABASE_URL: backendUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey, PORT: String(port), WHATSAPP_AUTH_DIR: path.join(runtime, 'wa-never-connected') },
});
child.on('exit', code => { if (!stopping) { console.error('Local Next server exited:', code); process.exitCode = code || 1; server.close(); db.close(); } });
let stopping = false;
async function stop() { if (stopping) return; stopping = true; child.kill('SIGTERM'); server.close(); await db.close(); }
process.on('SIGINT', () => stop().finally(() => process.exit(0))); process.on('SIGTERM', () => stop().finally(() => process.exit(0)));
let ready = false;
for (let i = 0; i < 90; i++) { try { const r = await fetch(appUrl + '/api/auth/providers'); if (r.ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 1000)); }
if (!ready) { await stop(); throw new Error('Local Next server did not become ready. Inspect .codex-payroll-local/next.log'); }
if (newDatabase) {
  try {
    const { y,m } = monthParts(), p = periodShape(y,m), token = await cookieFor('admin');
    const r = await fetch(appUrl + '/api/admin/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `next-auth.session-token=${token}` }, body: JSON.stringify({ action: 'calculate', periodId: p.id, revision: 0 }) });
    console.log('Initial demo calculation:', r.status);
  } catch (e) { console.log('Demo calculation can be run from the Admin button:', e.message); }
}
console.log(`LOCAL PREVIEW READY\nLanding: ${backendUrl}\nAdmin: ${backendUrl}/preview?as=admin\nCoach: ${backendUrl}/preview?as=coach\nCoach without WA: ${backendUrl}/preview?as=noWa\nData: ${databasePath}\nNo production connection. External WhatsApp delivery is simulated.`);
