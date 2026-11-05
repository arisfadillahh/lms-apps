import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Read-only comparison; never feeds payment commands or notification recipients. */
export async function payrollLegacyBaseline(periodId: string) {
  if (process.env.PAYROLL_LOCAL_PREVIEW !== 'true') return null;
  try {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), '.codex-maintenance/payroll-baseline-2026-11.json'), 'utf8')) as {
      capturedAt: string; period: string; url: string;
      sheets: { name: string; rows: { value: string | number }[][] }[];
    };
    if (raw.period !== periodId) return null;
    const rows = raw.sheets.find(s => s.name === 'ID Coaches')?.rows ?? [];
    return { capturedAt: raw.capturedAt, period: raw.period, url: raw.url, rows: rows.slice(1).filter(r => r[0]?.value && r[1]?.value).map(r => ({
      sourceId: String(r[0].value), name: String(r[1].value), username: String(r[2]?.value ?? ''),
      counters: rows[0].slice(3, 14).map((h, i) => ({ label: String(h.value), value: Number(r[i + 3]?.value) || 0 })),
      amount: typeof r[25]?.value === 'number' ? r[25].value : null,
    })) };
  } catch { return null; }
}
