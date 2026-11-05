import type { LegacyPayrollSnapshot } from './legacyImport';
import type { LegacyIdentityLink } from './legacyIdentity';

export type Contract = 'MITRA' | 'FULLTIME';
export type PersonKind = 'COACH' | 'STAFF';
export type ActivityKind = 'WEEKLY' | 'EKSKUL' | 'TRIAL' | 'GOAL' | 'EVENT' | 'TRAINING_ONLINE' | 'TRAINING_OFFLINE' | 'OBSERVATION_ONLINE' | 'OBSERVATION_OFFLINE';
export type DeliveryStatus = 'SENDING' | 'SENT' | 'FAILED' | 'LMS_ONLY' | 'NO_CONTACT' | 'SIMULATED';

export interface PayrollPerson {
  id: string; user_id: string | null; kind: PersonKind; name: string; job_title: string;
  staff_phone: string | null; active: boolean;
}
export interface PayrollTerm {
  id?: string; profile_id: string; effective_from: string; contract: Contract; base_salary: number;
  position_allowance?: number; other_allowances?: { label: string; amount: number }[];
}
export interface PayrollRates {
  WEEKLY_ONLINE: number[]; WEEKLY_OFFLINE: number[];
  EKSKUL_ONLINE: number[]; EKSKUL_OFFLINE: number[];
  TRIAL: number; GOAL: number; EVENT: number; TRAINING_ONLINE: number; TRAINING_OFFLINE: number; OBSERVATION_ONLINE: number; OBSERVATION_OFFLINE: number;
}
export interface RateCard { id?: string; effective_from: string; rates: PayrollRates }
export const DEFAULT_RATES: PayrollRates = {
  WEEKLY_ONLINE: [70000, 80000, 100000], WEEKLY_OFFLINE: [95000, 105000, 125000],
  EKSKUL_ONLINE: [70000, 80000, 100000], EKSKUL_OFFLINE: [95000, 105000, 125000],
  TRIAL: 25000, GOAL: 100000, EVENT: 180000, TRAINING_ONLINE: 25000, TRAINING_OFFLINE: 50000, OBSERVATION_ONLINE: 25000, OBSERVATION_OFFLINE: 50000,
};
export interface PayrollSettings { active_from: string | null; automation_enabled: boolean }
export interface Activity {
  key: string; user_id: string; date: string; label: string; kind: ActivityKind;
  mode: Contract; delivery: 'ONLINE' | 'OFFLINE'; students: number; cancelled: boolean;
  details?: string;
}
export interface ActivityOverride {
  profile_id?: string; amount?: number; excluded?: boolean; mode?: Contract; reason: string;
}
export interface PayrollLine {
  key: string; date: string; label: string; kind: string; quantity: number; rate: number; amount: number;
  details: string; mode?: Contract; students?: number; override_reason?: string;
}
export interface Slip {
  profile_id: string; user_id: string | null; kind: PersonKind; name: string; job_title: string;
  contract: Contract; lines: PayrollLine[]; total: number;
}
export interface ManualComponent {
  id: string; profile_id: string; date: string; label: string; amount: number; reason: string;
}
export interface ManualActivity {
  id: string; profile_id: string; date: string; kind: ActivityKind; mode: Contract; label: string;
  delivery?: 'ONLINE' | 'OFFLINE'; students?: number;
}
export interface TransferReversal { id: string; transfer_id: string; at: string; by: string; reason: string }
export interface CorrectionRequest {
  id: string; user_id: string; message: string; at: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';
  response?: string; reviewed_by?: string; reviewed_at?: string;
}
export interface Transfer {
  id: string; profile_id: string; amount: number; at: string; by: string; reference: string; version: number;
}
export interface PayrollDelivery {
  token: string; profile_id: string; kind: 'RECAP' | 'SLIP' | 'REMINDER'; version: number;
  status: DeliveryStatus; at: string; error?: string; channel?: string;
}
export interface FinalVersion {
  version: number; finalized_at: string; finalized_by: string; slips: Slip[];
}
export interface PeriodDocument {
  id: string; year: number; month: number; starts_at: string; ends_at: string; correction_deadline: string;
  status: 'DRAFT' | 'FINAL'; version: number; slips: Slip[]; warnings: string[];
  overrides: Record<string, ActivityOverride>; manual: ManualComponent[]; activities: ManualActivity[];
  transfers: Transfer[]; deliveries: Record<string, PayrollDelivery>; history: FinalVersion[];
  calculated_at: string | null; revision_reason?: string;
  pic_id?: string | null; corrections?: CorrectionRequest[]; transfer_reversals?: TransferReversal[];
  legacy_imports?: LegacyPayrollSnapshot[];
  legacy_links?: Record<string, LegacyIdentityLink>;
}
export interface PeriodRecord { id: string; revision: number; document: PeriodDocument; updated_at?: string }

export class PayrollError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'PayrollError'; }
}
export function money(value: number): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > 1_000_000_000_000) throw new PayrollError('Nominal rupiah harus bilangan bulat yang valid.');
  return value;
}
export function wibDate(instant: string | Date): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new PayrollError('Tanggal tidak valid.');
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function createPeriod(year: number, month: number): PeriodDocument {
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) throw new PayrollError('Periode tidak valid.');
  const part = (y: number, m: number, day: number, hour = '00:00:00') => `${y}-${String(m).padStart(2, '0')}-${day}T${hour}+07:00`;
  return {
    id: `${year}-${String(month).padStart(2, '0')}`, year, month,
    starts_at: new Date(part(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, 26)).toISOString(),
    ends_at: new Date(part(year, month, 26)).toISOString(),
    correction_deadline: new Date(part(year, month, 25, '17:00:00')).toISOString(),
    status: 'DRAFT', version: 1, slips: [], warnings: [], overrides: {}, manual: [], activities: [],
    transfers: [], deliveries: {}, history: [], calculated_at: null,
  };
}
export function currentPeriod(now = new Date()): PeriodDocument {
  const [year, month, day] = wibDate(now).split('-').map(Number);
  return day >= 26 ? createPeriod(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1) : createPeriod(year, month);
}
export function inPeriod(date: string, period: PeriodDocument): boolean {
  const t = new Date(date).getTime();
  return Number.isFinite(t) && t >= Date.parse(period.starts_at) && t < Date.parse(period.ends_at);
}
export function effective<T extends { effective_from: string }>(rows: T[], date: string): T | undefined {
  return rows.filter(row => row.effective_from <= date).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
}
export function validateRates(rates: PayrollRates): void {
  for (const key of Object.keys(DEFAULT_RATES) as (keyof PayrollRates)[]) {
    const values = Array.isArray(rates[key]) ? rates[key] as number[] : [rates[key] as number];
    if (Array.isArray(DEFAULT_RATES[key]) && values.length !== 3) throw new PayrollError('Tarif kelas harus memuat kategori 1, 2, dan 3+ anak.');
    for (const amount of values) if (money(amount) < 0) throw new PayrollError('Tarif tidak boleh negatif.');
  }
}
export function calculatePeriod(input: {
  period: PeriodDocument; people: PayrollPerson[]; terms: PayrollTerm[]; cards: RateCard[];
  activities: Activity[]; now?: Date; sourceWarnings?: string[];
}): PeriodDocument {
  const { people, terms, cards } = input;
  const now = input.now ?? new Date();
  const p = structuredClone(input.period);
  if (p.status !== 'DRAFT') throw new PayrollError('Buka revisi sebelum menghitung ulang periode final.', 409);
  const warnings = new Set(input.sourceWarnings ?? []);
  const slips = new Map<string, Slip>();
  const dateForSalary = wibDate(new Date(Math.min(now.getTime(), Date.parse(p.ends_at) - 1)));
  for (const person of people.filter(x => x.active)) {
    const term = effective(terms.filter(t => t.profile_id === person.id), dateForSalary);
    if (!term) { warnings.add(`Kontrak belum diatur: ${person.name}`); continue; }
    if (term.contract === 'FULLTIME' && term.base_salary <= 0) warnings.add(`Gaji pokok fulltime belum diatur: ${person.name}`);
    const lines: PayrollLine[] = [];
    if (term.contract === 'FULLTIME') lines.push({ key: `salary:${person.id}`, date: dateForSalary, label: 'Gaji tetap', kind: 'SALARY', quantity: 1, rate: money(term.base_salary), amount: money(term.base_salary), details: `Kontrak berlaku ${term.effective_from}` });
    const recurring = [{ label: 'Tunjangan jabatan', amount: term.position_allowance ?? 0 }, ...(term.other_allowances ?? [])];
    recurring.forEach((allowance, index) => {
      const amount = money(allowance.amount);
      if (amount < 0) throw new PayrollError('Tunjangan rutin tidak boleh negatif. Gunakan potongan per periode.');
      if (amount > 0) lines.push({ key: `allowance:${person.id}:${index}`, date: dateForSalary, label: allowance.label, kind: 'ALLOWANCE', quantity: 1, rate: amount, amount, details: `Tunjangan rutin · Berlaku ${term.effective_from}` });
    });
    slips.set(person.id, { profile_id: person.id, user_id: person.user_id, kind: person.kind, name: person.name, job_title: person.job_title, contract: term.contract, lines, total: 0 });
  }
  const allActivities = [...input.activities];
  for (const manual of p.activities) {
    const person = people.find(x => x.id === manual.profile_id);
    allActivities.push({ key: `manual-activity:${manual.id}`, user_id: person?.user_id ?? `staff:${manual.profile_id}`, date: manual.date, label: manual.label, kind: manual.kind, mode: manual.mode, delivery: manual.delivery ?? 'ONLINE', students: manual.students ?? 1, cancelled: false });
  }
  const seen = new Set<string>();
  for (const a of allActivities) {
    if (seen.has(a.key) || !inPeriod(a.date, p) || Date.parse(a.date) > now.getTime()) continue;
    seen.add(a.key);
    const override = p.overrides[a.key];
    const person = override?.profile_id ? people.find(x => x.id === override.profile_id) : people.find(x => x.user_id === a.user_id || `staff:${x.id}` === a.user_id);
    if (!person) { if (!a.cancelled) warnings.add(`Coach belum terdaftar payroll: ${a.label}`); continue; }
    const slip = slips.get(person.id);
    const term = effective(terms.filter(t => t.profile_id === person.id), wibDate(a.date));
    const card = effective(cards, wibDate(a.date));
    if (!slip || !term || !card) { warnings.add(`Kontrak/tarif belum berlaku: ${person.name}, ${wibDate(a.date)}`); continue; }
    validateRates(card.rates);
    const mode: Contract = term.contract === 'MITRA' ? 'MITRA' : override?.mode ?? a.mode;
    const nonPayable = a.cancelled || override?.excluded === true || (a.kind !== 'GOAL' && ((a.kind === 'TRIAL' && term.contract === 'FULLTIME') || mode === 'FULLTIME'));
    let rate = 0;
    if (a.kind === 'WEEKLY' || a.kind === 'EKSKUL') {
      if (a.students <= 0 && !a.cancelled && !override?.excluded && override?.amount === undefined) warnings.add(`Tidak ada peserta aktif: ${a.label}`);
      rate = a.students > 0 ? card.rates[`${a.kind}_${a.delivery}`][Math.min(a.students, 3) - 1] : 0;
    } else rate = card.rates[a.kind];
    const amount = override?.amount !== undefined ? money(override.amount) : nonPayable ? 0 : rate;
    slip.lines.push({ key: a.key, date: a.date, label: a.label, kind: a.kind, quantity: 1, rate, amount, mode, students: a.students,
      details: [a.details, a.cancelled ? 'Aktivitas dibatalkan' : '', nonPayable && !a.cancelled ? 'Tidak menghasilkan tambahan fee' : ''].filter(Boolean).join(' · '), override_reason: override?.reason });
  }
  for (const m of p.manual) {
    const slip = slips.get(m.profile_id);
    if (!slip) throw new PayrollError('Penerima komponen manual belum aktif pada periode ini.');
    slip.lines.push({ key: `component:${m.id}`, date: m.date, label: m.label, kind: 'ADJUSTMENT', quantity: 1, rate: money(m.amount), amount: money(m.amount), details: m.reason });
  }
  // A transferred recipient must remain visible even if their current profile was deactivated.
  for (const previous of p.slips) if (!slips.has(previous.profile_id) && p.transfers.some(t => t.profile_id === previous.profile_id)) {
    slips.set(previous.profile_id, { ...previous, lines: [], total: 0 });
    warnings.add(`Penerima yang sudah ditransfer dinonaktifkan: ${previous.name}. Periksa selisih.`);
  }
  p.slips = [...slips.values()].map(s => ({ ...s, lines: s.lines.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)), total: money(s.lines.reduce((sum, line) => money(sum + line.amount), 0)) })).sort((a, b) => a.name.localeCompare(b.name));
  for (const s of p.slips) if (s.total < 0) warnings.add(`Total negatif: ${s.name}. Sesuaikan potongan sebelum finalisasi.`);
  p.warnings = [...warnings]; p.calculated_at = now.toISOString();
  return p;
}
export function paidAmount(p: PeriodDocument, personId: string): number {
  return p.transfers.filter(t => t.profile_id === personId && !(p.transfer_reversals ?? []).some(r => r.transfer_id === t.id)).reduce((sum, t) => money(sum + t.amount), 0);
}
export function isPaid(p: PeriodDocument, personId: string, total?: number): boolean {
  const slip = p.slips.find(s => s.profile_id === personId);
  return Boolean(slip && p.transfers.some(t => t.profile_id === personId && !(p.transfer_reversals ?? []).some(r => r.transfer_id === t.id)) && paidAmount(p, personId) >= (total ?? slip.total));
}
function idle(p: PeriodDocument) {
  if (Object.values(p.deliveries).some(d => d.status === 'SENDING')) throw new PayrollError('Ada pengiriman berlangsung. Selesaikan/statuskan pengiriman sebelum mengubah periode.', 409);
}
export function finalize(p: PeriodDocument, actor: string, now = new Date()): PeriodDocument {
  idle(p);
  if (p.status === 'FINAL') return p;
  if (now.getTime() < Date.parse(p.ends_at)) throw new PayrollError('Periode masih berjalan sampai akhir tanggal 25 WIB. Finalisasi tersedia tanggal 26.');
  if (!p.calculated_at || Date.parse(p.calculated_at) < Date.parse(p.ends_at)) throw new PayrollError('Hitung ulang setelah periode berakhir agar seluruh sesi tanggal 25 tercakup.');
  if (p.warnings.length) throw new PayrollError('Selesaikan peringatan perhitungan sebelum finalisasi.');
  if ((p.corrections ?? []).some(r => r.status === 'WAITING' || r.status === 'IN_PROGRESS')) throw new PayrollError('Selesaikan pengajuan koreksi coach sebelum finalisasi.');
  const next = structuredClone(p);
  next.status = 'FINAL';
  next.history.push({ version: next.version, finalized_at: now.toISOString(), finalized_by: actor, slips: structuredClone(next.slips) });
  return next;
}
export function reopen(p: PeriodDocument, reason: string): PeriodDocument {
  idle(p);
  if (!reason.trim()) throw new PayrollError('Alasan revisi wajib diisi.');
  if (p.status !== 'FINAL') throw new PayrollError('Periode masih berupa draft.');
  return { ...structuredClone(p), status: 'DRAFT', version: p.version + 1, revision_reason: reason.trim(), calculated_at: null };
}
export function markTransferred(p: PeriodDocument, profileIds: string[], actor: string, reference: string, now = new Date()): PeriodDocument {
  if (p.status !== 'FINAL') throw new PayrollError('Finalisasi periode sebelum menandai transfer.');
  const next = structuredClone(p);
  for (const id of [...new Set(profileIds)]) {
    const slip = next.slips.find(s => s.profile_id === id);
    if (!slip) throw new PayrollError('Penerima slip tidak ditemukan.');
    if (isPaid(next, id)) continue;
    const amount = Math.max(0, money(slip.total - paidAmount(next, id)));
    const baseId = `${p.id}:${id}:${p.version}`;
    next.transfers.push({ id: next.transfers.some(t => t.id === baseId) ? `${baseId}:${next.transfers.length + 1}` : baseId, profile_id: id, version: p.version, amount, at: now.toISOString(), by: actor, reference });
  }
  return next;
}
export function correctionOpen(p: PeriodDocument, now = new Date()): boolean { return now.getTime() < Date.parse(p.correction_deadline); }
export function reverseTransfer(p: PeriodDocument, transferId: string, actor: string, reason: string, now = new Date()): PeriodDocument {
  idle(p);
  if (p.status !== 'FINAL') throw new PayrollError('Batalkan penandaan transfer pada periode final.');
  if (reason.trim().length < 5) throw new PayrollError('Alasan pembatalan wajib diisi.');
  if (!p.transfers.some(t => t.id === transferId)) throw new PayrollError('Penandaan transfer tidak ditemukan.');
  if ((p.transfer_reversals ?? []).some(r => r.transfer_id === transferId)) throw new PayrollError('Penandaan ini sudah dibatalkan.', 409);
  return { ...structuredClone(p), transfer_reversals: [...(p.transfer_reversals ?? []), { id: `reverse:${transferId}`, transfer_id: transferId, at: now.toISOString(), by: actor, reason: reason.trim() }] };
}
export function submitCorrection(p: PeriodDocument, input: { id: string; user_id: string; message: string }, now = new Date()): PeriodDocument {
  if (!p.slips.some(s => s.user_id === input.user_id)) throw new PayrollError('Rekap tidak ditemukan.', 404);
  const existing = p.corrections?.find(r => r.id === input.id);
  if (existing) {
    if (existing.user_id !== input.user_id || existing.message !== input.message.trim()) throw new PayrollError('ID pengajuan sudah digunakan.', 409);
    return p;
  }
  if (!correctionOpen(p, now) || p.status !== 'DRAFT') throw new PayrollError('Batas koreksi tanggal 25 pukul 17.00 WIB telah lewat.');
  if (input.message.trim().length < 10) throw new PayrollError('Tulis rincian koreksi minimal 10 karakter.');
  return { ...structuredClone(p), corrections: [...(p.corrections ?? []), { ...input, message: input.message.trim(), at: now.toISOString(), status: 'WAITING' }] };
}
export function reviewCorrection(p: PeriodDocument, id: string, status: 'IN_PROGRESS' | 'DONE' | 'REJECTED', actor: string, response: string, now = new Date()): PeriodDocument {
  const next = structuredClone(p), request = next.corrections?.find(r => r.id === id);
  if (!request) throw new PayrollError('Pengajuan koreksi tidak ditemukan.', 404);
  if (request.status === 'DONE' || request.status === 'REJECTED') throw new PayrollError('Pengajuan sudah diselesaikan.', 409);
  if (response.trim().length < 5) throw new PayrollError('Tanggapan wajib diisi.');
  Object.assign(request, { status, response: response.trim(), reviewed_by: actor, reviewed_at: now.toISOString() });
  return next;
}
export function recapMessage(p: PeriodDocument, slip: Slip, now = new Date()): string {
  const labels: Record<string, string> = { WEEKLY: 'Weekly', EKSKUL: 'Ekskul', TRIAL: 'Trial', EVENT: 'Event', TRAINING_ONLINE: 'Training online', TRAINING_OFFLINE: 'Training offline', OBSERVATION_ONLINE: 'Observasi online', OBSERVATION_OFFLINE: 'Observasi offline' };
  const lines = slip.lines.filter(l => Object.hasOwn(labels, l.kind));
  const count = lines.filter(l => !l.details.includes('dibatalkan')).length;
  const details = lines.map((l, i) => `${i + 1}. ${new Date(l.date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })} WIB — ${l.label}\n   ${labels[l.kind]}${l.students !== undefined && ['WEEKLY','EKSKUL','TRIAL'].includes(l.kind) ? ` · ${l.students} anak` : ''}${l.details.includes('Coach pengganti') ? ' · Coach pengganti' : ''}${l.details.includes('dibatalkan') ? ' · DIBATALKAN' : ' · Tercatat'}`).join('\n');
  return `REKAP ABSENSI ${p.id}\nHalo ${slip.name}, berikut rincian absensi sementara sampai ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.\n${count} aktivitas tercatat.\n\n${details || 'Belum ada aktivitas tercatat pada periode ini.'}\n\nBATAS KOREKSI: 25 ${new Date(p.correction_deadline).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' })} PUKUL 17.00 WIB.\nPeriksa tanggal, kelas, pengganti, dan aktivitas tambahan. Laporkan selisih kepada admin sebelum batas tersebut. Pengajuan koreksi ditutup tepat pukul 17.00 WIB. Pastikan seluruh aktivitas sudah diperiksa sebelum batas tersebut.\nAktivitas tanggal 25 setelah pesan ini tetap dicatat dalam periode berjalan. Pembayaran dan slip gaji diproses finance pada akhir bulan.`;
}
