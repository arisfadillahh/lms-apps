import { splitTopLevel } from './local-app-schema.mjs';
export const ident = name => { if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error('Invalid SQL identifier'); return `"${name}"`; };
const singular = name => name === 'classes' ? 'class' : name.endsWith('ies') ? name.slice(0, -3) + 'y' : name.replace(/s$/, '');
const controls = new Set(['select','order','limit','offset','on_conflict','columns']);

export async function loadRestSchema(db) {
  const columns = await db.query("SELECT table_name,column_name,udt_name FROM information_schema.columns WHERE table_schema='public'");
  const relations = await db.query(`SELECT conname AS name,src.relname AS source,dst.relname AS target,
    ARRAY(SELECT attname FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
    ARRAY(SELECT attname FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS target_columns
    FROM pg_constraint c JOIN pg_class src ON src.oid=c.conrelid JOIN pg_class dst ON dst.oid=c.confrelid WHERE c.contype='f'`);
  return { columns: columns.rows, relations: relations.rows };
}
export function parseSelect(source) {
  return splitTopLevel(source).map(part => {
    const open = part.indexOf('(');
    const header = open < 0 ? part : part.slice(0, open).trim();
    const colon = header.indexOf(':');
    const expression = colon < 0 ? header : header.slice(colon + 1);
    const [name, ...hints] = expression.split('!');
    const alias = colon < 0 ? name : header.slice(0, colon);
    if (name !== '*') ident(name); if (alias !== '*') ident(alias);
    if (open >= 0 && !part.endsWith(')')) throw new Error('Unbalanced local select');
    return { name, alias, inner: hints.includes('inner'), hint: hints.find(h => !['inner','left'].includes(h)), fields: open < 0 ? null : parseSelect(part.slice(open + 1, -1)) };
  });
}
function relationship(schema, table, field) {
  let candidates = schema.relations.flatMap(r => r.source === table && r.target === field.name
    ? [{ ...r, many: false }] : r.target === table && r.source === field.name
      ? [{ source: table, target: field.name, name: r.name, columns: r.target_columns, target_columns: r.columns, many: true }] : []);
  if (field.hint) candidates = candidates.filter(r => r.name === field.hint || r.columns.includes(field.hint));
  // Older generated schema types occasionally omit newer FK metadata. Resolve
  // only explicit ID columns; never return fabricated empty related data.
  if (!candidates.length) {
    const possible = [field.alias + '_id', singular(field.name) + '_id', field.hint?.replace(new RegExp('^' + table + '_'), '').replace(/_fkey$/, '')].filter(Boolean);
    const column = possible.find(c => schema.columns.some(x => x.table_name === table && x.column_name === c));
    const reverse = singular(table) + '_id';
    if (column) return { source: table, target: field.name, columns: [column], target_columns: ['id'], many: false };
    if (schema.columns.some(x => x.table_name === field.name && x.column_name === reverse)) return { source: table, target: field.name, columns: ['id'], target_columns: [reverse], many: true };
    throw new Error(`Local relationship ${table} → ${field.name} is missing`);
  }
  const unique = [...new Map(candidates.map(r => [r.columns + ':' + r.target_columns, r])).values()];
  if (unique.length !== 1) throw new Error(`Ambiguous local relationship ${table} → ${field.name}; specify FK`);
  return unique[0];
}
function predicate(column, expression, values) {
  const dot = expression.indexOf('.');
  const op = expression.slice(0, dot), raw = expression.slice(dot + 1);
  if (op === 'not') return `NOT (${predicate(column, raw, values)})`;
  if (op === 'is' && ['null','true','false'].includes(raw)) return `${column} IS ${raw.toUpperCase()}`;
  if (op === 'in') {
    const entries = splitTopLevel(raw.replace(/^\(|\)$/g, ''));
    if (!entries.length) return 'FALSE';
    return `${column} IN (${entries.map(v => { values.push(v.replace(/^"|"$/g, '')); return '$' + values.length; }).join(',')})`;
  }
  const operators = { eq: '=', neq: '<>', gte: '>=', gt: '>', lte: '<=', lt: '<', like: 'LIKE', ilike: 'ILIKE', cs: '@>', cd: '<@', ov: '&&' };
  if (!operators[op]) throw new Error('Unsupported local filter: ' + op);
  values.push(['like','ilike'].includes(op) ? raw.replace(/\*/g, '%') : raw);
  return `${column} ${operators[op]} $${values.length}`;
}
function logical(expression, alias, values, operator) {
  return '(' + splitTopLevel(expression.replace(/^\(|\)$/g, '')).map(item => {
    const nested = item.match(/^(and|or)\.(\([\s\S]*\))$/);
    if (nested) return logical(nested[2], alias, values, nested[1].toUpperCase());
    const dot = item.indexOf('.');
    return predicate(`${alias ? alias + '.' : ''}${ident(item.slice(0, dot))}`, item.slice(dot + 1), values);
  }).join(` ${operator} `) + ')';
}
export function localWhere(params, values, alias = '', prefix = '') {
  const clauses = [];
  for (const [key, expression] of params) {
    if (!key.startsWith(prefix)) continue;
    const field = key.slice(prefix.length);
    if (controls.has(field) || field.includes('.')) continue;
    const qualify = alias ? alias + '.' : '';
    if (field === 'or' || field === 'and') { clauses.push(logical(expression, alias, values, field.toUpperCase())); continue; }
    clauses.push(predicate(qualify + ident(field), expression, values));
  }
  return clauses;
}
function ordering(params, alias, prefix = '') {
  const source = params.get(prefix + 'order');
  if (!source) return '';
  const parts = splitTopLevel(source).map(item => {
    const [column, direction, nulls] = item.split('.');
    return `${alias}.${ident(column)} ${direction === 'desc' ? 'DESC' : 'ASC'}${nulls === 'nullsfirst' ? ' NULLS FIRST' : nulls === 'nullslast' ? ' NULLS LAST' : ''}`;
  });
  return ' ORDER BY ' + parts.join(',');
}
export async function readLocalRows(db, schema, table, params) {
  const values = []; let sequence = 0;
  function select(fields, currentTable, alias, prefix = '') {
    const conditions = localWhere(params, values, alias, prefix), projections = [];
    for (const field of fields) {
      if (!field.fields) {
        projections.push(field.name === '*' ? alias + '.*' : field.name === 'count' ? 'count(*)::int AS count' : `${alias}.${ident(field.name)} AS ${ident(field.alias)}`);
        continue;
      }
      const relation = relationship(schema, currentTable, field), childAlias = `r${++sequence}`;
      const child = select(field.fields, relation.target, childAlias, prefix + field.alias + '.');
      const joins = relation.columns.map((column, i) => `${alias}.${ident(column)}=${childAlias}.${ident(relation.target_columns[i])}`);
      const childWhere = [...joins, ...child.conditions].join(' AND ');
      let query = `SELECT ${child.projections.join(',')} FROM public.${ident(relation.target)} ${childAlias} WHERE ${childWhere}${ordering(params, childAlias, prefix + field.alias + '.')}`;
      if (!relation.many) query += ' LIMIT 1';
      projections.push(relation.many
        ? `COALESCE((SELECT json_agg(item) FROM (${query}) item),'[]'::json) AS ${ident(field.alias)}`
        : `(SELECT row_to_json(item) FROM (${query}) item) AS ${ident(field.alias)}`);
      if (field.inner) conditions.push(`EXISTS(SELECT 1 FROM public.${ident(relation.target)} ${childAlias} WHERE ${childWhere})`);
    }
    return { conditions, projections };
  }
  const plan = select(parseSelect(params.get('select') || '*'), table, 'root');
  const query = `SELECT ${plan.projections.join(',')} FROM public.${ident(table)} root${plan.conditions.length ? ' WHERE ' + plan.conditions.join(' AND ') : ''}`;
  const count = await db.query(`SELECT count(*)::int AS n FROM (${query}) counted`, values);
  const limit = Math.min(1000, Number(params.get('limit') || 1000)), offset = Number(params.get('offset') || 0);
  if (!Number.isInteger(limit) || !Number.isInteger(offset) || limit < 0 || offset < 0) throw new Error('Invalid local pagination');
  const result = await db.query(query + ordering(params, 'root') + ` LIMIT ${limit} OFFSET ${offset}`, values);
  const dates = new Set(result.fields.filter(f => f.dataTypeID === 1082).map(f => f.name));
  return { rows: result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => [key, dates.has(key) && value instanceof Date ? value.toISOString().slice(0,10) : value]))), count: count.rows[0].n };
}
