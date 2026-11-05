import type { PeriodDocument } from './model';

/** Imported counters remain a source snapshot, never payable sessions or transfers. */
export interface LegacyPayrollRow {
  sourceId: string; name: string; username: string;
  counters: { label: string; value: number }[];
  fees: { label: string; value: number | null; formula?: string }[];
  total: number; sourceTotal: number | null;
  extras: { cell: string; label: string; value: number | string; formula?: string }[];
  ignoredExtraCells?: string[];
}
export interface LegacyPayrollSnapshot {
  schema: 1; sourceId: string; sourceName: string; url: string; period: string;
  sourceCreatedAt: string; sourceModifiedAt: string; capturedAt: string; checksum: string;
  rows: LegacyPayrollRow[]; total: number; totalBasis: 'SOURCE_TOTAL' | 'RECORDED_FEES' | 'MIXED';
}

type Cell = { effectiveValue?: { numberValue?: number; stringValue?: string; errorValue?: unknown }; userEnteredValue?: { formulaValue?: string }; formattedValue?: string };
export interface LegacySheetSource {
  file: { id: string; name: string; createdTime: string; modifiedTime: string };
  capturedAt: string;
  cells: { spreadsheetId: string; sheets: { properties: { title: string }; data?: { startRow?: number; startColumn?: number; rowData?: { values?: Cell[] }[] }[] }[] };
}
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
export function legacyArchivePeriod(name: string): string {
  const match = /^(?:Rekap Gaji )?([a-z]+) (20\d{2})$/i.exec(name.trim());
  const month = match ? months.indexOf(match[1].toLowerCase()) + 1 : 0;
  if (!match || !month) throw new Error(`Nama arsip tidak menentukan periode: ${name}`);
  return `${match[2]}-${String(month).padStart(2, '0')}`;
}
function number(cell: Cell | undefined, context: string): number {
  let numeric = cell?.effectiveValue?.numberValue;
  const text = cell?.effectiveValue?.stringValue;
  if (numeric === undefined && text && /^Rp\.?\s*(\d{1,3}(\.\d{3})*|\d+)(,-)?$/.test(text)) numeric = Number(text.replace(/^Rp\.?\s*/, '').replace(/,-$/, '').replaceAll('.', ''));
  if (!Number.isSafeInteger(numeric) || Math.abs(numeric!) > 1_000_000_000_000) throw new Error(`Angka sumber tidak valid: ${context}`);
  return numeric!;
}
function value(cell: Cell | undefined): string {
  return String(cell?.effectiveValue?.stringValue ?? cell?.effectiveValue?.numberValue ?? '').trim();
}
export function parseLegacySheet(source: LegacySheetSource, checksum: string, currentPeriod?: string): LegacyPayrollSnapshot {
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error('Checksum sumber tidak valid.');
  if (!source.file.id || source.file.id !== source.cells.spreadsheetId) throw new Error('Identitas file sumber berbeda.');
  for (const date of [source.file.createdTime, source.file.modifiedTime, source.capturedAt]) if (!Number.isFinite(Date.parse(date))) throw new Error('Waktu sumber tidak valid.');
  const period = currentPeriod ?? legacyArchivePeriod(source.file.name);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Periode impor tidak valid.');
  const sheet = source.cells.sheets.find(s => s.properties.title === 'ID Coaches');
  const grid = sheet?.data?.[0];
  if (!grid || (grid.startRow ?? 0) !== 0 || (grid.startColumn ?? 0) !== 0) throw new Error('Header sumber harus dimulai dari A1.');
  const cells = grid.rowData ?? [];
  const header = (cells[0]?.values ?? []).map(value);
  while (header.at(-1) === '') header.pop();
  const firstFee = header.findIndex(h => h.startsWith('Fee '));
  const sourceTotalIndex = header.indexOf('Total Estimasi');
  const totalIndex = sourceTotalIndex < 0 ? header.length : sourceTotalIndex;
  if (header.slice(0, 3).join('|') !== 'Coach ID|Name|Username' || firstFee <= 3 || totalIndex <= firstFee || header.slice(firstFee, totalIndex).some(h => !h.startsWith('Fee '))) throw new Error('Struktur rekap sumber belum didukung.');
  const rows: LegacyPayrollRow[] = [];
  const seen = new Set<string>();
  for (const [index, row] of cells.slice(1).entries()) {
    const c = row.values ?? [];
    if (!c.some(cell => cell.effectiveValue !== undefined)) continue;
    const sourceId = value(c[0]), name = value(c[1]);
    if (!sourceId || !name || seen.has(sourceId)) throw new Error(`Identitas kosong/duplikat pada baris ${index + 2}.`);
    seen.add(sourceId);
    const counters = header.slice(3, firstFee).map((label, i) => ({ label, value: number(c[i + 3], `${name}: ${label}`) }));
    if (counters.some(c => c.value < 0)) throw new Error(`Jumlah aktivitas negatif: ${name}`);
    const fees = header.slice(firstFee, totalIndex).map((label, i) => ({ label, value: c[i + firstFee]?.effectiveValue === undefined ? null : number(c[i + firstFee], `${name}: ${label}`), ...(c[i + firstFee]?.userEnteredValue?.formulaValue ? { formula: c[i + firstFee].userEnteredValue!.formulaValue } : {}) }));
    const feeSum = fees.reduce((sum, fee) => sum + (fee.value ?? 0), 0);
    const sourceTotal = sourceTotalIndex < 0 || c[totalIndex]?.effectiveValue === undefined ? null : number(c[totalIndex], `${name}: total`);
    const total = sourceTotal ?? feeSum;
    if (feeSum !== total) throw new Error(`Jumlah komponen berbeda dari total sumber: ${name}`);
    const column = (index: number): string => index < 26 ? String.fromCharCode(65 + index) : column(Math.floor(index / 26) - 1) + column(index % 26);
    const offset = totalIndex + (sourceTotalIndex < 0 ? 0 : 1);
    const extras = c.slice(offset).flatMap((cell, i) => {
      if (cell.effectiveValue === undefined) return [];
      if (cell.effectiveValue.errorValue) throw new Error(`Sel sumber bermasalah: ${name}`);
      const col = column(offset + i);
      return [{ cell: `${col}${index + 2}`, label: header[offset + i] || `Kolom ${col} (tanpa judul)`, value: cell.effectiveValue.numberValue ?? value(cell), ...(cell.userEnteredValue?.formulaValue ? { formula: cell.userEnteredValue.formulaValue } : {}) }];
    });
    rows.push({ sourceId, name, username: value(c[2]), counters, fees, total, sourceTotal, extras });
  }
  if (!rows.length) throw new Error('Rekap sumber kosong.');
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Total sumber tidak valid.');
  return { schema: 1, sourceId: source.file.id, sourceName: source.file.name,
    url: `https://docs.google.com/spreadsheets/d/${source.file.id}/edit`, period,
    sourceCreatedAt: source.file.createdTime, sourceModifiedAt: source.file.modifiedTime,
    capturedAt: source.capturedAt, checksum, rows, total, totalBasis: sourceTotalIndex < 0 ? 'RECORDED_FEES' : rows.some(r => r.sourceTotal === null) ? 'MIXED' : 'SOURCE_TOTAL' };
}

export function mergeLegacySnapshots(period: PeriodDocument, incoming: LegacyPayrollSnapshot[]): PeriodDocument {
  if (incoming.some(s => s.period !== period.id) || new Set(incoming.map(s => s.sourceId)).size !== incoming.length) throw new Error('Periode/identitas snapshot tidak cocok.');
  const next = structuredClone(period);
  const snapshots = new Map((next.legacy_imports ?? []).map(s => [s.sourceId, s]));
  for (const snapshot of incoming) {
    const previous = snapshots.get(snapshot.sourceId);
    if (previous?.checksum === snapshot.checksum) continue;
    snapshots.set(snapshot.sourceId, structuredClone(snapshot));
  }
  next.legacy_imports = [...snapshots.values()].sort((a,b) => a.sourceId.localeCompare(b.sourceId));
  return next;
}

/** Explicit import policy: unlabelled manual columns stay in the private source backup. */
export function withoutUnlabelledExtras(snapshot: LegacyPayrollSnapshot): LegacyPayrollSnapshot {
  return { ...snapshot, rows: snapshot.rows.map(row => ({ ...row,
    ignoredExtraCells: row.extras.filter(e => /\(tanpa judul\)$/.test(e.label)).map(e => e.cell),
    extras: row.extras.filter(e => !/\(tanpa judul\)$/.test(e.label)),
  })) };
}

/** Select a single archive version; duplicates are alternatives, never summed. */
export function latestLegacySnapshot(snapshots: LegacyPayrollSnapshot[]): LegacyPayrollSnapshot | undefined {
  return [...snapshots].sort((a, b) => b.sourceCreatedAt.localeCompare(a.sourceCreatedAt) || b.sourceModifiedAt.localeCompare(a.sourceModifiedAt) || a.sourceId.localeCompare(b.sourceId))[0];
}
