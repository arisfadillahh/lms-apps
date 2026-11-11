import { latestLegacySnapshot } from './legacyImport.ts';
import { usesLmsAttendanceForEntirePeriod } from './attendancePolicy.ts';
import { calculatePeriod, effective, wibDate, PayrollError, type Activity, type PayrollPerson, type PayrollTerm, type RateCard, type PeriodDocument, type Slip } from './model.ts';

function fallbackRate(kind: string, label: string, cards: RateCard[], date: string): number {
  const rates = effective(cards, date)?.rates;
  if (!rates) return 0;
  if (kind === 'CLASS_SUMMARY') {
    const delivery = /offline/i.test(label) ? 'OFFLINE' : 'ONLINE';
    const bucket = /1 anak/.test(label) ? 0 : /2 anak/.test(label) ? 1 : 2;
    return rates[`WEEKLY_${delivery}`][bucket];
  }
  if (kind === 'TRANSPORT') return 0;
  return rates[kind as keyof typeof rates] as number;
}

export function summaryActivity(label: string) {
  const name = label.replace(/^Fee /, '');
  if (/^(Online|Offline)/.test(name)) {
    const [delivery, size] = name.split(' ');
    return { label: `Kelas ${delivery.toLowerCase()}${size ? ` · ${size === '1' ? '1 anak' : size === '2' ? '2 anak' : 'kelompok kecil'}` : ' · kelompok'}`, counter: `Absen ${name}`, kind: 'CLASS_SUMMARY' };
  }
  const known: Record<string, { label: string; counter: string; kind: string }> = {
    Trial: { label: 'Trial', counter: 'Absen Trial', kind: 'TRIAL' },
    Event: { label: 'Event', counter: 'Absen Event', kind: 'EVENT' },
    'Join Coder': { label: 'Bonus goal trial', counter: 'Join Coder', kind: 'GOAL' },
    'Training Online': { label: 'Training online', counter: 'Training Online', kind: 'TRAINING_ONLINE' },
    'Training Offline': { label: 'Training offline', counter: 'Training Offline', kind: 'TRAINING_OFFLINE' },
    'Transport-Motor': { label: 'Transport', counter: 'Transport-Motor', kind: 'TRANSPORT' },
  };
  const result = known[name]; if (!result) throw new PayrollError(`Komponen sinkronisasi belum dikenali: ${label}`);
  return result;
}

// Synchronization replaces the cumulative seed. It is never added to the same
// period's automatic session feed. Next periods use the normal LMS source feed.
export function calculateSynchronizedPeriod(input: {
  period: PeriodDocument; people: PayrollPerson[]; terms: PayrollTerm[]; cards: RateCard[]; now?: Date; includeRecurring: boolean; activities?: Activity[]; sourceWarnings?: string[];
}): PeriodDocument {
  const { period, people, terms, includeRecurring } = input;
  const source = latestLegacySnapshot(period.legacy_imports ?? []);
  if (!source) throw new PayrollError('Data sinkronisasi periode tidak ditemukan.');
  const represented = new Set(source.rows.flatMap(row=>row.fees.map(fee=>summaryActivity(fee.label).kind)));
  const lmsAttendance = usesLmsAttendanceForEntirePeriod(period);
  const baseline = lmsAttendance ? undefined : period.legacy_class_baseline;
  if(period.class_attendance_from && !lmsAttendance && !baseline)throw new PayrollError('Baseline kelas sebelum perubahan absensi belum tersedia.');
  const nativeOnly = (kind: string) => (Boolean(period.class_attendance_from) && ['WEEKLY','EKSKUL'].includes(kind))
    || (lmsAttendance && ['TRIAL','GOAL'].includes(kind))
    || (['GOAL','OBSERVATION_ONLINE','OBSERVATION_OFFLINE'].includes(kind) && !represented.has(kind));
  const slips = new Map<string, Slip>(), warnings: string[] = [...input.sourceWarnings ?? []];
  const date = wibDate(new Date(Math.min((input.now ?? new Date()).getTime(),Date.parse(period.ends_at)-1)));
  const rows=[...source.rows];
  for(const row of baseline?.rows ?? [])if(!rows.some(r=>r.sourceId===row.sourceId))rows.push({...row,fees:row.fees.filter(f=>summaryActivity(f.label).kind==='CLASS_SUMMARY')});
  for (const row of rows) {
    const link = period.legacy_links?.[row.sourceId];
    if (link?.status === 'IGNORED') continue;
    if (!link) throw new PayrollError('Identitas penerima belum dipasangkan. Hubungi admin untuk melengkapi data.');
    const person = people.find(p => p.id === link.profile_id);
    if (!person || person.user_id !== link.user_id || person.kind !== link.kind) throw new PayrollError('Identitas penerima berubah; sinkronisasi dihentikan.');
    const term = effective(terms.filter(t => t.profile_id === person.id), date);
    const slip = slips.get(person.id) ?? { profile_id: person.id, user_id: person.user_id, name: person.name, job_title: person.job_title, kind: person.kind, contract: term?.contract ?? 'MITRA', contract_unconfirmed: !term, lines: [], total: 0 };
    slips.set(person.id, slip);
    const fees=[...row.fees];
    const baselineRow = baseline?.rows.find(r=>r.sourceId===row.sourceId);
    for(const fee of baselineRow?.fees ?? [])if(summaryActivity(fee.label).kind==='CLASS_SUMMARY' && !fees.some(f=>f.label===fee.label))fees.push(fee);
    for (const incomingFee of fees) {
      const activity = summaryActivity(incomingFee.label);
      if(lmsAttendance && ['CLASS_SUMMARY','TRIAL','GOAL'].includes(activity.kind))continue;
      const useBaseline = activity.kind==='CLASS_SUMMARY' && Boolean(period.class_attendance_from);
      const fee=useBaseline ? baselineRow?.fees.find(f=>f.label===incomingFee.label) ?? {...incomingFee,value:0} : incomingFee;
      const counters=useBaseline ? baselineRow?.counters ?? [] : row.counters;
      const originalQuantity = counters.find(c => c.label.toLowerCase() === activity.counter.toLowerCase())?.value ?? 0;
      const key = `summary:${row.sourceId}:${fee.label}`;
      const override = period.overrides[key];
      const quantity = override?.quantity_delta !== undefined ? Math.max(0,originalQuantity+override.quantity_delta) : override?.meeting_keys ? override.meeting_keys.length : override?.quantity ?? originalQuantity;
      if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 10000) throw new PayrollError('Jumlah aktivitas harus berupa bilangan bulat yang valid.');
      let unit = originalQuantity > 0 && fee.value !== null ? fee.value / originalQuantity : fallbackRate(activity.kind, activity.label, input.cards, date);
      if (quantity > 0 && override?.quantity !== undefined && originalQuantity === 0 && (activity.kind === 'TRANSPORT' || !effective(input.cards, date))) throw new PayrollError('Tarif belum tersedia. Gunakan komponen manual beralasan untuk aktivitas ini.');
      const target = override?.profile_id ? people.find(p => p.id === override.profile_id) : person;
      if (!target) throw new PayrollError('Penerima koreksi tidak ditemukan.');
      const targetTerm = effective(terms.filter(t => t.profile_id === target.id),date);
      if (activity.kind === 'TRIAL' && targetTerm?.contract === 'FULLTIME') unit=0;
      let targetSlip = slips.get(target.id);
      if (!targetSlip) { targetSlip = { ...slip, profile_id: target.id, user_id: target.user_id, kind: target.kind, name: target.name, job_title: target.job_title, contract: targetTerm?.contract ?? 'MITRA', contract_unconfirmed: !targetTerm, lines: [], total: 0 }; slips.set(target.id,targetSlip); }
      const quantityChanged = override?.quantity !== undefined || override?.meeting_keys !== undefined;
      if (fee.value === null && quantity > 0 && override?.amount === undefined && !override?.excluded && !quantityChanged) warnings.push(`Nominal belum diisi: ${person.name}, ${activity.label}`);
      targetSlip.lines.push({ key, date: '', label: activity.label, kind: activity.kind, quantity, rate: Math.round(unit), quantity_rate: unit,
        source_identity: row.sourceId, source_counter: activity.counter, source_quantity: originalQuantity,
        ...(activity.kind==='CLASS_SUMMARY' && period.class_attendance_from ? {summary_before:period.class_attendance_from}:{}),
        amount: override?.amount ?? (override?.excluded ? 0 : quantityChanged ? Math.round(unit * quantity) : fee.value ?? 0), details: override?.excluded ? 'Aktivitas dibatalkan' : '', summary: true, amount_pending: fee.value === null && override?.amount === undefined && !quantityChanged, override_reason: override?.reason });
    }
  }
  for (const person of people.filter(p => period.manual.some(m => m.profile_id === p.id) || period.activities.some(a => a.profile_id === p.id))) {
    if (!slips.has(person.id)) slips.set(person.id, { profile_id: person.id, user_id: person.user_id, name: person.name, job_title: person.job_title, kind: person.kind, contract: 'MITRA', contract_unconfirmed: true, lines: [], total: 0 });
  }
  // Operational source-only sync has no live invoice/request feed. Preserve its
  // last verified native-only entries until the application recalculates them.
  if (input.activities === undefined) for (const previous of period.slips) {
    const lines = previous.lines.filter(l=>!l.summary && !l.key.startsWith('manual-activity:') && nativeOnly(l.kind));
    if (!lines.length) continue;
    const slip = slips.get(previous.profile_id) ?? { ...previous, lines: [], total: 0 };
    slip.lines.push(...structuredClone(lines));slips.set(previous.profile_id,slip);
  }
  const result = calculatePeriod({ ...input, activities: (input.activities ?? []).filter(a=>nativeOnly(a.kind) && (!['WEEKLY','EKSKUL'].includes(a.kind) || Date.parse(a.date)>=Date.parse(period.class_attendance_from!))), seedSlips: [...slips.values()], includeRecurring, sourceWarnings: warnings });
  result.synchronized_at = source.capturedAt;
  return result;
}
