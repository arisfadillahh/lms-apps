// Local PGlite only: derive app tables/relationships from repository schema,
// without importing production data, policies, triggers or external extensions.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function splitTopLevel(source, delimiter = ',') {
  const parts = []; let start = 0, depth = 0, quote = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quote) { if (ch === quote) { if (source[i + 1] === quote) i++; else quote = ''; } continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === delimiter && depth === 0) { parts.push(source.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(source.slice(start).trim()); return parts.filter(Boolean);
}
const ident = name => { if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error('Invalid local schema identifier'); return `"${name}"`; };
const prop = (node, name) => node?.members?.find(p => p.name?.getText().replace(/['"]/g, '') === name);
const strings = type => [...(type?.getText().matchAll(/['"]([^'"]+)['"]/g) ?? [])].map(m => m[1]);
function appTypes(root) {
  const source = ts.createSourceFile('supabase.ts', fs.readFileSync(path.join(root, 'src/types/supabase.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  const database = source.statements.find(s => (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) && s.name.text === 'Database');
  const tables = prop(prop(database.type ?? database, 'public').type, 'Tables').type;
  return tables.members.map(table => ({ name: table.name.getText().replace(/['"]/g, ''), row: prop(table.type, 'Row').type, relationships: prop(table.type, 'Relationships')?.type }));
}
function sqlType(type, name, foreignKey = false) {
  const text = type.getText().replace(/\s*\|\s*(null|undefined)/g, '');
  if (foreignKey) return /number/.test(text) ? 'bigint' : 'uuid';
  if (['client_id','chat_id','google_calendar_event_id','google_event_id','midtrans_order_id','midtrans_transaction_id','message_id'].includes(name)) return 'text';
  if (name === 'id' || name.endsWith('_id')) return /number/.test(text) ? 'bigint' : 'uuid';
  if (text === 'Json' || text.includes('{')) return 'jsonb';
  if (text.endsWith('[]')) return text.startsWith('number') ? 'double precision[]' : 'text[]';
  if (text === 'boolean') return 'boolean';
  if (text === 'number') return 'double precision';
  if (name.endsWith('_at') || name === 'date_time') return 'timestamptz';
  if (name.endsWith('_date') || name === 'birth_date') return 'date';
  return 'text';
}

export async function ensureLocalAppSchema(db, root) {
  const source = fs.readFileSync(path.join(root, 'supabase/migrations/20260327041503_remote_schema.sql'), 'utf8');
  // Snapshot CREATE TABLE statements contain no user data. Skip host-only vector
  // storage, replacing its unused local column type with JSON for inspection.
  for (const match of source.matchAll(/CREATE TYPE "public"\."([^"]+)" AS ENUM\s*\([\s\S]*?\);/g)) {
    if (!(await db.query('SELECT 1 FROM pg_type WHERE typname=$1', [match[1]])).rows.length) await db.exec(match[0]);
  }
  for (const match of source.matchAll(/CREATE SEQUENCE IF NOT EXISTS "public"\."[^"]+"[\s\S]*?;/g)) await db.exec(match[0]);
  for (const match of source.matchAll(/CREATE TABLE IF NOT EXISTS "public"\."([^"]+)"\s*\(([\s\S]*?)\n\);/g)) {
    const name = match[1];
    const ddl = match[0].replace(/"public"\."vector"\(\d+\)/g, 'jsonb').replace(/"extensions"\."uuid_generate_v4"\(\)/g, 'gen_random_uuid()');
    await db.exec(ddl);
    const columnRows = (await db.query('SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1', [name])).rows;
    const columns = columnRows.map(r => r.column_name);
    for (const definition of splitTopLevel(match[2])) {
      const column = definition.match(/^"([^"]+)"\s/);
      if (!column) continue;
      const nullable = definition.replace(/\s+NOT NULL\b/g, '').replace(/"public"\."vector"\(\d+\)/g, 'jsonb').replace(/"extensions"\."uuid_generate_v4"\(\)/g, 'gen_random_uuid()');
      if (!columns.includes(column[1])) await db.exec(`ALTER TABLE public.${ident(name)} ADD COLUMN ${nullable}`);
      const defaultExpression = nullable.match(/\bDEFAULT\s+([\s\S]+)$/);
      if (defaultExpression) {
        // Early preview versions represented coach_skills as JSON. Preserve
        // those records while accepting the canonical array's default value.
        const expression = columnRows.find(c => c.column_name === column[1])?.udt_name === 'jsonb' && /\[\]$/.test(defaultExpression[1]) ? `to_jsonb(${defaultExpression[1]})` : defaultExpression[1];
        await db.exec(`ALTER TABLE public.${ident(name)} ALTER COLUMN ${ident(column[1])} SET DEFAULT ${expression}`);
      }
    }
  }
  // Generated app types include tables/columns added after the schema snapshot.
  // The preview adds them without destructive changes to existing demo records.
  const types = appTypes(root);
  for (const table of types) {
    await db.exec(`CREATE TABLE IF NOT EXISTS public.${ident(table.name)} (id uuid PRIMARY KEY DEFAULT gen_random_uuid())`);
    const columns = (await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1', [table.name])).rows.map(r => r.column_name);
    const foreignColumns = new Set((table.relationships?.elements ?? []).flatMap(element => strings(prop(element, 'columns')?.type)));
    for (const field of table.row.members ?? []) {
      const name = field.name.getText().replace(/['"]/g, '');
      if (!columns.includes(name)) await db.exec(`ALTER TABLE public.${ident(table.name)} ADD COLUMN ${ident(name)} ${sqlType(field.type, name, foreignColumns.has(name))}`);
    }
  }
  // Apply primary/unique keys from the snapshot so relationship integrity is real.
  for (const match of source.matchAll(/ALTER TABLE ONLY "public"\."([^"]+)"\s+ADD CONSTRAINT "([^"]+)" ((?:PRIMARY KEY|UNIQUE) [\s\S]*?);/g)) {
    const exists = await db.query('SELECT 1 FROM pg_constraint WHERE conrelid=$1::regclass AND (conname=$2 OR ($3 AND contype=\'p\'))', [`public.${match[1]}`, match[2], match[3].startsWith('PRIMARY')]);
    if (!exists.rows.length) await db.exec(match[0]);
  }
  // Canonical foreign keys plus newer relationships declared by app types.
  const relations = [];
  for (const m of source.matchAll(/ALTER TABLE ONLY "public"\."([^"]+)"\s+ADD CONSTRAINT "([^"]+)" FOREIGN KEY \(([^)]+)\) REFERENCES "public"\."([^"]+)"\(([^)]+)\)[^;]*;/g)) {
    relations.push({ table: m[1], name: m[2], columns: m[3].replace(/"/g, '').split(',').map(s => s.trim()), target: m[4], targetColumns: m[5].replace(/"/g, '').split(',').map(s => s.trim()) });
  }
  for (const table of types) for (const element of table.relationships?.elements ?? []) {
    const name = strings(prop(element, 'foreignKeyName')?.type)[0], target = strings(prop(element, 'referencedRelation')?.type)[0];
    if (name && target && !relations.some(r => r.name === name && r.table === table.name)) relations.push({ table: table.name, name, target, columns: strings(prop(element, 'columns')?.type), targetColumns: strings(prop(element, 'referencedColumns')?.type) });
  }
  for (const relation of relations) {
    const exists = await db.query('SELECT 1 FROM pg_constraint WHERE conrelid=$1::regclass AND conname=$2', [`public.${relation.table}`, relation.name]);
    if (!exists.rows.length) await db.exec(`ALTER TABLE public.${ident(relation.table)} ADD CONSTRAINT ${ident(relation.name)} FOREIGN KEY (${relation.columns.map(ident).join(',')}) REFERENCES public.${ident(relation.target)}(${relation.targetColumns.map(ident).join(',')}) NOT VALID`);
  }
  // Default UUIDs support the application's normal create forms on existing demo
  // tables as well as newly derived ones. No production schema is involved.
  const uuidIds = await db.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='id' AND data_type='uuid'");
  for (const row of uuidIds.rows) await db.exec(`ALTER TABLE public.${ident(row.table_name)} ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
  await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;');
  // Preserve payroll's stricter mutation boundaries after general demo grants.
  await db.exec('REVOKE UPDATE,DELETE ON public.payroll_audit FROM service_role; REVOKE UPDATE,DELETE ON public.payroll_activity_requests FROM service_role; REVOKE DELETE ON public.payroll_profiles,public.payroll_terms,public.payroll_rate_cards,public.payroll_settings,public.payroll_periods FROM service_role;');
}
