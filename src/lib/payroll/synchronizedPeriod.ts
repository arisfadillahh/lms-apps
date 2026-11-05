import { latestLegacySnapshot } from './legacyImport.ts';
import { calculatePeriod, effective, wibDate, PayrollError, type PayrollPerson, type PayrollTerm, type RateCard, type PeriodDocument, type Slip } from './model.ts';

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
  period: PeriodDocument; people: PayrollPerson[]; terms: PayrollTerm[]; cards: RateCard[]; now?: Date; includeRecurring: boolean;
}): PeriodDocument {
  const { period, people, terms, includeRecurring } = input;
  const source = latestLegacySnapshot(period.legacy_imports ?? []);
  if (!source) throw new PayrollError('Data sinkronisasi periode tidak ditemukan.');
  const slips = new Map<string, Slip>(), warnings: string[] = [];
  const date = wibDate(new Date(Math.min((input.now ?? new Date()).getTime(),Date.parse(period.ends_at)-1)));
  for (const row of source.rows) {
    const link = period.legacy_links?.[row.sourceId];
    if (link?.status === 'IGNORED') continue;
    if (!link) throw new PayrollError('Identitas penerima belum dipasangkan. Hubungi admin untuk melengkapi data.');
    const person = people.find(p => p.id === link.profile_id);
    if (!person || person.user_id !== link.user_id || person.kind !== link.kind) throw new PayrollError('Identitas penerima berubah; sinkronisasi dihentikan.');
    const term = effective(terms.filter(t => t.profile_id === person.id), date);
    const slip = slips.get(person.id) ?? { profile_id: person.id, user_id: person.user_id, name: person.name, job_title: person.job_title, kind: person.kind, contract: term?.contract ?? 'MITRA', contract_unconfirmed: !term, lines: [], total: 0 };
    slips.set(person.id, slip);
    for (const fee of row.fees) {
      const activity = summaryActivity(fee.label);
      const quantity = row.counters.find(c => c.label.toLowerCase() === activity.counter.toLowerCase())?.value ?? 0;
      const key = `summary:${row.sourceId}:${fee.label}`;
      const override = period.overrides[key];
      const target = override?.profile_id ? people.find(p => p.id === override.profile_id) : person;
      if (!target) throw new PayrollError('Penerima koreksi tidak ditemukan.');
      let targetSlip = slips.get(target.id);
      if (!targetSlip) { targetSlip = { ...slip, profile_id: target.id, user_id: target.user_id, kind: target.kind, name: target.name, job_title: target.job_title, lines: [], total: 0 }; slips.set(target.id,targetSlip); }
      if (fee.value === null && quantity > 0 && override?.amount === undefined && !override?.excluded) warnings.push(`Nominal belum diisi: ${person.name}, ${activity.label}`);
      targetSlip.lines.push({ key, date: '', label: activity.label, kind: activity.kind, quantity, rate: quantity && fee.value !== null ? Math.round(fee.value / quantity) : 0,
        amount: override?.amount ?? (override?.excluded ? 0 : fee.value ?? 0), details: override?.excluded ? 'Aktivitas dibatalkan' : '', summary: true, amount_pending: fee.value === null && override?.amount === undefined, override_reason: override?.reason });
    }
  }
  for (const person of people.filter(p => period.manual.some(m => m.profile_id === p.id) || period.activities.some(a => a.profile_id === p.id))) {
    if (!slips.has(person.id)) slips.set(person.id, { profile_id: person.id, user_id: person.user_id, name: person.name, job_title: person.job_title, kind: person.kind, contract: 'MITRA', contract_unconfirmed: true, lines: [], total: 0 });
  }
  const result = calculatePeriod({ ...input, activities: [], seedSlips: [...slips.values()], includeRecurring, sourceWarnings: warnings });
  result.synchronized_at = source.capturedAt;
  return result;
}
